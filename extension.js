const vscode = require('vscode');
const https = require('https');

const TOKEN_KEY = 'githubPersonalDashboard.token';
const USER_AGENT = 'vscode-github-personal-dashboard';
const DATA_CACHE_MS = 60 * 1000;
const REQUIRED_SCOPES = ['read:user', 'notifications', 'repo'];

function activate(context) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = 'githubPersonalDashboard.open';
  status.tooltip = 'GitHub 个人工作台 · 点击查看 Issues、Pull Requests 和 Notifications';
  status.text = '$(github) GitHub';
  status.show();
  context.subscriptions.push(status);

  const client = new GitHubClient(context);
  let timer;
  let previousData;
  const pendingReminders = new Map();
  const refresh = async (force = false) => {
    status.text = '$(sync~spin) GitHub';
    try {
      const data = await client.load(force);
      const reminders = getReminders(previousData, data);
      reminders.items.forEach(item => pendingReminders.set(item.key, item));
      previousData = data;
      updateStatus(status, data, pendingReminders);
      return data;
    } catch (error) {
      status.text = '$(github) GitHub';
      status.tooltip = 'GitHub 尚未连接 · 点击查看认证诊断';
      throw error;
    }
  };

  const open = async () => {
    try {
      const data = await refresh(true);
      await showDashboard(data);
      pendingReminders.clear();
      updateStatus(status, data, pendingReminders);
    } catch (error) {
      await showAuthError(error, client);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('githubPersonalDashboard.open', open),
    vscode.commands.registerCommand('githubPersonalDashboard.refresh', async () => {
      try { await refresh(true); vscode.window.showInformationMessage('GitHub 数据已更新。'); }
      catch (error) { await showAuthError(error, client); }
    }),
    vscode.commands.registerCommand('githubPersonalDashboard.setToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: '输入 GitHub Personal Access Token（不会写入设置或日志）', password: true,
        ignoreFocusOut: true, placeHolder: 'ghp_… 或 github_pat_…',
        validateInput: value => value.trim().length < 10 ? 'Token 看起来太短了。' : undefined
      });
      if (!token) return;
      await context.secrets.store(TOKEN_KEY, token.trim());
      vscode.window.showInformationMessage('GitHub Token 已安全保存。');
      try { await refresh(); } catch (error) { await showAuthError(error, client); }
    }),
    vscode.commands.registerCommand('githubPersonalDashboard.clearToken', async () => {
      await context.secrets.delete(TOKEN_KEY);
      status.text = '$(github) GitHub';
      status.tooltip = 'GitHub 尚未连接 · 点击查看认证诊断';
      vscode.window.showInformationMessage('GitHub Token 已清除。');
    }),
    vscode.commands.registerCommand('githubPersonalDashboard.diagnoseAuth', () => diagnoseAuth(client))
  );

  const minutes = vscode.workspace.getConfiguration('githubPersonalDashboard').get('refreshIntervalMinutes', 3);
  if (minutes > 0) timer = setInterval(() => refresh(true).catch(() => {}), minutes * 60 * 1000);
  if (timer) context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

async function showAuthError(error, client) {
  const message = error.userMessage || `GitHub 请求失败：${error.message}`;
  const actions = error.code === 'NO_GITHUB_LOGIN' || error.code === 'NO_PROVIDER'
    ? ['认证诊断', '设置 Token'] : error.code === 'INVALID_TOKEN' ? ['设置 Token', '认证诊断'] : ['认证诊断'];
  const choice = await vscode.window.showErrorMessage(message, ...actions);
  if (choice === '认证诊断') await diagnoseAuth(client);
  if (choice === '设置 Token') await vscode.commands.executeCommand('githubPersonalDashboard.setToken');
}

async function diagnoseAuth(client) {
  const info = await client.getAuthInfo();
  const extensions = vscode.extensions.all.filter(extension => /^github\./i.test(extension.id));
  const official = extensions.filter(extension => extension.id.toLowerCase() === 'github.vscode-pull-request-github');
  const lines = [
    `GitHub authentication provider：${info.providerAvailable ? '存在' : (info.hasPat ? '未检测到（PAT 模式可用）' : '未检测到')}`,
    `VS Code GitHub session：${info.session ? `存在（${info.session.account.label}）` : (info.hasPat ? '未检测到（当前使用 PAT）' : '未检测到')}`,
    `GitHub 官方扩展：${official.length ? `已安装（${official.map(extension => extension.id).join(', ')}）` : '未安装'}`,
    `已配置 PAT：${info.hasPat ? '是（SecretStorage，插件将使用它访问 API）' : '否'}`
  ];
  try {
    const user = await client.currentUser();
    lines.push(`PAT 对应的 GitHub 账号：${user.login}`);
  } catch (error) {
    lines.push(`PAT 验证：${error.userMessage || error.message}`);
  }
  const detail = info.providerError ? `\nProvider 检查：${info.providerError}` : '';
  const choice = await vscode.window.showInformationMessage(lines.join('\n') + detail, { modal: true }, '设置 Token');
  if (choice) await vscode.commands.executeCommand('githubPersonalDashboard.setToken');
}

async function showDashboard(data) {
  const sections = [
    { key: 'issues', label: `$(issues) Issues · ${data.issues.length}`, detail: '分配给你或由你创建的开放 Issue' },
    { key: 'prs', label: `$(git-pull-request) Pull Requests · ${data.prs.length}`, detail: '由你创建的开放 Pull Request，标题前显示 CI 状态' },
    { key: 'notifications', label: `$(bell) Notifications · ${data.notifications.length}`, detail: 'GitHub 未读通知' }
  ];
  while (true) {
    const selected = await vscode.window.showQuickPick(sections, {
      title: `GitHub 个人工作台 · ${data.user.login}`,
      placeHolder: '选择一个栏目查看详细信息'
    });
    if (!selected) return;
    const items = data[selected.key].map(item => ({
      label: item.title,
      description: item.repoName || 'GitHub',
      detail: item.detail,
      item
    }));
    items.unshift({ label: '← 返回上一级', description: '返回栏目选择', isBack: true });
    const picked = await vscode.window.showQuickPick(items, {
      title: `${selected.label} · ${data.user.login}`,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: data[selected.key].length ? '选择条目查看详情，或返回上一级' : '暂无内容；选择“返回上一级”'
    });
    if (!picked || picked.isBack) continue;
    const action = await vscode.window.showInformationMessage(
      picked.label,
      { modal: true, detail: `${picked.description || ''}\n\n${picked.detail || ''}`.trim() },
      '在 GitHub 中打开', '返回列表'
    );
    if (action === '在 GitHub 中打开') vscode.env.openExternal(vscode.Uri.parse(picked.item.html_url));
  }
}

class GitHubClient {
  constructor(context) { this.context = context; this.cache = null; this.cacheAt = 0; }

  async getAuthInfo() {
    const hasPat = Boolean(await this.context.secrets.get(TOKEN_KEY));
    let providerAvailable = false; let providerError; let session;
    try {
      const providerIds = typeof vscode.authentication.getProviderIds === 'function'
        ? vscode.authentication.getProviderIds() : [];
      providerAvailable = providerIds.includes('github');
      if (typeof vscode.authentication.getSessions === 'function') {
        const sessions = await vscode.authentication.getSessions('github');
        providerAvailable = providerAvailable || Array.isArray(sessions);
        session = sessions && sessions[0];
      } else if (typeof vscode.authentication.getSession === 'function') {
        // Older VS Code versions expose getSession but not getSessions. Silent
        // lookup keeps diagnostics from opening a sign-in prompt.
        session = await vscode.authentication.getSession('github', REQUIRED_SCOPES, {
          createIfNone: false, silent: true
        });
        providerAvailable = providerAvailable || Boolean(session);
      } else if (!providerAvailable) {
        providerError = '当前 VS Code 不支持 GitHub authentication API';
      }
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (/no authentication provider|provider.*not found|not registered/i.test(message)) {
        providerAvailable = false;
      } else {
        providerError = message;
      }
    }
    return { providerAvailable, session, hasPat, providerError };
  }

  async getToken() {
    const info = await this.getAuthInfo();
    if (info.session && info.session.accessToken) return { token: info.session.accessToken, source: 'session', info };
    const token = await this.context.secrets.get(TOKEN_KEY);
    if (token) return { token, source: 'pat', info };
    const error = new Error(info.providerAvailable ? '未登录 GitHub' : 'VS Code 没有 GitHub authentication provider');
    error.code = info.providerAvailable ? 'NO_GITHUB_LOGIN' : 'NO_PROVIDER';
    error.userMessage = info.providerAvailable
      ? 'VS Code 中没有 GitHub 登录会话。请安装并登录 GitHub 官方扩展，或设置一个 Personal Access Token。'
      : '当前 VS Code 没有 GitHub authentication provider。请安装 GitHub Pull Requests and Issues 官方扩展，或设置一个 Personal Access Token。';
    throw error;
  }

  async currentUser() {
    const auth = await this.getToken();
    return this.request('/user', auth.token, auth.source);
  }

  async formatPullRequest(item, token, source) {
    let ciState = 'pending';
    let ciError = '';
    try {
      const repository = repoFromUrl(item.repository_url);
      const pull = await this.request(`/repos/${repository}/pulls/${item.number}`, token, source);
      const sha = pull.head?.sha;
      if (!sha) throw new Error('GitHub 未返回 PR head commit');
      // Read checks on the PR repository, including all pages before declaring success.
      const runs = [];
      for (let page = 1; ; page++) {
        const checks = await this.request(`/repos/${repository}/commits/${sha}/check-runs?per_page=100&page=${page}`, token, source);
        if (!Array.isArray(checks.check_runs)) throw new Error('Checks 响应格式无效');
        runs.push(...checks.check_runs);
        if (checks.check_runs.length < 100) {
          if (checks.total_count > runs.length) throw new Error('Checks 数据尚不完整');
          break;
        }
      }
      const allCompleted = runs.length > 0 && runs.every(run => run.status === 'completed');
      const failed = runs.some(run => run.status === 'completed' && ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(run.conclusion));
      const passed = allCompleted && runs.every(run => ['success', 'skipped'].includes(run.conclusion));
      // Explicit failures win; neutral, missing and unknown results are not failures.
      ciState = failed ? 'failure' : passed ? 'success' : 'pending';
      if (!runs.length) ciError = '等待 GitHub 提供 Checks';
    } catch (error) {
      ciError = `暂无法确认全部 Checks：${error.message || '读取失败'}`;
    }
    return formatPullRequest(item, ciState, ciError);
  }

  async load(force = false) {
    if (!force && this.cache && Date.now() - this.cacheAt < DATA_CACHE_MS) return this.cache;
    const auth = await this.getToken();
    const token = auth.token;
    const user = await this.request('/user', token, auth.source);
    const assigneeQuery = encodeURIComponent(`assignee:${user.login} is:issue state:open`);
    const authorIssueQuery = encodeURIComponent(`author:${user.login} is:issue state:open`);
    const prQuery = encodeURIComponent(`author:${user.login} is:pr state:open`);
    const [assignedIssues, authoredIssues, prs, notifications] = await Promise.all([
      this.request(`/search/issues?q=${assigneeQuery}&sort=updated&per_page=30`, token, auth.source),
      this.request(`/search/issues?q=${authorIssueQuery}&sort=updated&per_page=30`, token, auth.source),
      this.request(`/search/issues?q=${prQuery}&sort=updated&per_page=30`, token, auth.source),
      this.request('/notifications?all=false&per_page=30', token, auth.source)
    ]);
    const issueItems = [...(assignedIssues.items || []), ...(authoredIssues.items || [])];
    const uniqueIssues = [...new Map(issueItems.map(item => [item.id || item.html_url, item])).values()];
    const pullRequests = await Promise.all((prs.items || []).map(item => this.formatPullRequest(item, token, auth.source)));
    const result = { user, issues: uniqueIssues.map(formatIssue), assignedIssues: (assignedIssues.items || []).map(formatIssue), prs: pullRequests, notifications: (notifications || []).map(formatNotification) };
    this.cache = result; this.cacheAt = Date.now(); return result;
  }

  request(path, token, source) {
    const base = vscode.workspace.getConfiguration('githubPersonalDashboard').get('apiBaseUrl', 'https://api.github.com').replace(/\/$/, '');
    return new Promise((resolve, reject) => {
      const target = /^https?:\/\//.test(path) ? path : `${base}${path}`;
      const req = https.get(target, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` } }, response => {
        let body = ''; response.setEncoding('utf8'); response.on('data', chunk => body += chunk);
        response.on('end', () => {
          let json; try { json = JSON.parse(body); } catch (_) { json = {}; }
          if (response.statusCode >= 200 && response.statusCode < 300) return resolve(json);
          const error = new Error(json.message || `HTTP ${response.statusCode}`);
          error.statusCode = response.statusCode; error.path = path; error.code = response.statusCode === 401 ? 'INVALID_TOKEN' : response.statusCode === 403 ? 'INSUFFICIENT_PERMISSIONS' : 'API_ERROR';
          error.userMessage = response.statusCode === 401
            ? `${source === 'session' ? 'VS Code GitHub session' : 'GitHub PAT'} 无效或已过期（401）。请重新登录或更新 Token。`
            : response.statusCode === 403 ? `GitHub Token 权限不足，或 GitHub API 请求受限（403）：${error.message}`
            : `GitHub API 请求失败（${response.statusCode}，${path}）：${error.message}`;
          reject(error);
        });
      });
      req.on('error', error => { error.code = 'API_ERROR'; error.userMessage = `GitHub API 请求失败：${error.message}`; reject(error); });
      req.setTimeout(8000, () => req.destroy(Object.assign(new Error('请求超时'), { code: 'API_ERROR', userMessage: 'GitHub API 请求超时，请检查网络连接。' })));
    });
  }
}

function getReminders(previous, current) {
  if (!previous) return { items: [] };
  const key = item => item.id || item.html_url || item.title;
  const previousAssigned = new Set((previous.assignedIssues || []).map(key));
  const previousNotifications = new Set((previous.notifications || []).map(key));
  const previousPrs = new Map((previous.prs || []).map(item => [key(item), item.ciState]));
  const items = [];
  (current.prs || []).filter(item => item.ciState === 'success' && previousPrs.get(key(item)) && previousPrs.get(key(item)) !== 'success')
    .forEach(item => items.push({ key: `pr:${key(item)}`, type: 'pr', text: 'PR CI 已通过' }));
  (current.assignedIssues || []).filter(item => !previousAssigned.has(key(item)))
    .forEach(item => items.push({ key: `issue:${key(item)}`, type: 'issue', text: '新分配 Issue' }));
  (current.notifications || []).filter(item => !previousNotifications.has(key(item)))
    .forEach(item => items.push({ key: `notification:${key(item)}`, type: 'notification', text: '新通知' }));
  return { items };
}

function updateStatus(status, data, pendingReminders) {
  const counts = { pr: 0, issue: 0, notification: 0 };
  for (const item of pendingReminders.values()) counts[item.type]++;
  const labels = [];
  if (counts.pr) labels.push(`✅${counts.pr}`);
  if (counts.issue) labels.push(`📌${counts.issue}`);
  if (counts.notification) labels.push(`🔔${counts.notification}`);
  const detail = [...pendingReminders.values()].map(item => item.text);
  status.text = `$(github) ${data.user.login} · ${data.notifications.length} 通知${labels.length ? ` · ${labels.join(' ')}` : ''}`;
  status.tooltip = `GitHub 个人工作台 · ${data.user.login}\n${detail.length ? `待查看提醒：${detail.join('、')}\n点击打开后清除提醒` : '暂无待查看提醒'}\n点击查看 Issues、Pull Requests 和 Notifications`;
}

function repoFromUrl(url) {
  return url ? url.split('/').slice(-2).join('/') : '';
}
function ciIcon(state) {
  if (state === 'success') return '✅';
  if (state === 'pending') return '🔄';
  if (state === 'failure' || state === 'error') return '❌';
  return '⚪';
}
function displayTime(value) { return value ? new Date(value).toLocaleString() : '时间未知'; }
function listLabel(item) {
  const repo = item.repoName || item.description || 'GitHub';
  const title = item.title || '无标题';
  return `${title.padEnd(58, ' ')}${repo}`;
}

function cleanText(value) { return String(value || '').replace(/\r?\n/g, ' ').replace(/^\s*#{1,6}\s*/gm, '').replace(/[`*_~]/g, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^\s*[-+*>]\s*/gm, '').replace(/\s+/g, ' ').trim(); }
function truncateTitle(value, max = 52) { const clean = cleanText(value); return clean && clean.length > max ? `${clean.slice(0, max - 1)}…` : (clean || '无标题'); }
const repoColors = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤'];
function repoMarker(repo) { let hash = 0; for (const char of repo) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return repoColors[hash % repoColors.length]; }
function repoLabel(url) { const repo = url ? repoFromUrl(url) : 'GitHub'; return `${repoMarker(repo)} ${repo}`; }
function formatIssue(item) { const repo = item.repository_url ? repoFromUrl(item.repository_url) : 'GitHub'; return { title: truncateTitle(item.title), fullTitle: cleanText(item.title), description: '', repoName: repoLabel(item.repository_url), detail: `时间：${displayTime(item.updated_at)}\n详情：${item.body ? cleanText(item.body).slice(0, 300) : '无描述'}\n完整标题：${cleanText(item.title) || '无标题'}`, html_url: item.html_url }; }
function formatPullRequest(item, ciState, ciError) { const repo = item.repository_url ? repoFromUrl(item.repository_url) : 'GitHub'; return { title: `${ciIcon(ciState)} ${truncateTitle(item.title)}`, fullTitle: cleanText(item.title), description: '', repoName: repoLabel(item.repository_url), detail: `时间：${displayTime(item.updated_at)}\n详情：${item.body ? cleanText(item.body).slice(0, 300) : '无描述'}\nCI：${ciState}${ciError ? `（${ciError}）` : ''}\n完整标题：${cleanText(item.title) || '无标题'}`, html_url: item.html_url, ciState }; }
function formatNotification(item) { const subject = item.subject || {}; const number = subject.url ? subject.url.split('/').pop() : ''; const repositoryUrl = item.repository?.html_url || `https://github.com/${item.repository?.full_name || ''}`; const subjectPath = subject.type === 'PullRequest' ? 'pull' : 'issues'; const repo = item.repository?.full_name || '未知'; return { title: truncateTitle(cleanText(subject.title) || 'GitHub 通知'), fullTitle: cleanText(subject.title) || 'GitHub 通知', description: '', repoName: `${repoMarker(repo)} ${repo}`, detail: `时间：${displayTime(item.updated_at)}\n详情：${cleanText(item.reason) || '参与者'} · 类型：${subject.type || '未知'}\n完整标题：${cleanText(subject.title) || 'GitHub 通知'}`, html_url: `${repositoryUrl}/${subjectPath}/${number}` }; }

function deactivate() {}
module.exports = { activate, deactivate, GitHubClient };

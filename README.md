# GitHub Personal Dashboard

[简体中文](#简体中文) | [English](#english)

## 简体中文

### 背景与介绍

GitHub Personal Dashboard 是一个 VS Code 扩展，将个人 GitHub Issues、Pull Requests、CI 检查状态和未读通知集中到编辑器状态栏入口，减少编码时反复切换浏览器，也帮助你发现新分配的任务和检查结果变化。

当前版本 **0.1.24**，由 **Lanxiao** 维护，采用 [MIT License](LICENSE)。这是第三方项目，不是 GitHub 官方扩展。

### 功能

| 栏目 / 功能 | 内容 |
| --- | --- |
| Issues | 分配给你或由你创建的未关闭 Issue，合并去重 |
| Pull Requests | 由你创建的未关闭 PR，以及当前 head 提交的 Checks 状态 |
| Notifications | GitHub 未读通知 |
| 详情与跳转 | 展示标题、仓库、更新时间和摘要，可在浏览器打开条目 |
| 状态栏提醒 | 新分配 Issue、新通知、已跟踪 PR 的 CI 从非通过变为通过 |
| 自动刷新 | 默认每 3 分钟刷新，点击入口或执行命令可强制刷新 |
| 认证诊断 | 查看登录会话、PAT 配置和 API 用户验证结果 |

长标题自动截断，详情保留完整标题；同一仓库使用稳定的彩色标记。

### CI 图标含义

| 图标 | 判定 |
| --- | --- |
| ❌ | 任一已完成检查的结论为 `failure`、`timed_out`、`cancelled`、`action_required` 或 `startup_failure`，优先于其他仍在运行的检查 |
| ✅ | Checks 非空、全部完成，且每项结论均为 `success` 或 `skipped` |
| 🔄 | 没有明确失败，但尚未满足通过条件；也包括 `neutral`、未知结论、没有 Checks 或读取失败 |

检查会读取所有分页后再判定。若 API 读取失败或数据不完整，将显示待确认和错误说明。图标仅汇总 **Checks API**，不代表分支保护、审批要求、可合并性或仅通过旧 Commit Status API 上报的 CI。

### 安装

要求：VS Code **1.85.0+**，能够访问 GitHub API；源码打包需要 **Python 3**。

```bash
git clone https://github.com/Lanxiao12345/github-personal-dashboard.git
cd github-personal-dashboard
python3 scripts/package_vsix.py
```

在 VS Code 扩展面板右上角 **… → 从 VSIX 安装… / Install from VSIX…**，选择生成的 `github-personal-dashboard-0.1.24.vsix`，按提示重新加载窗口。

如已安装 `code` 命令，也可以执行：

```bash
code --install-extension github-personal-dashboard-0.1.24.vsix
```

如果安装过发布者为 `local` 的旧版本，请先卸载旧版，避免两个扩展同时运行。当前标识为 `Lanxiao.github-personal-dashboard`。本项目未发布到 VS Code Marketplace。

### 认证与首次使用

扩展**优先复用 VS Code 已有的 GitHub 登录会话**；没有可用会话时才使用保存的个人访问令牌（PAT）。浏览器登录并不等于 VS Code 已有认证会话。PAT 模式不要求安装 GitHub Pull Requests and Issues 扩展。

使用 PAT：

1. 打开 [GitHub Classic PAT 创建页面](https://github.com/settings/tokens/new)，设置用途和有效期。
2. 根据访问需求选择权限：`read:user`、`notifications`；需要私有仓库访问时通常需要 `repo`，该权限范围较广。若组织要求 SSO，还需完成对应授权。
3. 打开 VS Code 命令面板（macOS：`Cmd+Shift+P`；Windows/Linux：`Ctrl+Shift+P`）。
4. 执行 **GitHub Dashboard: Set Personal Access Token**，在密码输入框中粘贴令牌。
5. 执行 **GitHub Dashboard: Diagnose Authentication**，确认账号和 API 访问情况。
6. 点击状态栏 **GitHub**，选择 Issues、Pull Requests 或 Notifications，再选择条目查看详情或打开网页。

PAT 存入 VS Code `SecretStorage`，不写入项目设置。不要将真实令牌写入源码或提交到仓库。细粒度 PAT 的接口支持和权限配置与 Classic PAT 不同，请核对用户、搜索、通知、PR 和 Checks 接口所需权限；身份验证成功不代表所有接口都有权限。

如果 VS Code 会话和 PAT 属于不同账号，实际请求仍优先使用会话。当前诊断窗口中部分文字固定标注“PAT”，请以实际账号与会话情况为准。清除 PAT 不会退出 VS Code 的 GitHub 会话。

### 命令

| 命令 | 用途 |
| --- | --- |
| `GitHub Dashboard: Open` | 强制刷新并打开工作台 |
| `GitHub Dashboard: Refresh` | 强制刷新数据 |
| `GitHub Dashboard: Set Personal Access Token` | 保存或替换 PAT |
| `GitHub Dashboard: Clear Personal Access Token` | 删除保存的 PAT |
| `GitHub Dashboard: Diagnose Authentication` | 查看认证诊断 |

### 刷新与提醒

首次成功读取数据只建立比较基线。后续刷新发现变化时，状态栏显示：

- `✅1`：1 个此前已跟踪的 PR，CI 从非通过变为通过。
- `📌2`：新发现 2 个分配给你的 Issue。
- `🔔3`：新发现 3 条未读通知。

提醒保存在内存中并持续到打开、退出工作台后清除；重载窗口或重启后也会重置。清除这些本地提醒**不会**在 GitHub 上将通知标记为已读。新出现但已经通过 CI 的 PR 不产生“从非通过变为通过”的提醒。

点击状态栏、Refresh 命令和定时刷新会请求最新数据。非强制加载有 60 秒缓存；设置 PAT 后如果仍看到旧数据，可执行 Refresh。

### 设置

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `githubPersonalDashboard.refreshIntervalMinutes` | `3` | 自动刷新间隔（分钟）；`0` 关闭自动刷新。修改后重新加载窗口使定时设置生效 |
| `githubPersonalDashboard.apiBaseUrl` | `https://api.github.com` | API 地址，可配置企业服务器的 HTTPS API 地址，例如 `https://github.example.com/api/v3` |

API 请求会把当前认证令牌发送到配置的地址，因此只应配置你信任的 GitHub API 服务。企业服务器还需要与该主机匹配的凭据；当前自动会话查找使用 `github` provider，未实现企业主机专用认证会话选择。

### 已知边界与故障处理

- 每个搜索查询最多读取 30 条：Issues 合并两组查询后去重，PR 最多 30 条，通知最多 30 条。这些列表未实现完整分页；Checks 会完整分页。
- CI 是 Checks 汇总，不是所有 GitHub 合并条件的总览。🔄 不一定表示正在运行，也可能表示未知或请求失败。
- 列表和提示主要使用中文；README 提供中英双语，不代表界面已完整本地化。
- 通知网页跳转主要针对 Issue 和 PR；其他通知类型的链接可能无法正确定位。
- `401`：检查令牌或会话是否过期；`403`：检查权限、SSO 和限流；身份接口成功但列表失败时，按具体失败接口排查。
- 加载速度受网络、PR 数量和 Checks 页数影响。单次 HTTP 请求超时为 8 秒。
- 本地单元测试未覆盖真实账号登录、企业服务器或所有 Remote SSH 环境。

### 开发与验证

项目使用原生 JavaScript，无第三方运行时依赖。安装 Node.js 18+ 后运行：

```bash
npm run check
npm test
npm run package
```

`npm test` 使用 Node.js 测试框架，模拟 VS Code API 和 GitHub 响应，覆盖强制刷新、CI 状态优先级以及分页检查，不访问真实 GitHub。用 VS Code 打开本目录，按 `F5` 启动 Extension Development Host 进行交互验证。

| 文件 | 用途 |
| --- | --- |
| `extension.js` | 状态栏、工作台、认证、API 请求、CI 汇总与提醒 |
| `tests/refresh.cjs` | 现有刷新与 CI 回归测试 |
| `scripts/package_vsix.py` | 使用 Python 标准库生成 VSIX |
| `package.json` | 命令、设置和扩展元数据 |

反馈请提交至 [Issues](https://github.com/Lanxiao12345/github-personal-dashboard/issues)，附上版本、复现步骤及已移除敏感信息的错误内容。更新记录见 [CHANGELOG.md](CHANGELOG.md)。

## English

### Background and overview

GitHub Personal Dashboard is a VS Code extension that brings personal GitHub issues, pull requests, CI check results, and unread notifications into a status bar dashboard. It reduces browser switching while coding and helps you notice new assignments and changes in CI results.

Current version: **0.1.24**. Maintained by **Lanxiao**, licensed under the [MIT License](LICENSE). This is a third-party project, not an official GitHub extension.

### Features

| Section / feature | What it shows |
| --- | --- |
| Issues | Open issues assigned to you or authored by you, merged and deduplicated |
| Pull Requests | Your open pull requests and Checks for their current head commits |
| Notifications | Unread GitHub notifications |
| Details and links | Titles, repositories, update times, summaries, and browser links |
| Status bar reminders | New assignments, new notifications, and previously tracked PRs whose CI changes to passing |
| Automatic refresh | Every 3 minutes by default; clicking the entry or using Refresh forces an update |
| Authentication diagnostics | Session availability, PAT configuration, and API user lookup |

Long titles are shortened in lists, with the full title in details. Each repository receives a consistent colored marker.

### CI indicators

| Icon | Meaning |
| --- | --- |
| ❌ | Any completed check has `failure`, `timed_out`, `cancelled`, `action_required`, or `startup_failure`; explicit failures take priority over running checks |
| ✅ | Checks are nonempty, all completed, and every conclusion is `success` or `skipped` |
| 🔄 | No explicit failure, but not confirmed passing; includes neutral/unknown results, no Checks, and read errors |

All Checks pages are read before classification. Failed requests or incomplete responses produce an unresolved state and an explanation. This summarizes the **Checks API**, not branch protection, reviews, mergeability, or CI reported only through the legacy Commit Status API.

### Installation

Requirements: VS Code **1.85.0+**, network access to GitHub's API, and **Python 3** to build from source.

```bash
git clone https://github.com/Lanxiao12345/github-personal-dashboard.git
cd github-personal-dashboard
python3 scripts/package_vsix.py
```

In VS Code, choose **Extensions → … → Install from VSIX…**, select `github-personal-dashboard-0.1.24.vsix`, and reload when prompted. If the `code` CLI is available:

```bash
code --install-extension github-personal-dashboard-0.1.24.vsix
```

Uninstall older versions published as `local` to avoid running two copies. The current identifier is `Lanxiao.github-personal-dashboard`. This extension is not published to the VS Code Marketplace.

### Authentication and first use

The extension **prefers an existing VS Code GitHub session** and falls back to a saved personal access token (PAT). Signing into GitHub in a browser does not automatically create a VS Code session. PAT mode does not require the GitHub Pull Requests and Issues extension.

1. Create a [Classic GitHub PAT](https://github.com/settings/tokens/new) with an expiration date.
2. Select permissions for the resources you need: `read:user`, `notifications`, and typically `repo` for private repositories. The `repo` scope is broad. Authorize organization SSO if required.
3. Open the Command Palette with **Cmd+Shift+P** on macOS or **Ctrl+Shift+P** on Windows/Linux.
4. Run **GitHub Dashboard: Set Personal Access Token** and enter your token in the password field.
5. Run **GitHub Dashboard: Diagnose Authentication** to inspect the account and API access.
6. Click **GitHub** in the status bar, choose a section, then select an entry to view details or open its page.

PATs are stored in VS Code `SecretStorage`, not project settings. Do not commit real tokens to source control. Fine-grained PAT support and permissions differ by endpoint; verify access to user lookup, search, notifications, pull requests, and Checks. Successful user lookup does not prove that every endpoint is authorized.

If the session and PAT belong to different accounts, the session still takes precedence. Some diagnostic labels currently say “PAT” even when a session is used; interpret them alongside the reported account and session. Clearing a PAT does not sign out of the VS Code GitHub session.

### Commands

| Command | Purpose |
| --- | --- |
| `GitHub Dashboard: Open` | Force a refresh and open the dashboard |
| `GitHub Dashboard: Refresh` | Force a data refresh |
| `GitHub Dashboard: Set Personal Access Token` | Save or replace a PAT |
| `GitHub Dashboard: Clear Personal Access Token` | Remove the saved PAT |
| `GitHub Dashboard: Diagnose Authentication` | Inspect authentication |

### Refresh and reminders

The first successful load establishes a baseline without notifying about existing items. Later refreshes can display:

- `✅1`: one previously tracked PR changed from non-passing CI to passing.
- `📌2`: two newly observed assigned issues.
- `🔔3`: three newly observed unread notifications.

Reminders remain in memory until you open and exit the dashboard, or reload/restart VS Code. Clearing these reminders **does not mark GitHub notifications as read**. A newly observed PR that is already passing does not generate a CI-transition reminder.

Status bar clicks, the Refresh command, and scheduled refreshes request fresh data. Non-forced loads have a 60-second cache; use Refresh if old data remains after setting a PAT.

### Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `githubPersonalDashboard.refreshIntervalMinutes` | `3` | Refresh interval in minutes; `0` disables automatic refresh. Reload the window after changing the interval |
| `githubPersonalDashboard.apiBaseUrl` | `https://api.github.com` | API base URL; an enterprise HTTPS API can use a value such as `https://github.example.com/api/v3` |

Requests send the active authentication token to the configured API address, so use only a trusted GitHub API service. Enterprise servers require credentials for that host. Automatic session lookup currently uses the `github` provider and does not implement enterprise-host-specific session selection.

### Limitations and troubleshooting

- Each issue search returns at most 30 items; assigned/authored results are merged and deduplicated. PRs and notifications are each capped at 30. These lists do not implement full pagination; Checks do.
- CI icons summarize Checks rather than every merge requirement. 🔄 can mean unknown or failed to load, rather than actively running.
- Most UI text is currently Chinese. Bilingual documentation does not imply a fully localized interface.
- Notification links mainly target issues and pull requests; other notification types may not resolve correctly.
- For `401`, check expired credentials. For `403`, inspect permissions, SSO, and rate limits. If user lookup succeeds but lists fail, inspect the failing endpoint.
- Latency depends on the network, PR count, and Checks pages. Each HTTP request has an 8-second timeout.
- Local unit tests do not cover live sign-in, enterprise hosts, or all Remote SSH environments.

### Development and verification

This project uses plain JavaScript without third-party runtime dependencies. With Node.js 18+ installed:

```bash
npm run check
npm test
npm run package
```

Tests use the Node.js test runner with mocked VS Code APIs and GitHub responses. They cover forced refresh, CI priority rules, and paginated Checks without contacting GitHub. Open the directory in VS Code and press **F5** to launch an Extension Development Host for manual verification.

| File | Purpose |
| --- | --- |
| `extension.js` | Status bar, dashboard, authentication, API requests, CI state, and reminders |
| `tests/refresh.cjs` | Existing refresh and CI regression tests |
| `scripts/package_vsix.py` | Build a VSIX using the Python standard library |
| `package.json` | Extension metadata, commands, and settings |

Report bugs and suggestions in [Issues](https://github.com/Lanxiao12345/github-personal-dashboard/issues), including the version, reproduction steps, and errors with sensitive data removed. See [CHANGELOG.md](CHANGELOG.md) for changes and [LICENSE](LICENSE) for the MIT license.

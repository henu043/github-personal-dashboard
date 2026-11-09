const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup() {
  const commands = new Map();
  const vscode = {StatusBarAlignment:{Left:0},window:{createStatusBarItem:()=>({show(){}}),showQuickPick:async()=>undefined},commands:{registerCommand:(name,fn)=>commands.set(name,fn)},workspace:{getConfiguration:()=>({get:()=>0})}};
  const sandbox = {require:name=>name==='vscode'?vscode:require(name),module:{exports:{}},setInterval,clearInterval};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../extension.js'),'utf8'),sandbox);
  return {...sandbox.module.exports,commands};
}
test('status bar click requests a fresh snapshot',async()=>{
 const {activate,GitHubClient,commands}=setup();
 let forced;
 GitHubClient.prototype.load=async force=>{forced=force;return {user:{login:'test'},issues:[],prs:[],notifications:[]};};
 activate({subscriptions:[]});
 await commands.get('githubPersonalDashboard.open')();
 assert.equal(forced,true);
});
test('forced refresh updates CI even when PR updated_at is unchanged',async()=>{
 const {GitHubClient}=setup(); const client=new GitHubClient({});
 client.getToken=async()=>({token:'fixture',source:'pat'});
 let state='in_progress';
 client.request=async path=>{
 if(path==='/user')return {login:'test'};
 if(path.startsWith('/notifications'))return [];
 if(path.startsWith('/search/issues'))return {items:path.includes('is%3Apr')?[{html_url:'https://github.com/a/b/pull/1',repository_url:'https://api.github.com/repos/a/b',number:1,updated_at:'unchanged'}]:[]};
 if(path.includes('check-runs'))return {check_runs:[{status:state,conclusion:state==='completed'?'success':null}]};
 if(path.endsWith('/status'))return {state:'success'};
 return {head:{sha:'same',repo:{full_name:'a/b'}}};
 };
 assert.equal((await client.load(true)).prs[0].ciState,'pending');
 state='completed';
 assert.equal((await client.load(true)).prs[0].ciState,'success');
});
for (const [name, conclusions, expected] of [
 ['success and skipped',['success','skipped'],'success'],
 ['neutral is unresolved',['success','neutral'],'pending'],
 ['running check',['success',null],'pending'],
 ['failed check while others run',['failure',null],'failure'],
 ['neutral while others run',['neutral',null],'pending'],
 ['failed check',['success','failure'],'failure'],
 ['timed out check',['timed_out',null],'failure'],
 ['cancelled check',['cancelled',null],'failure'],
 ['action required',['action_required','success'],'failure'],
 ['startup failure',['startup_failure','success'],'failure'],
 ['unknown conclusion',['unexpected','success'],'pending'],
 ['no checks',[],'pending'],
 ['unavailable checks',null,'pending'],
 ['failure on second page',[...Array(100).fill('success'),'failure'],'failure']
]) test(name,async()=>{
 const {GitHubClient}=setup(); const client=new GitHubClient({});
 client.request=async path=>{
  if(path.includes('check-runs')) {
   if(conclusions===null) throw new Error('checks unavailable');
   const page=Number(new URL(path,'https://api.github.com').searchParams.get('page')||1);
   return {total_count:conclusions.length,check_runs:conclusions.slice((page-1)*100,page*100).map(conclusion=>({status:conclusion===null?'in_progress':'completed',conclusion}))};
  }
  if(path.endsWith('/status')) return {state:'success'};
  return {head:{sha:'same'}};
 };
 const result=await client.formatPullRequest({repository_url:'https://api.github.com/repos/a/b',number:1},'fixture','pat');
 assert.equal(result.ciState,expected);
});

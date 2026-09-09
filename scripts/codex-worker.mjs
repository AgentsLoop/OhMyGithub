import { appendFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const env = process.env;
const state = env.CODEX_STATE_DIR;
const runtime = env.RUNTIME_DIR;
const repo = env.GITHUB_REPOSITORY;
const issue = Number(env.TRIGGER_ISSUE_NUMBER);
const runUrl = `https://github.com/${repo}/actions/runs/${env.GITHUB_RUN_ID}`;
const labels = JSON.parse(env.LABELS_JSON || '[]');
const mock = labels.includes('test');
const project = resolve(env.GITHUB_WORKSPACE, mock ? 'workflow-test-project' : env.PROJECT_PATH || '.');
const projectPath = relative(env.GITHUB_WORKSPACE, project) || '.';
if (projectPath.startsWith('..') || projectPath.startsWith('/')) throw new Error('PROJECT_DIR must be inside the checkout.');
mkdirSync(project, { recursive: true });
const releaseDir = join(state, 'release');
mkdirSync(releaseDir, { recursive: true });
const secrets = [env.GH_TOKEN, env.CODEX_WEB_CREDENTIAL, env.CODEX_WEB_CREDENTIAL?.split(':').slice(1).join(':')].filter(Boolean);
try {
  const auth = JSON.parse(readFileSync(join(env.CODEX_HOME, 'auth.json'), 'utf8'));
  const collect = value => {
    if (typeof value === 'string' && value.length > 12) secrets.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(auth);
} catch { /* Mock runs do not use credentials. */ }
const redact = value => secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value));
function command(file, args, cwd = project) {
  const start = Date.now();
  try { return execFileSync(file, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
  finally {
    const timing = `${file}: ${((Date.now() - start) / 1000).toFixed(2)}s`;
    console.log(timing);
    appendFileSync(join(releaseDir, 'execution.log'), timing + '\n');
  }
}
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
let commentId;
let access = `Run: [Actions](${runUrl})`;
async function progress(text) {
  const body = `🟡 **Codex progress (live)**\n\n${access}\n\n${redact(text).slice(-45000)}`;
  if (commentId) await api(`/issues/comments/${commentId}`, 'PATCH', { body });
  else commentId = (await api(`/issues/${issue}/comments`, 'POST', { body })).id;
}
async function status(name) {
  const colors = { 'in progress': 'FBCA04', validating: '1D76DB', complete: '0E8A16', failed: 'B60205' };
  for (const old of Object.keys(colors)) {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/labels/${encodeURIComponent(old)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${env.GH_TOKEN}` }, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok && response.status !== 404) throw new Error(`Cannot remove lifecycle label: ${response.status}`);
  }
  const response = await fetch(`https://api.github.com/repos/${repo}/labels`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.GH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color: colors[name] }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok && response.status !== 422) throw new Error(`Cannot create lifecycle label: ${response.status}`);
  await api(`/issues/${issue}/labels`, 'POST', { labels: [name] });
}

let socket, nextId = 0, fatal, mockServer;
const pending = new Map();
const completed = new Map();
let textOutput = '';
function rpc(method, params) {
  if (fatal) return Promise.reject(fatal);
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 60000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function connect() {
  socket = new WebSocket(env.CODEX_ENDPOINT);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Codex server connection timed out')), 30000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Codex server connection failed')); }, { once: true });
  });
  socket.addEventListener('close', () => {
    fatal = new Error('Codex server disconnected');
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(fatal); }
    pending.clear();
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.id !== undefined && !message.method) {
      const item = pending.get(message.id);
      if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }
      return;
    }
    // The worker runs without approval prompts. Fail explicitly if the protocol asks
    // for input that requires a person; do not leave an unattended RPC pending.
    if (message.id !== undefined) {
      socket.send(JSON.stringify({ id: message.id, error: { code: -32603, message: 'Unattended worker cannot answer this request.' } }));
      fatal = new Error(`Codex requires input: ${message.method}`);
      return;
    }
    if (message.method === 'turn/completed') completed.set(message.params.turn.id, message.params.turn);
    if (message.method === 'item/agentMessage/delta') textOutput += message.params.delta || '';
    if (message.method?.startsWith('turn/') || message.method === 'item/completed') {
      appendFileSync(join(releaseDir, 'codex-events.jsonl'), redact(JSON.stringify(message)) + '\n');
    }
  });
  await rpc('initialize', { clientInfo: { name: 'omgithub_worker', version: '1.0.0' } });
  socket.send(JSON.stringify({ method: 'initialized', params: {} }));
}
async function turn(threadId, prompt) {
  textOutput = '';
  const { turn } = await rpc('turn/start', { threadId, input: [{ type: 'text', text: prompt }] });
  const deadline = Date.now() + 90 * 60 * 1000;
  let updateAt = Date.now() + 15000;
  while (!completed.has(turn.id)) {
    if (fatal) throw fatal;
    if (Date.now() > deadline) {
      await rpc('turn/interrupt', { threadId, turnId: turn.id });
      throw new Error('Codex turn exceeded 90 minutes');
    }
    if (Date.now() >= updateAt) { await progress(textOutput || 'Codex is working.'); updateAt = Date.now() + 15000; }
    await delay(500);
  }
  const result = completed.get(turn.id);
  if (result.status !== 'completed') throw new Error(`Codex turn ${result.status}: ${result.error?.message || ''}`);
  await progress(textOutput || 'Codex completed the turn.');
  return result;
}
function attach(threadId) {
  const script = join(state, 'terminal.sh');
  writeFileSync(script, '#!/bin/bash\nset -euo pipefail\nexec codex resume --remote "$CODEX_ENDPOINT" "$CODEX_THREAD"\n', { mode: 0o700 });
  command('tmux', ['new-session', '-d', '-s', 'codex', '-c', project,
    '-e', `CODEX_THREAD=${threadId}`, '-e', `CODEX_ENDPOINT=${env.CODEX_ENDPOINT}`,
    '-e', `CODEX_HOME=${env.CODEX_HOME}`, script]);
}
async function healthy(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(10000) })).ok; } catch { return false; }
}
async function tunnel() {
  const log = join(state, 'app-tunnel.log');
  const { openSync, closeSync } = await import('node:fs');
  const fd = openSync(log, 'a');
  const child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:3000'], { detached: true, stdio: ['ignore', fd, fd] });
  closeSync(fd); child.unref();
  writeFileSync(join(state, 'app-tunnel.pid'), String(child.pid));
  for (let i = 0; i < 90; i++) {
    const url = readFileSync(log, 'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
    if (url && await healthy(url)) return url;
    await delay(2000);
  }
  throw new Error('Public app did not become available');
}
const screenshots = () => existsSync(join(project, 'screenshots')) ? readdirSync(join(project, 'screenshots')).filter(name => /^final-.*\.(png|jpe?g|webp)$/i.test(name)) : [];

try {
  await status('in progress');
  await progress('Preparing Codex.');
  command('git', ['config', 'user.name', 'github-actions[bot]']);
  command('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  command('git', ['checkout', '-b', `codex/${env.GITHUB_RUN_ID}`]);
  const exclude = command('git', ['rev-parse', '--git-path', 'info/exclude']).trim();
  appendFileSync(resolve(project, exclude), '\n/.omgithub-runtime/\n/.agentsweb/\nnode_modules/\n*.log\n*.pid\n' + (projectPath === '.' ? '/.agents/\n/screenshots/\n' : `/${projectPath}/.agents/\n/${projectPath}/screenshots/\n`));
  let buildId = 'mock', verificationId;
  if (mock) {
    cpSync(join(runtime, '.github/fixtures/test-project'), project, { recursive: true });
    writeFileSync(join(releaseDir, 'codex-events.jsonl'), JSON.stringify({ mock: true, status: 'completed' }) + '\n');
    mockServer = spawn(process.execPath, ['start.mjs'], { cwd: project, stdio: 'ignore', env: { ...env, PORT: '3000' } });
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await healthy('http://127.0.0.1:3000')) { ready = true; break; }
      await delay(1000);
    }
    if (!ready || !existsSync(join(project, 'index.html'))) throw new Error('Mock project HTTP or entrypoint check failed');
  } else {
    await connect();
    const model = labels.find(label => label.startsWith('model/openai/'))?.slice('model/openai/'.length);
    const templateDir = join(runtime, '.github/templates');
    let instructions = readFileSync(join(templateDir, 'agents.template.md'), 'utf8');
    for (const name of readdirSync(templateDir).sort()) {
      if (name !== 'agents.template.md' && name.endsWith('.md') && labels.some(label => label.toLowerCase() === name.slice(0, -3).toLowerCase())) instructions += '\n' + readFileSync(join(templateDir, name), 'utf8');
    }
    instructions += '\nComplete the issue request, then return a final response. Let the workflow commit and push source changes. Keep screenshots and runtime files out of Git.\n';
    const { thread } = await rpc('thread/start', { cwd: project, model, approvalPolicy: 'never', sandbox: 'danger-full-access', developerInstructions: instructions });
    buildId = thread.id;
    writeFileSync(join(state, 'thread-id'), buildId);
    attach(buildId);
    const terminalUrl = readFileSync(join(state, 'terminal-url'), 'utf8').trim();
    access += `\n\n[Open Codex terminal](${terminalUrl})\n\nSession: \`${buildId}\``;
    if (existsSync(join(state, 'ssh-command'))) access += `\n\n\`\`\`sh\n${readFileSync(join(state, 'ssh-command'), 'utf8').trim()}\n\`\`\``;
    await progress('Codex terminal is ready.');
    const skills = labels.filter(label => label.startsWith('skill/')).map(label => '$' + label.slice(6)).join(' ');
    await turn(buildId, `${env.REQUEST}\n\n${skills}`);
    await status('validating');
    verificationId = (await rpc('thread/fork', { threadId: buildId })).thread.id;
    // Move the shared terminal to the validation task to avoid concurrent edits
    // from a second build turn while the workflow validates and publishes.
    try { command('tmux', ['kill-session', '-t', 'codex']); } catch { /* The terminal may already have detached. */ }
    attach(verificationId);
    await turn(verificationId, readFileSync(join(runtime, '.github/prompts/02-verify.md'), 'utf8').replaceAll('./Agents.md', 'the worker instructions'));
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((existsSync(join(project, 'index.html')) || existsSync(join(project, 'dist/index.html'))) && await healthy('http://127.0.0.1:3000')) break;
      if (attempt === 2) throw new Error('App entrypoint or local HTTP check failed');
      await turn(verificationId, 'Repair the playable index.html or dist/index.html and the persistent app-server tmux session on port 3000. Verify the app in the browser.');
    }
    let appUrl;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { appUrl = await tunnel(); break; }
      catch (error) {
        if (existsSync(join(state, 'app-tunnel.pid'))) { try { process.kill(Number(readFileSync(join(state, 'app-tunnel.pid'), 'utf8'))); } catch {} }
        writeFileSync(join(state, 'app-tunnel.log'), '');
        if (attempt === 2) throw error;
        await turn(verificationId, readFileSync(join(runtime, '.github/prompts/03-public-app-fix.md'), 'utf8'));
      }
    }
    access += `\n\n[Live app](${appUrl})`;
    for (let attempt = 0; attempt < 2 && screenshots().length === 0; attempt++) await turn(verificationId, 'Capture final browser screenshots under screenshots/ with filenames beginning final-.');
    // Close the editable terminal during the final Git snapshot.
    try { command('tmux', ['kill-session', '-t', 'codex']); } catch { /* The terminal may already have detached. */ }
  }
  for (const name of screenshots()) cpSync(join(project, 'screenshots', name), join(releaseDir, name));
  command('git', ['add', '-A', '--', projectPath], env.GITHUB_WORKSPACE);
  // Restore runtime paths to the frozen source index, including tracked skills.
  const runtimePaths = ['.omgithub-runtime', '.agentsweb', join(projectPath, '.agents')];
  command('git', ['reset', env.TARGET_SHA, '--', ...runtimePaths], env.GITHUB_WORKSPACE);
  const generated = command('git', ['ls-files', '-z', '--', projectPath], env.GITHUB_WORKSPACE).split('\0').filter(Boolean)
    .filter(path => /(?:^|\/)screenshots\/|\.(?:log|pid)$/.test(path));
  for (const path of generated) command('git', ['rm', '--cached', '--ignore-unmatch', '--', path], env.GITHUB_WORKSPACE);
  const message = join(state, 'commit-message');
  writeFileSync(message, `Codex: ${env.ISSUE_TITLE}\n\nImplement issue #${issue} using the Codex worker.\nPreserve the validated checkout and publish project source.\nVerification: ${mock ? 'Committed fixture delivery' : 'Codex validation, browser entrypoint and local/public HTTP checks'}.\nRun: ${runUrl}\nChat-ID: ${buildId}\n`);
  if (command('git', ['diff', '--cached', '--name-only']).trim()) command('git', ['commit', '--file', message]);
  const commit = command('git', ['rev-parse', 'HEAD']).trim();
  command('git', ['push', '--set-upstream', 'origin', `codex/${env.GITHUB_RUN_ID}`]);
  const tag = `codex-logs-${env.GITHUB_RUN_ID}`;
  command('gh', ['release', 'create', tag, ...readdirSync(releaseDir).map(name => join(releaseDir, name)), '--repo', repo, '--target', commit, '--title', `Codex logs for run #${env.GITHUB_RUN_NUMBER}`, '--notes', `Codex execution evidence: ${runUrl}`, '--latest=false']);
  const release = JSON.parse(command('gh', ['release', 'view', tag, '--repo', repo, '--json', 'url,assets']));
  const path = [ commit, projectPath === '.' ? '' : projectPath ].filter(Boolean).join('/').split('/').map(encodeURIComponent).join('/');
  const images = release.assets.filter(asset => /^final-/.test(asset.name)).map(asset => `![${asset.name}](${asset.url || asset.browserDownloadUrl})`).join('\n');
  await progress(`Completed.\n\n[Open project](https://omgithub.com/${repo}/tree/${path}) · [Commit](https://github.com/${repo}/commit/${commit}) · [Logs and screenshots](${release.url})\n\n${images}`);
  await status('complete');
  if (!mock) attach(verificationId);
} catch (error) {
  console.error(redact(error.stack || error));
  await progress(`Failed: ${redact(error.message)}\n\nSee [the run log](${runUrl}).`).catch(() => {});
  await status('failed').catch(() => {});
  process.exitCode = 1;
} finally { socket?.close(); mockServer?.kill(); }

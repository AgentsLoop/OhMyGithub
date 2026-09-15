import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { command } from './session-checkpoint.mjs'
import { child } from './session-lifecycle.mjs'

const env = process.env
const directory = join(env.RUNNER_TEMP, `validation-${env.CHECKPOINT_GENERATION}`)
const root = env.GITHUB_WORKSPACE
const project = join(directory, relative(root, env.PROJECT_DIR))
const base = `http://127.0.0.1:${env.OPENCODE_WEB_PORT}`
const main = readFileSync(join(env.OPENCODE_WEB_DIR, 'checkpoint-session-id'), 'utf8').trim()
const api = async (path, options = {}, workingDirectory = env.PROJECT_DIR) => {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', 'x-opencode-directory': workingDirectory }, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`OpenCode HTTP ${response.status}`)
  return response.json()
}
let fork
async function abort() { if (fork) await api(`/session/${fork.id}/abort`, { method: 'POST' }, project) }
const controller = new AbortController()
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { controller.abort(); void abort().catch(console.error) })
try {
  command('git', ['worktree', 'add', '--detach', directory, env.CHECKPOINT_COMMIT], { cwd: root })
  fork = await api(`/session/${main}/fork`, { method: 'POST', body: JSON.stringify({ messageID: env.MAIN_MESSAGE_ID }) })
  if (!fork.id?.startsWith('ses_')) throw new Error('No validation fork created')
  writeFileSync(join(env.OPENCODE_WEB_DIR, 'active-validation.json'), JSON.stringify({ id: fork.id, directory: project }))
  const prompt = `Validate the app in ${project}, an isolated snapshot. Keep tracked source files unchanged. Do not edit, fix, commit, push, or publish source. Install dependencies and build if needed. Start the preview on a free port, not port 3000. Run browser checks. Capture final screenshots in ${project}/screenshots/final-desktop.png and final-mobile.png. Stop any server you start before finishing. Return validation failed if the app does not work. Write ${project}/screenshots/validation.json with JSON {"passed":true} only when browser checks pass. Do not change the main session or its workspace.`
  await child(env.OPENCODE_BIN || join(env.HOME, '.opencode/bin/opencode'), ['run', '--auto', '--dangerously-skip-permissions', '--attach', base, '--dir', project, '--session', fork.id, '--model', readFileSync(join(env.OPENCODE_WEB_DIR, 'main-model'), 'utf8').trim(), prompt], { signal: controller.signal, cwd: project })
  if (controller.signal.aborted) throw new Error('Cancelled')
  if (command('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: directory })) throw new Error('Validation changed tracked source')
  if (JSON.parse(readFileSync(join(project, 'screenshots/validation.json'), 'utf8')).passed !== true) throw new Error('Browser validation did not pass')
  const screenshots = readdirSync(join(project, 'screenshots')).filter(name => /^final-.*\.(png|jpe?g|webp)$/i.test(name))
  if (!screenshots.length) throw new Error('Validation produced no screenshots')
  const archive = join(env.RUNNER_TEMP, `deployment-${env.CHECKPOINT_GENERATION}.zip`)
  // Package generated dist when present, otherwise the static project. Exclude
  // dependencies and runner state; materialization selects the HTML entrypoint.
  command('python3', ['-c', `import os,sys,zipfile
root,out=sys.argv[1:]
source=root
if os.path.isfile(os.path.join(root,'dist','index.html')): root=os.path.join(root,'dist')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for base,dirs,files in os.walk(root):
  dirs[:]=[d for d in dirs if d not in ['node_modules','.git','.opencode','.agents','.opencode-web']]
  for name in files:
   if name.startswith('.env') or name.endswith(('.log','.pid')): continue
   p=os.path.join(base,name)
   if not os.path.islink(p): z.write(p,os.path.relpath(p,root))
 if root!=source:
  for name in os.listdir(os.path.join(source,'screenshots')):
   p=os.path.join(source,'screenshots',name)
   if name.startswith('final-') and os.path.isfile(p): z.write(p,'screenshots/'+name)`, project, archive])
  const site = env.OMGITHUB_ORIGIN || 'https://omgithub.com'
  const response = await fetch(`${site}/api/github/${env.GITHUB_REPOSITORY}/issues/${env.TRIGGER_ISSUE_NUMBER}/deployment`, { method: 'POST', headers: {
    authorization: `Bearer ${env.GH_TOKEN || env.GITHUB_TOKEN}`, 'content-type': 'application/zip', 'x-omgithub-run': env.GITHUB_RUN_ID,
    'x-omgithub-generation': env.DEPLOYMENT_GENERATION, 'x-omgithub-commit': env.CHECKPOINT_COMMIT
  }, body: readFileSync(archive), signal: controller.signal })
  if (!response.ok) throw new Error(`Deployment HTTP ${response.status}: ${await response.text()}`)
  const deployed = await response.json()
  if (controller.signal.aborted) throw new Error('Cancelled')
  const tag = `opencode-checkpoint-${env.TRIGGER_ISSUE_NUMBER}`
  const assets = screenshots.map(name => {
    const path = join(env.RUNNER_TEMP, `${env.CHECKPOINT_GENERATION}-${name}`)
    writeFileSync(path, readFileSync(join(project, 'screenshots', name)))
    return path
  })
  command('gh', ['release', 'upload', tag, ...assets, '--repo', env.GITHUB_REPOSITORY])
  const release = JSON.parse(command('gh', ['api', `repos/${env.GITHUB_REPOSITORY}/releases/tags/${tag}`]))
  const fresh = release.assets.filter(a => a.name.startsWith(`${env.CHECKPOINT_GENERATION}-final-`))
  const metadata = { ...deployed, generation: env.CHECKPOINT_GENERATION, screenshots: fresh.map(a => a.browser_download_url) }
  // Append deployment evidence without changing the current checkpoint pointer.
  const body = release.body.replace(/\n?<!-- deployment:v1 .*? -->/g, '') + `\n<!-- deployment:v1 ${JSON.stringify(metadata)} -->`
  command('gh', ['release', 'edit', tag, '--repo', env.GITHUB_REPOSITORY, '--notes', body])
  for (const old of release.assets.filter(a => /-final-.*\.(png|jpe?g|webp)$/i.test(a.name) && !fresh.some(f => f.id === a.id))) command('gh', ['api', `repos/${env.GITHUB_REPOSITORY}/releases/assets/${old.id}`, '-X', 'DELETE'])
  rmSync(archive, { force: true })
} finally {
  await abort()
  rmSync(join(env.OPENCODE_WEB_DIR, 'active-validation.json'), { force: true })
  command('git', ['worktree', 'remove', '--force', directory], { cwd: root })
}

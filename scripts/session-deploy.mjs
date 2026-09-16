import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { command } from './session-checkpoint.mjs'
import { preparePreview } from './preview-setup.mjs'
import { uploadDeployment } from './deployment-retry.mjs'
import { child } from './session-lifecycle.mjs'

const env = process.env
const evidence = join(env.RUNNER_TEMP, `validation-${env.CHECKPOINT_GENERATION}`)
const project = env.PROJECT_DIR
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
  mkdirSync(evidence, { recursive: true })
  const runFork = async prompt => {
    if (!fork) {
      fork = await api(`/session/${main}/fork`, { method: 'POST', body: JSON.stringify({ messageID: env.MAIN_MESSAGE_ID }) })
      if (!fork.id?.startsWith('ses_')) throw new Error('No repair fork created')
      writeFileSync(join(env.OPENCODE_WEB_DIR, 'active-validation.json'), JSON.stringify({ id: fork.id, directory: project }))
    }
    await child(env.OPENCODE_BIN || join(env.HOME, '.opencode/bin/opencode'), ['run', '--auto', '--dangerously-skip-permissions', '--attach', base, '--dir', project, '--session', fork.id, '--model', readFileSync(join(env.OPENCODE_WEB_DIR, 'main-model'), 'utf8').trim(), prompt], { signal: controller.signal, cwd: project })
  }
  const { repaired } = await preparePreview({ env, evidence, signal: controller.signal, repair: runFork })
  if (repaired) {
    await child(process.execPath, [join(env.RUNTIME_DIR, 'scripts/session-checkpoint.mjs'), 'save'], { signal: controller.signal })
    const updated = JSON.parse(readFileSync(join(env.OPENCODE_WEB_DIR, 'checkpoint-state.json'), 'utf8'))
    env.CHECKPOINT_COMMIT = updated.commit
    env.CHECKPOINT_GENERATION = updated.generation
  }
  const marker = join(env.OPENCODE_WEB_DIR, 'live-preview-url')
  let advertised = ''
  try { advertised = readFileSync(marker, 'utf8') } catch {}
  if (advertised !== env.APP_URL) {
    await child('gh', ['api', `repos/${env.GITHUB_REPOSITORY}/issues/${env.TRIGGER_ISSUE_NUMBER}/comments`, '-f', `body=Playable preview: ${env.APP_URL}`], { signal: controller.signal })
    writeFileSync(marker, env.APP_URL)
  }
  const screenshots = readdirSync(evidence).filter(name => /^final-.*\.(png|jpe?g|webp)$/i.test(name))
  if (!['final-desktop.png', 'final-mobile.png'].every(name => screenshots.includes(name))) throw new Error('Capture produced no screenshots')
  const archive = join(env.RUNNER_TEMP, `deployment-${env.CHECKPOINT_GENERATION}.zip`)
  // Package generated dist when present, otherwise the static project. Exclude
  // dependencies and runner state; materialization selects the HTML entrypoint.
  command('python3', ['-c', `import os,sys,zipfile
root,out,evidence=sys.argv[1:]
source=root
if os.path.isfile(os.path.join(root,'dist','index.html')): root=os.path.join(root,'dist')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for base,dirs,files in os.walk(root):
  dirs[:]=[d for d in dirs if d not in ['node_modules','.git','.opencode','.agents','.opencode-web','.omgithub-runtime','.opencode-ssh','.playwright-cli','screenshots']]
  for name in files:
   if name.startswith(('.env','opencode-agentsweb-')) or name.endswith(('.log','.pid')): continue
   p=os.path.join(base,name)
   if not os.path.islink(p): z.write(p,os.path.relpath(p,root))
 for name in os.listdir(evidence):
  p=os.path.join(evidence,name)
  if name.startswith('final-') and os.path.isfile(p): z.write(p,'screenshots/'+name)`, project, archive, evidence])
  if (controller.signal.aborted) throw new Error('Cancelled')
  const site = env.OMGITHUB_ORIGIN || 'https://omgithub.com'
  const deployed = await uploadDeployment(`${site}/api/github/${env.GITHUB_REPOSITORY}/issues/${env.TRIGGER_ISSUE_NUMBER}/deployment`, { method: 'POST', headers: {
    authorization: `Bearer ${env.GH_TOKEN || env.GITHUB_TOKEN}`, 'content-type': 'application/zip', 'x-omgithub-run': env.GITHUB_RUN_ID,
    'x-omgithub-generation': env.DEPLOYMENT_GENERATION, 'x-omgithub-commit': env.CHECKPOINT_COMMIT
  }, body: readFileSync(archive), signal: controller.signal })
  if (controller.signal.aborted) throw new Error('Cancelled')
  const tag = `opencode-checkpoint-${env.TRIGGER_ISSUE_NUMBER}`
  const assets = screenshots.map(name => {
    const path = join(env.RUNNER_TEMP, `${env.CHECKPOINT_GENERATION}-${name}`)
    writeFileSync(path, readFileSync(join(evidence, name)))
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
  rmSync(evidence, { recursive: true, force: true })
} finally {
  await abort()
  rmSync(join(env.OPENCODE_WEB_DIR, 'active-validation.json'), { force: true })
}

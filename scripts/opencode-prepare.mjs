import { appendFileSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseIssueRequest } from './issue-request.mjs';

const codexTag = /(?:^|\s)#codex(?=\s|$)/i;
const titleTag = /(?:^|\s)\/OpenCode(?=\s|$)/;

export function outputText(values) {
  return Object.entries(values).map(([key, value]) => {
    let delimiter;
    do { delimiter = `opencode_${randomUUID()}`; } while (String(value).includes(delimiter));
    return `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
  }).join('');
}

export async function prepareRequest(event, env, fetcher = fetch) {
  const access = String(env.OPENCODE_ACCESS || 'writers').trim().toLowerCase();
  if (!['writers', 'everyone'].includes(access)) throw new Error('Set OPENCODE_ACCESS to writers or everyone.');
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || event.repository?.full_name !== repository) throw new Error('Invalid issue repository.');
  const manual = env.GITHUB_EVENT_NAME === 'workflow_dispatch';
  if (!manual && (env.GITHUB_EVENT_NAME !== 'issues' || event.action !== 'opened')) return { approved: 'false' };
  const number = Number(manual ? event.inputs?.issue_number : event.issue?.number);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Supply a valid issue number.');
  const api = async (path, options = {}) => {
    const response = await fetcher(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}${path}`, {
      ...options, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status}) for ${path}.`);
    return response.status === 204 ? null : response.json();
  };
  const [repo, issue] = await Promise.all([api(''), api(`/issues/${number}`)]);
  if (issue.pull_request || issue.state !== 'open') throw new Error('Select an open issue.');
  const labels = (issue.labels || []).map(label => typeof label === 'string' ? label : label.name);
  const codex = labels.some(label => label.toLowerCase() === 'codex') || codexTag.test(issue.title);
  const opencode = labels.includes('OpenCode') || titleTag.test(issue.title);
  if (codex && opencode) throw new Error('Select one agent: Codex or OpenCode.');
  if (!codex && !opencode) return { approved: 'false' };
  const agent = codex ? 'codex' : 'opencode';
  const agentLabel = codex ? 'Codex' : 'OpenCode';
  if (codex && labels.some(label => ['goal', 'ralph', 'omo', 'ssh'].includes(label.toLowerCase()))) {
    throw new Error('Use Codex with model/ and skill/ labels; Goal, ralph, omo, and ssh select OpenCode modes.');
  }
  if (codex && labels.filter(label => label.startsWith('model/')).some(label => !label.startsWith('model/openai/'))) {
    throw new Error('Select an OpenAI model with model/openai/<model> for Codex.');
  }
  if (codex && labels.filter(label => label.startsWith('model/')).length > 1) throw new Error('Select one Codex model.');
  const sender = issue.user?.login;
  if (!sender) throw new Error('The issue has no author.');
  if (access !== 'everyone') {
    const permission = await api(`/collaborators/${encodeURIComponent(sender)}/permission`);
    if (!['write', 'maintain', 'admin'].includes(permission.permission)) throw new Error('The issue author needs write, maintain, or admin access. Set OPENCODE_ACCESS=everyone to accept all authors.');
  }
  const parsed = parseIssueRequest({ ...issue, title: issue.title.replace(codex ? codexTag : titleTag, '').trim() }, repo.default_branch);
  if (parsed.branchError || !parsed.request || !parsed.title) throw new Error(parsed.branchError || 'Supply an issue title and request.');
  const branch = await api(`/branches/${encodeURIComponent(parsed.targetRef)}`);
  if (!/^[a-f0-9]{40}$/.test(branch.commit?.sha || '')) throw new Error('The target branch has no valid commit.');
  if (env.GITHUB_REF !== `refs/heads/${parsed.targetRef}`) {
    await api('/actions/workflows/opencode.yml/dispatches', {
      method: 'POST',
      body: JSON.stringify({ ref: parsed.targetRef, inputs: { issue_number: String(number) } }),
    });
    return { approved: 'false' };
  }
  if (!labels.some(label => label.toLowerCase() === agentLabel.toLowerCase())) {
    await api(`/issues/${number}/labels`, { method: 'POST', body: JSON.stringify({ labels: [agentLabel] }) });
    labels.push(agentLabel);
  }
  return { approved: 'true', agent, issue_number: String(number), request: parsed.request, issue_title: parsed.title, sender, labels_json: JSON.stringify(labels), target_ref: parsed.targetRef, target_sha: branch.commit.sha };
}

export async function prepare(env = process.env, fetcher = fetch) {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  try {
    appendFileSync(env.GITHUB_OUTPUT, outputText(await prepareRequest(event, env, fetcher)));
  } catch (error) {
    const detail = String(error.message || 'Preparation failed').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
    console.error(`Agent preparation: ${detail}`);
    const repository = env.GITHUB_REPOSITORY;
    if (/^[\w.-]+\/[\w.-]+$/.test(repository || '') && Number.isSafeInteger(event.issue?.number)) {
      await fetcher(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}/issues/${event.issue.number}/comments`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.GH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: `Agent preparation failed. Check repository access and the selected branch in [the run log](https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}).` }),
        signal: AbortSignal.timeout(30000), redirect: 'error',
      }).catch(() => {});
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepare().catch(() => { process.exitCode = 1; });
}

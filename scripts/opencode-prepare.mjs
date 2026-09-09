import { appendFileSync, readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseIssueRequest } from '../site/server/issue-request.mjs';

const statusLabels = new Set(['in progress', 'validating', 'complete', 'failed']);
const names = issue => (issue.labels || []).map(label => typeof label === 'string' ? label : label.name).filter(name => !statusLabels.has(name)).sort();
const titleTag = /(?:^|\s)\/OpenCode(?=\s|$)/;
const claimPrefix = '<!-- opencode-request-v1\n';
const failedConclusions = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure']);
const snapshot = (issue, ref) => createHash('sha256').update(JSON.stringify([issue.title, issue.body || '', names(issue), ref])).digest('hex');

export function outputText(values) {
  return Object.entries(values).map(([key, value]) => {
    let delimiter;
    do { delimiter = `opencode_${randomUUID()}`; } while (String(value).includes(delimiter));
    return `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
  }).join('');
}

function readClaim(comment) {
  if (comment.user?.login !== 'github-actions[bot]' || comment.user?.type !== 'Bot' || !comment.body?.startsWith(claimPrefix)) return null;
  try {
    const claim = JSON.parse(comment.body.slice(claimPrefix.length).split('\n-->')[0]);
    return /^\d+$/.test(claim.run) && /^\d+$/.test(claim.attempt) && typeof claim.key === 'string' ? claim : null;
  } catch { return null; }
}

export async function prepareRequest(event, env, fetcher = fetch) {
  const access = String(env.OPENCODE_ACCESS || 'writers').trim().toLowerCase();
  if (!['writers', 'everyone'].includes(access)) throw new Error('Set OPENCODE_ACCESS to writers or everyone.');
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || event.repository?.full_name !== repository || event.issue?.pull_request || !Number.isSafeInteger(event.issue?.number)) throw new Error('Invalid issue repository.');
  const eventLabels = names(event.issue);
  const labeled = event.action === 'labeled' && event.label?.name === 'OpenCode' && eventLabels.includes('OpenCode');
  const opened = access === 'everyone' && event.action === 'opened' && !eventLabels.includes('OpenCode') && titleTag.test(event.issue.title);
  if (env.GITHUB_EVENT_NAME !== 'issues' || (!labeled && !opened)) return { approved: 'false' };
  if (!/^\d+$/.test(env.GITHUB_RUN_ID || '') || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT || '')) throw new Error('Invalid run identity.');
  const apiBase = env.GITHUB_API_URL || 'https://api.github.com';
  const api = async (path, options = {}) => {
    const response = await fetcher(`${apiBase}/repos/${repository}${path}`, {
      ...options, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status}) for ${path.split('?')[0]}.`);
    return response.status === 204 ? null : response.json();
  };
  const all = async path => {
    const result = [];
    for (let page = 1; page <= 100; page++) {
      const rows = await api(`${path}?per_page=100&page=${page}`);
      result.push(...rows);
      if (rows.length < 100) return result;
    }
    throw new Error('Issue history is too large to validate.');
  };
  const issuePath = `/issues/${event.issue.number}`;
  const [repo, current, run] = await Promise.all([
    api(''), api(issuePath), api(`/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}`),
  ]);
  if (env.GITHUB_REF !== `refs/heads/${repo.default_branch}` || run.event !== 'issues' || String(run.id) !== env.GITHUB_RUN_ID) throw new Error('Run the issue listener from the default branch.');
  const parsed = parseIssueRequest({ ...event.issue, title: event.issue.title.replace(titleTag, '').trim() }, repo.default_branch);
  if (parsed.branchError || !parsed.request || !parsed.title) throw new Error(parsed.branchError || 'Supply an issue title and request.');
  const effectiveIssue = { ...event.issue, labels: [...eventLabels, ...(opened ? ['OpenCode'] : [])] };
  const comparableCurrent = opened ? { ...current, labels: [...new Set([...names(current), 'OpenCode'])] } : current;
  const fingerprint = snapshot(effectiveIssue, parsed.targetRef);
  if (snapshot(comparableCurrent, parsed.targetRef) !== fingerprint || current.user?.id !== event.issue.user?.id || current.state !== 'open') throw new Error('Issue content changed after the request. Apply OpenCode again.');
  const sender = event.issue.user?.login;
  if (!sender) throw new Error('The issue has no author.');
  if (access !== 'everyone') {
    const permission = await api(`/collaborators/${encodeURIComponent(sender)}/permission`);
    if (!['write', 'maintain', 'admin'].includes(permission.permission)) throw new Error('The issue author needs write, maintain, or admin access. Set OPENCODE_ACCESS=everyone to accept all authors.');
  }
  let key = `opened:${event.issue.id}`;
  let requestedAt = event.issue.created_at;
  if (labeled) {
    const timeline = await all(`${issuePath}/timeline`);
    const matches = timeline.filter(entry => entry.event === 'labeled' && entry.label?.name === 'OpenCode' && entry.actor?.id === event.sender?.id && entry.created_at === event.issue.updated_at && Date.parse(entry.created_at) <= Date.parse(run.created_at));
    if (matches.length !== 1) throw new Error('Cannot identify the label event. Apply OpenCode again.');
    key = `labeled:${matches[0].id}`;
    requestedAt = matches[0].created_at;
  }
  const claims = (await all(`${issuePath}/comments`)).map(readClaim).filter(Boolean);
  const prior = claims.at(-1);
  const same = claims.filter(claim => claim.key === key).at(-1);
  for (const claim of [...new Set([prior, same].filter(Boolean))]) {
    const previous = await api(`/actions/runs/${claim.run}/attempts/${claim.attempt}`);
    if (previous.status !== 'completed') throw new Error('This issue already has an active execution.');
    if (claim.key === key) {
      if (claim.run !== env.GITHUB_RUN_ID || Number(env.GITHUB_RUN_ATTEMPT) <= Number(claim.attempt) || !failedConclusions.has(previous.conclusion)) throw new Error('This request already ran. Retry a failed run or apply OpenCode again.');
      if (claim.snapshot !== fingerprint) throw new Error('The retry request changed.');
    } else if (Date.parse(requestedAt) <= Date.parse(previous.updated_at)) {
      throw new Error('The request arrived during a previous execution. Apply OpenCode again.');
    }
  }
  const branch = await api(`/branches/${encodeURIComponent(parsed.targetRef)}`);
  if (!/^[a-f0-9]{40}$/.test(branch.commit?.sha || '')) throw new Error('The target branch has no valid commit.');
  const targetSha = same?.target_sha || branch.commit.sha;
  if (opened && !names(current).includes('OpenCode')) await api(`${issuePath}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['OpenCode'] }) });
  // Caller concurrency serializes these durable GitHub records for each issue.
  const claim = { key, run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, snapshot: fingerprint, target_sha: targetSha };
  await api(`${issuePath}/comments`, { method: 'POST', body: JSON.stringify({ body: `${claimPrefix}${JSON.stringify(claim)}\n-->\nOpenCode request accepted. [Run](https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}).` }) });
  return { approved: 'true', issue_number: String(event.issue.number), request: parsed.request, issue_title: parsed.title, sender, labels_json: JSON.stringify(names(effectiveIssue)), target_ref: parsed.targetRef, target_sha: targetSha };
}

export async function prepare(env = process.env, fetcher = fetch) {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  try {
    appendFileSync(env.GITHUB_OUTPUT, outputText(await prepareRequest(event, env, fetcher)));
  } catch (error) {
    const detail = String(error.message || 'Preparation failed').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
    console.error(`OpenCode preparation: ${detail}`);
    const repository = env.GITHUB_REPOSITORY;
    if (/^[\w.-]+\/[\w.-]+$/.test(repository || '') && Number.isSafeInteger(event.issue?.number)) {
      await fetcher(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}/issues/${event.issue.number}/comments`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.GH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: `OpenCode preparation failed. Check repository access and the selected branch in [the run log](https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}).` }),
        signal: AbortSignal.timeout(30000), redirect: 'error',
      }).catch(() => {});
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepare().catch(() => { process.exitCode = 1; });
}

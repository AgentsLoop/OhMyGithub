import { appendFileSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function outputText(values) {
  return Object.entries(values).map(([key, value]) => {
    let delimiter;
    do { delimiter = `omg_${randomUUID()}`; } while (String(value).includes(delimiter));
    return `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
  }).join('');
}

export function validateOutputs(data, issueNumber) {
  if (data?.approved !== true && data?.approved !== 'true') throw new Error('Request was not approved');
  const keys = ['issue_number', 'request', 'issue_title', 'sender', 'labels_json', 'target_ref', 'target_sha'];
  for (const key of keys) {
    if (typeof data[key] !== 'string' || !data[key]) throw new Error(`Invalid preparation output: ${key}`);
  }
  if (data.issue_number !== String(issueNumber) || !/^[a-f0-9]{40}$/.test(data.target_sha)) {
    throw new Error('Preparation output does not match the issue or commit');
  }
  const labels = JSON.parse(data.labels_json);
  if (!Array.isArray(labels) || !labels.every(label => typeof label === 'string') || !labels.includes('OpenCode')) {
    throw new Error('Invalid label snapshot');
  }
  return Object.fromEntries([['approved', 'true'], ...keys.map(key => [key, data[key]])]);
}

export async function prepare(env = process.env, fetcher = fetch) {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  if (env.GITHUB_EVENT_NAME !== 'issues' || event.action !== 'labeled' || event.label?.name !== 'OpenCode') {
    throw new Error('Expected an OpenCode issue label event');
  }
  const endpoint = new URL('/api/opencode/prepare', env.OMG_APP_ORIGIN);
  if (endpoint.protocol !== 'https:') throw new Error('Preparation requires HTTPS');
  const oidcUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  try {
    const oidcResponse = await fetcher(oidcUrl, {
      headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!oidcResponse.ok) {
      const oidcFailure = (await oidcResponse.text())
        .replace(/[\r\n\u0000-\u001f\u007f]/g, ' ')
        .slice(0, 500);
      throw new Error(`Could not obtain workflow identity (HTTP ${oidcResponse.status}): ${oidcFailure || 'No response detail'}`);
    }
    const { value: token } = await oidcResponse.json();
    if (typeof token !== 'string' || !token) throw new Error('Missing workflow identity');
    const response = await fetcher(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }), signal: AbortSignal.timeout(60000), redirect: 'error',
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      // Keep the server reason on one prefixed line to prevent Actions command injection.
      const reason = typeof failure.error === 'string'
        ? failure.error.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 500)
        : 'Request validation failed';
      console.error(`Preparation rejected (HTTP ${response.status}): ${reason}`);
      throw new Error('Preparation rejected the request');
    }
    const outputs = validateOutputs(await response.json(), event.issue.number);
    appendFileSync(env.GITHUB_OUTPUT, outputText(outputs));
  } catch (error) {
    const detail = String(error.message || 'Preparation failed').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 300);
    const code = typeof error.cause?.code === 'string' ? error.cause.code : '';
    console.error(`Preparation error: ${detail}${code ? ` (${code})` : ''}`);
    // Use fixed text: never reflect endpoint responses, issue text, or identity tokens.
    const body = `OpenCode preparation failed. Check authorization, App approval, and the selected branch. See [the preparation run](https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}) for details.`;
    const api = env.GITHUB_API_URL || 'https://api.github.com';
    try {
      const comment = await fetcher(`${api}/repos/${env.GITHUB_REPOSITORY}/issues/${event.issue.number}/comments`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.GH_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
        body: JSON.stringify({ body }), signal: AbortSignal.timeout(30000), redirect: 'error',
      });
      if (!comment.ok) console.error('Could not publish the preparation failure comment.');
    } catch { console.error('Could not publish the preparation failure comment.'); }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepare().catch(() => {
    console.error('OpenCode preparation failed. Check the request approval and App service configuration.');
    process.exitCode = 1;
  });
}

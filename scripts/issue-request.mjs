export function parseIssueRequest(issue, defaultBranch = 'main') {
  const body = String(issue?.body || '')
  const title = String(issue?.title || '').trim()
  let metadata = {}
  try { metadata = JSON.parse(body.match(/<!-- omgithub-request:v1 (\{[^\n]*\}) -->/)?.[1] || '{}') } catch {}
  const requestBody = body.replace(/<!-- omgithub-request:v1 \{[^\n]*\} -->/g, '').trim()
  const directive = typeof metadata.branch === 'string' ? Object.assign([null, metadata.branch], { index: title.length }) : title.match(/(?:^|\s)branch:\s*(.*?)\s*$/i)
  const requestTitle = directive ? title.slice(0, directive.index).trim() : title
  if (!directive) return { request: requestBody || requestTitle, title: requestTitle, targetRef: defaultBranch, branchSpecified: false, branchError: '' }
  const targetRef = directive[1].trim()
  const invalid = !targetRef || targetRef.length > 255 || targetRef === '@' || targetRef.startsWith('-') ||
    targetRef.startsWith('/') || targetRef.endsWith('/') || targetRef.endsWith('.') || targetRef.endsWith('.lock') ||
    targetRef.includes('..') || targetRef.includes('@{') || targetRef.includes('//') ||
    targetRef.split('/').some(part => part.startsWith('.')) || /[\u0000-\u0020\u007f~^:?*[\]\\]/.test(targetRef)
  return {
    request: requestBody || requestTitle,
    title: requestTitle,
    targetRef: invalid ? defaultBranch : targetRef,
    branchSpecified: true,
    branchError: invalid ? 'Invalid branch directive. End the issue title with `branch: <existing-branch>`.' : ''
  }
}

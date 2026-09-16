// Use the normal resolver: DNS overrides would hide the failure users encounter.
export async function publicUrlReady(url, request = fetch) {
  if (!url) return false
  try {
    if (new URL(url).protocol !== 'https:') return false
    const response = await request(url, { signal: AbortSignal.timeout(4000), redirect: 'error' })
    const ready = response.ok
    await response.body?.cancel()
    return ready
  } catch { return false }
}

export async function readyPublicUrls(urls, check = publicUrlReady) {
  const entries = await Promise.all(['opencode', 'files', 'preview'].map(async key =>
    [key, urls[key] && await check(urls[key]) ? urls[key] : '']))
  return { ...urls, ...Object.fromEntries(entries) }
}

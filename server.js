import { mkdir } from 'node:fs/promises';

const port = Number(process.env.PORT || 4317);
const cacheFile = Bun.file(new URL('./.cache/activity.json', import.meta.url));
let cache = await cacheFile.exists() ? await cacheFile.json().catch(() => null) : null;
if (cache && !('name' in cache)) cache = null;
let pending;
const query = `query($cursor:String) { viewer { login name avatarUrl url pullRequests(first:100,after:$cursor,orderBy:{field:CREATED_AT,direction:ASC}) { totalCount nodes { id createdAt } pageInfo { hasNextPage endCursor } } } }`;

async function loadActivity() {
  let cursor = null, profile, expected;
  const prs = new Map();
  do {
    const child = Bun.spawn(['gh', 'api', 'graphql', '--input', '-'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
    child.stdin.write(JSON.stringify({ query, variables: { cursor } }));
    child.stdin.end();
    const timeout = setTimeout(() => child.kill(), 30000);
    const [output, , code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    clearTimeout(timeout);
    if (code !== 0) throw new Error('GitHub could not be reached. Check your connection and run gh auth status.');
    const result = JSON.parse(output);
    if (result.errors || !result.data?.viewer) throw new Error('GitHub could not load your PRs. Run gh auth status and retry.');
    const { pullRequests, ...user } = result.data.viewer;
    profile = user;
    expected = pullRequests.totalCount;
    for (const pr of pullRequests.nodes) prs.set(pr.id, pr.createdAt);
    cursor = pullRequests.pageInfo.hasNextPage ? pullRequests.pageInfo.endCursor : null;
  } while (cursor);
  if (prs.size !== expected) throw new Error('Your PRs changed during sync. Please refresh to get a complete count.');
  const counts = {};
  for (const date of prs.values()) counts[date.slice(0, 7)] = (counts[date.slice(0, 7)] || 0) + 1;
  const activity = { ...profile, total: prs.size, counts, updatedAt: new Date().toISOString() };
  await mkdir(new URL('./.cache/', import.meta.url), { recursive: true });
  await Bun.write(cacheFile, JSON.stringify(activity));
  cache = activity;
  return activity;
}

const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']]]);
Bun.serve({ hostname: '127.0.0.1', port, idleTimeout: 255, async fetch(request) {
  const url = new URL(request.url);
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (url.pathname === '/api/activity') {
    if (cache && Date.now() - Date.parse(cache.updatedAt) < 300000) return Response.json(cache, { headers });
    try {
      pending ??= loadActivity().finally(() => { pending = null; });
      return Response.json(await pending, { headers });
    } catch (error) {
      return Response.json(cache ? { ...cache, stale: true, warning: error.message } : { error: error.message }, { status: cache ? 200 : 503, headers });
    }
  }
  const file = files.get(url.pathname);
  return file ? new Response(Bun.file(new URL(`./public/${file[0]}`, import.meta.url)), { headers: { ...headers, 'Content-Type': file[1] } }) : new Response('Not found', { status: 404 });
} });
console.log(`PR graph is running at http://localhost:${port}`);

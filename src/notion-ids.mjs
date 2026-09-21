#!/usr/bin/env node
// Resolves Notion database URLs to the DATA SOURCE ids the sync needs, and
// prints the `gh variable set` commands to store them.
//
// A URL gives you a *database* id. Since 2025-09 pages live in a database's
// *data source*, and only the API can tell you that id.
//
//   NOTION_TOKEN=ntn_... node src/notion-ids.mjs <url-or-id> [<url-or-id> ...]
//
// With no arguments it searches your workspace for every database the
// integration can see, which is the easy path when you have no links to hand.
import { notion, NotionError } from './lib/notion.mjs';

const VAR_FOR = {
  places: 'NOTION_PLACES_DS_ID',
  experiences: 'NOTION_EXPERIENCES_DS_ID',
  neighborhoods: 'NOTION_NEIGHBORHOODS_DS_ID',
};

/** Pull the 32-hex id out of any Notion URL shape, or accept a bare id. */
function extractId(input) {
  const hex = String(input).replace(/[?#].*$/, '').match(/[0-9a-f]{32}|[0-9a-f-]{36}/i);
  if (!hex) throw new Error(`No Notion id found in: ${input}`);
  return hex[0].replace(/-/g, '');
}

const dash = id =>
  `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;

const plainTitle = t => (t ?? []).map(x => x.plain_text).join('') || '(untitled)';

async function fromDatabase(id) {
  const db = await notion('GET', `/v1/databases/${dash(id)}`);
  return (db.data_sources ?? []).map(ds => ({
    title: plainTitle(db.title), dsId: ds.id, dsName: ds.name, parent: db.parent,
  }));
}

/**
 * Given one database, find its siblings on the same parent page. Notion's
 * workspace search lags several minutes behind a new grant, but walking the
 * page tree is immediate — so one URL is enough to find all three databases.
 */
async function siblingsOf(hit, seen) {
  const pageId = hit.parent?.page_id;
  if (!pageId) return [];
  let kids;
  try {
    kids = await notion('GET', `/v1/blocks/${pageId}/children?page_size=100`);
  } catch {
    return [];                       // parent not shared with the integration
  }
  const out = [];
  for (const b of (kids.results ?? []).filter(b => b.type === 'child_database')) {
    const id = b.id.replace(/-/g, '');
    if (seen.has(id)) continue;
    seen.add(id);
    try { out.push(...await fromDatabase(id)); } catch { /* skip unreadable */ }
  }
  return out;
}

/** The link may point at a PAGE that contains inline databases. Look inside. */
async function fromPageChildren(id) {
  const kids = await notion('GET', `/v1/blocks/${dash(id)}/children?page_size=100`);
  const dbs = (kids.results ?? []).filter(b => b.type === 'child_database');
  const out = [];
  for (const b of dbs) out.push(...await fromDatabase(b.id.replace(/-/g, '')));
  return out;
}

async function searchWorkspace() {
  const res = await notion('POST', '/v1/search', { filter: { property: 'object', value: 'data_source' }, page_size: 100 });
  return (res.results ?? []).map(ds => ({
    title: plainTitle(ds.title) || plainTitle(ds.name), dsId: ds.id, dsName: ds.name,
  }));
}

const found = [];
try {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('No arguments — searching the workspace for databases the integration can see.\n');
    found.push(...await searchWorkspace());
  } else {
    for (const arg of args) {
      const id = extractId(arg);
      try {
        found.push(...await fromDatabase(id));
      } catch (e) {
        if (!(e instanceof NotionError) || ![400, 404].includes(e.status)) throw e;
        console.log(`${id} is not a database — looking inside it for inline databases…`);
        found.push(...await fromPageChildren(id));
      }
    }
    // One URL is usually enough: pick up the other databases on the same page.
    const seen = new Set(found.map(f => extractId(f.dsId)));
    for (const hit of [...found]) found.push(...await siblingsOf(hit, seen));
  }
} catch (e) {
  const hint = e instanceof NotionError && [401, 403, 404].includes(e.status)
    ? '\nIf the id looks right, the integration is probably not connected to the page.' +
      '\nOpen the parent page in Notion -> ⋯ -> Connections -> add your integration, then retry.'
    : '';
  console.error(`\nLookup failed: ${e.message}${hint}`);
  process.exit(1);
}

const unique = [...new Map(found.map(f => [f.dsId, f])).values()];
found.length = 0; found.push(...unique);

if (!found.length) {
  // Distinguish "token is wrong" from "token is fine but sees nothing", which
  // are the same empty result but completely different fixes.
  try {
    const me = await notion('GET', '/v1/users/me');
    const workspace = me.bot?.workspace_name ?? '(unknown)';
    console.error(
      `\nThe token works — it authenticates as the integration "${me.name ?? me.id}"` +
      `\nin the workspace: "${workspace}".` +
      '\n\n1. Is that the workspace your guide lives in? An internal integration is' +
      '\n   scoped to ONE workspace. If the page is in a different one, the' +
      '\n   integration will not appear in that page\'s Connections list at all —' +
      '\n   create a new integration from inside the correct workspace.' +
      '\n2. If the workspace is right, check you connected THIS integration by name;' +
      '\n   a workspace often has several.' +
      '\nBut it has been granted access to nothing, so search returns no results.' +
      '\n\nFix: open the page that CONTAINS your Places/Experiences/Neighborhoods' +
      '\ndatabases in Notion, click ⋯ (top right) -> Connections -> add this' +
      '\nintegration. Access is granted per-page and is inherited by children,' +
      '\nso connecting the parent page is enough.\n' +
      '\nThen re-run. To check one database directly:' +
      '\n  npm run notion:ids -- "<paste the database URL>"');
  } catch (e) {
    console.error(`\nThe token itself was rejected: ${e.message}` +
      '\nCopy it again from notion.so/my-integrations -> your integration ->' +
      '\nInternal Integration Secret -> Show. It should start with "ntn_".');
  }
  process.exit(1);
}

console.log('\nData sources the integration can see:\n');
for (const f of found) console.log(`  ${f.dsId}   ${f.title}${f.dsName && f.dsName !== f.title ? ` / ${f.dsName}` : ''}`);

console.log('\nSet the repo variables (match each id to the right database by title):\n');
for (const f of found) {
  const key = Object.keys(VAR_FOR).find(k => (f.title + ' ' + (f.dsName ?? '')).toLowerCase().includes(k.slice(0, 5)));
  console.log(`  gh variable set ${key ? VAR_FOR[key] : 'NOTION_<WHICH>_DS_ID'} --body ${f.dsId}`);
}
console.log('\nNote: repo VARIABLES, not secrets — the workflow reads vars.*, and ids are not sensitive.');

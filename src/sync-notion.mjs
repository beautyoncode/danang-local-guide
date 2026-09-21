#!/usr/bin/env node
// Pushes content/** into the Notion databases. One-way: the repo wins.
//
// Page BODIES are never touched — no blocks.children calls anywhere. That is
// what makes this safe to re-run: photos and hand-written notes on a Notion
// page survive every sync. Only the properties listed in SPECS are written;
// everything else (Photo, EN reviewed, Localness, Value, …) is Notion-owned.
//
//   node src/sync-notion.mjs [--full] [--dry-run]
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { loadContent, notionLabel, label } from './lib/content.mjs';
import {
  queryAll, getDataSource, updateDataSource, createPage, updatePage, archivePage,
  title, richText, select, multiSelect, url, date, relation, plain, NotionError,
} from './lib/notion.mjs';

const FULL = process.argv.includes('--full') || process.env.FULL === 'true';
const DRY = process.argv.includes('--dry-run');

const DS = {
  places: process.env.NOTION_PLACES_DS_ID,
  experiences: process.env.NOTION_EXPERIENCES_DS_ID,
  neighborhoods: process.env.NOTION_NEIGHBORHOODS_DS_ID,
};

// Properties the sync owns. ensureSchema() creates the missing ones and refuses
// to touch an existing property whose type doesn't match — it never rewrites or
// deletes a column you already have.
const SPECS = {
  places: {
    Name: 'title', Slug: 'rich_text', Type: 'select', Category: 'select', Area: 'select',
    Address: 'rich_text', 'Price (VND)': 'rich_text', 'Price band': 'select',
    'Best session': 'multi_select', 'Best season': 'multi_select',
    Vibe: 'multi_select', 'Good for': 'multi_select',
    'Must try (EN)': 'rich_text', 'Must try (VI)': 'rich_text',
    'Why we go (EN)': 'rich_text', 'Why we go (VI)': 'rich_text',
    'Hours & notes (EN)': 'rich_text', 'Hours & notes (VI)': 'rich_text',
    Link: 'url', 'Data status': 'select', 'Last checked': 'date',
    Relationship: 'select', 'Contributed by': 'rich_text', 'Sync hash': 'rich_text',
  },
  experiences: {
    Name: 'title', 'Name (VI)': 'rich_text', Slug: 'rich_text',
    Session: 'multi_select', 'Best season': 'multi_select', Area: 'select',
    Duration: 'select', 'Best for': 'multi_select',
    Stops: 'relation', 'Stops (in order)': 'rich_text',
    'Local tip (EN)': 'rich_text', 'Local tip (VI)': 'rich_text',
    'Data status': 'select', 'Last checked': 'date',
    'Contributed by': 'rich_text', 'Sync hash': 'rich_text',
  },
  neighborhoods: {
    Name: 'title', 'Name (VI)': 'rich_text', Slug: 'rich_text', Area: 'select',
    'Vibe (EN)': 'rich_text', 'Vibe (VI)': 'rich_text',
    'Best for (EN)': 'rich_text', 'Best for (VI)': 'rich_text',
    "What's here (EN)": 'rich_text', "What's here (VI)": 'rich_text',
    'What we like (EN)': 'rich_text', 'What we like (VI)': 'rich_text',
    "What we don't like (EN)": 'rich_text', "What we don't like (VI)": 'rich_text',
    'Data status': 'select', 'Last checked': 'date',
    'Contributed by': 'rich_text', 'Sync hash': 'rich_text',
  },
};

const { taxonomy, entries } = loadContent();
const iso = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d) : null);
const tag = (group, key) => (key ? notionLabel(taxonomy, group, key) : null);
const tags = (group, keys) => (keys ?? []).map(k => notionLabel(taxonomy, group, k));
// `Data status` keeps V2's plain-English options so existing view filters
// ("Draft - verify") keep working.
const statusLabel = s => label(taxonomy, 'status', s ?? 'draft', 'en');
const people = d => (d.contributed_by ?? []).join(', ');

const BUILD = {
  places: d => ({
    Name: title(d.name),
    Slug: richText(d.slug),
    Type: select(tag('type', d.type)),
    Category: select(tag('category', d.category)),
    Area: select(tag('area', d.area)),
    Address: richText(d.address),
    'Price (VND)': richText(d.price_vnd),
    'Price band': select(tag('price_band', d.price_band)),
    'Best session': multiSelect(tags('best_session', d.best_session)),
    'Best season': multiSelect(tags('best_season', d.best_season)),
    Vibe: multiSelect(tags('vibe', d.vibe)),
    'Good for': multiSelect(tags('good_for', d.good_for)),
    'Must try (EN)': richText(d.must_try?.en), 'Must try (VI)': richText(d.must_try?.vi),
    'Why we go (EN)': richText(d.why_we_go?.en), 'Why we go (VI)': richText(d.why_we_go?.vi),
    'Hours & notes (EN)': richText(d.hours_notes?.en), 'Hours & notes (VI)': richText(d.hours_notes?.vi),
    Link: url(d.link),
    'Data status': select(statusLabel(d.status)),
    'Last checked': date(iso(d.last_checked)),
    Relationship: select(tag('relationship', d.relationship ?? 'none')),
    'Contributed by': richText(people(d)),
  }),
  experiences: (d, ctx) => ({
    Name: title(d.name_en || d.name),
    'Name (VI)': richText(d.name),
    Slug: richText(d.slug),
    Session: multiSelect(tags('best_session', d.session)),
    'Best season': multiSelect(tags('best_season', d.best_season)),
    Area: select(tag('area', d.area)),
    Duration: select(tag('duration', d.duration)),
    'Best for': multiSelect(tags('good_for', d.good_for)),
    // Resolved slug -> page_id, so the relation can never drift the way V2's
    // paste-the-name-and-hope text column did.
    Stops: relation((d.stops ?? []).map(s => ctx.placePageIds.get(s)).filter(Boolean)),
    'Stops (in order)': richText(
      [...(d.stops ?? []).map(s => ctx.placeNames.get(s) ?? s), ...(d.stops_extra ?? [])].join(', ')),
    'Local tip (EN)': richText(d.local_tip?.en), 'Local tip (VI)': richText(d.local_tip?.vi),
    'Data status': select(statusLabel(d.status)),
    'Last checked': date(iso(d.last_checked)),
    'Contributed by': richText(people(d)),
  }),
  neighborhoods: d => ({
    Name: title(d.name_en || d.name),
    'Name (VI)': richText(d.name),
    Slug: richText(d.slug),
    Area: select(tag('area', d.area)),
    'Vibe (EN)': richText(d.vibe_notes?.en), 'Vibe (VI)': richText(d.vibe_notes?.vi),
    'Best for (EN)': richText(d.best_for?.en), 'Best for (VI)': richText(d.best_for?.vi),
    "What's here (EN)": richText(d.whats_here?.en), "What's here (VI)": richText(d.whats_here?.vi),
    'What we like (EN)': richText(d.what_we_like?.en), 'What we like (VI)': richText(d.what_we_like?.vi),
    "What we don't like (EN)": richText(d.what_we_dont_like?.en),
    "What we don't like (VI)": richText(d.what_we_dont_like?.vi),
    'Data status': select(statusLabel(d.status)),
    'Last checked': date(iso(d.last_checked)),
    'Contributed by': richText(people(d)),
  }),
};

// Hash what we actually send, not the YAML: a taxonomy label change then
// invalidates every page that uses it, with no extra bookkeeping.
const hashOf = props => createHash('sha256').update(JSON.stringify(props)).digest('hex').slice(0, 32);

/**
 * Adds any property the sync needs and the data source doesn't have yet, and
 * reports the ACTUAL type of everything else. We adapt to the workspace rather
 * than demanding it be reshaped — V2 built `Area` as a multi_select, and
 * retyping a column by hand is both risky and unnecessary.
 */
async function ensureSchema(kind, dsId) {
  const ds = await getDataSource(dsId);
  const actual = ds.properties ?? {};
  const add = {};
  for (const [name, type] of Object.entries(SPECS[kind])) {
    if (actual[name]) continue;
    add[name] = type === 'relation'
      ? { relation: { data_source_id: DS.places, type: 'single_property', single_property: {} } }
      : { [type]: {} };
  }
  const added = Object.keys(add);
  if (added.length && !DRY) {
    await updateDataSource(dsId, add);
    for (const n of added) actual[n] = { type: SPECS[kind][n] };
  }
  return { added, actual };
}

/**
 * Reshape a built property value to the column type Notion actually has.
 * Single-valued fields are interchangeable between select and multi_select, so
 * those convert losslessly. Anything genuinely incompatible is collected and
 * reported together — one round trip, not one per column.
 */
function conform(props, actual, kind, notes) {
  const bad = [];
  for (const [name, value] of Object.entries(props)) {
    const want = Object.keys(value)[0];
    const got = actual[name]?.type;
    if (!got || got === want) continue;

    if (want === 'select' && got === 'multi_select') {
      props[name] = { multi_select: value.select ? [{ name: value.select.name }] : [] };
    } else if (want === 'multi_select' && got === 'select') {
      // Lossy: only the first value survives. Loud, because it silently drops data.
      if (value.multi_select.length > 1) notes.add(
        `${kind}.${name}: Notion column is a single select, so only the first of ` +
        `${value.multi_select.length} values is written. Change it to multi-select in Notion to keep them all.`);
      props[name] = { select: value.multi_select[0] ?? null };
    } else if (want === 'select' && got === 'status') {
      props[name] = { status: value.select };
    } else if (want === 'rich_text' && got === 'url') {
      props[name] = { url: value.rich_text[0]?.text?.content || null };
    } else if (want === 'url' && got === 'rich_text') {
      props[name] = richText(value.url);
    } else {
      bad.push(`  "${name}" is a ${got} in Notion, but the sync writes ${want}`);
    }
  }
  if (bad.length) throw new Error(
    `Incompatible Notion columns on the ${kind} database:\n${bad.join('\n')}\n` +
    'Rename or retype those columns in Notion, then re-run. Nothing was changed.');
  return props;
}

/**
 * slug -> { pageId, hash }. Rows written by an earlier sync carry `Slug`.
 * Rows created by hand in V2 don't, so they are matched by Name once — that
 * match IS the one-off backfill, and it costs nothing to leave in place.
 */
function snapshot(rows, files) {
  const bySlug = new Map();
  const unclaimed = [];
  for (const row of rows) {
    const slug = plain(row, 'Slug').trim();
    if (slug) bySlug.set(slug, { pageId: row.id, hash: plain(row, 'Sync hash').trim() });
    else unclaimed.push(row);
  }
  const byName = new Map();
  for (const row of unclaimed) byName.set(plain(row, 'Name').trim().toLowerCase(), row);

  const adopted = [];
  for (const f of files) {
    if (bySlug.has(f.slug)) continue;
    for (const candidate of [f.name, f.name_en]) {
      const row = candidate && byName.get(String(candidate).trim().toLowerCase());
      if (!row) continue;
      bySlug.set(f.slug, { pageId: row.id, hash: '' });   // empty hash forces a write
      byName.delete(String(candidate).trim().toLowerCase());
      adopted.push(f.slug);
      break;
    }
  }
  return { bySlug, adopted, orphans: [...byName.values()] };
}

const log = [];
const notes = new Set();
const say = line => { log.push(line); console.log(line); };

async function syncKind(kind, ctx) {
  const dsId = DS[kind];
  if (!dsId) throw new Error(`Missing env var for ${kind} — set NOTION_${kind.toUpperCase()}_DS_ID.`);

  const files = entries.filter(e => e.kind === kind && e.data).map(e => e.data);
  const { added, actual } = await ensureSchema(kind, dsId);
  if (added.length) say(`  schema: added ${added.join(', ')}${DRY ? ' (dry run)' : ''}`);

  const rows = await queryAll(dsId);
  const { bySlug, adopted, orphans } = snapshot(rows, files);
  if (adopted.length) say(`  matched ${adopted.length} existing Notion row(s) by name (backfill)`);

  let created = 0, updated = 0, skipped = 0, archived = 0;

  for (const d of files) {
    const props = conform(BUILD[kind](d, ctx), actual, kind, notes);
    const hash = hashOf(props);
    const known = bySlug.get(d.slug);

    if (d.status === 'closed') {
      if (known && !DRY) await archivePage(known.pageId);
      if (known) archived++;
      continue;
    }
    if (known && known.hash === hash && !FULL) { skipped++; continue; }

    const withHash = { ...props, 'Sync hash': richText(hash) };
    if (known) {
      if (!DRY) await updatePage(known.pageId, withHash);
      updated++;
    } else {
      const page = DRY ? { id: `dry-${d.slug}` } : await createPage(dsId, withHash);
      bySlug.set(d.slug, { pageId: page.id, hash });
      created++;
    }
  }

  // Rows we previously created whose file is gone.
  const slugs = new Set(files.map(f => f.slug));
  for (const [slug, known] of bySlug) {
    if (slugs.has(slug)) continue;
    if (!DRY) await archivePage(known.pageId);
    archived++;
    say(`  archived ${slug} (no file in content/${kind}/)`);
  }

  if (kind === 'places')
    for (const [slug, known] of bySlug) {
      ctx.placePageIds.set(slug, known.pageId);
      ctx.placeNames.set(slug, files.find(f => f.slug === slug)?.name ?? slug);
    }

  say(`${kind}: ${created} created, ${updated} updated, ${skipped} unchanged, ${archived} archived`);
  if (orphans.length)
    say(`  ⚠️ ${orphans.length} Notion row(s) have no Slug and no matching file — left untouched: ` +
        orphans.map(r => plain(r, 'Name')).join(', '));
}

try {
  if (DRY) say('DRY RUN — no writes will be sent to Notion.\n');
  if (FULL) say('FULL resync — hashes ignored.\n');
  const ctx = { placePageIds: new Map(), placeNames: new Map() };
  // Places first: experience `Stops` relations need their page IDs.
  for (const kind of ['places', 'experiences', 'neighborhoods']) await syncKind(kind, ctx);
} catch (e) {
  const hint = e instanceof NotionError && e.isBlockLimit
    ? '\nThis is the workspace BLOCK LIMIT, not a permissions problem — the free plan is full.'
    : e instanceof NotionError && (e.status === 401 || e.status === 403)
      ? '\nCheck that NOTION_TOKEN is current AND that the integration is connected to the parent page (page ⋯ → Connections).'
      : '';
  console.error(`\nSync failed: ${e.message}${hint}`);
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `SYNC_ERROR<<EOF\n${e.message}${hint}\nEOF\n`);
  process.exit(1);
}

for (const n of notes) say(`⚠️ ${n}`);

if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Notion sync\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n`);

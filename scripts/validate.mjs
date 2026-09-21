#!/usr/bin/env node
// PR CI. Runs with no secrets so it is safe on fork pull requests.
// Exits 1 on any error; warnings never fail the build.
import { loadContent, normalizeForCompare, KINDS } from './lib/content.mjs';

const REQUIRED = {
  places: ['slug', 'name', 'type', 'category', 'area', 'why_we_go', 'status', 'last_checked'],
  experiences: ['slug', 'name', 'session', 'area', 'local_tip', 'status', 'last_checked'],
  neighborhoods: ['slug', 'name', 'status', 'last_checked'],
};

// Which enum group each field draws from. Arrays are multi-select.
const ENUMS = {
  type: ['type', false], category: ['category', false], area: ['area', false],
  price_band: ['price_band', false], status: ['status', false],
  relationship: ['relationship', false], duration: ['duration', false],
  best_session: ['best_session', true], session: ['best_session', true],
  best_season: ['best_season', true], vibe: ['vibe', true], good_for: ['good_for', true],
};

const BILINGUAL = ['must_try', 'why_we_go', 'hours_notes', 'local_tip', 'what_we_like',
  'what_we_dont_like', 'vibe_notes', 'best_for', 'whats_here'];

// maps.app.goo.gl is Google's current stable Maps share format — not flagged.
// Bare goo.gl was shut down in 2025; share.google/g.page/g.co are opaque redirects.
const SHORTENERS = /^https?:\/\/(bit\.ly|tinyurl\.com|share\.google|goo\.gl|g\.page|g\.co)\//i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
// A Vietnamese phone number: 9-11 digits, optionally separated. Deliberately
// anchored on a leading 0 or +84 so prices ("45k–70k") and times don't trip it.
const PHONE = /(?:\+?84|\b0)[\d](?:[\s.\-]?\d){7,9}\b/;

const errors = [], warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const { taxonomy, entries } = loadContent();
const today = new Date().toISOString().slice(0, 10);
const placeSlugs = new Set();
const seen = [];

for (const e of entries) {
  if (e.parseError) { err(e.file, `YAML does not parse — ${e.parseError}`); continue; }
  const d = e.data;
  if (!d || typeof d !== 'object') { err(e.file, 'file is empty or not a mapping'); continue; }

  for (const k of REQUIRED[e.kind]) {
    const v = d[k];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) err(e.file, `missing required field \`${k}\``);
  }

  // slug
  if (d.slug != null) {
    if (!/^[a-z0-9-]+$/.test(String(d.slug))) err(e.file, `slug \`${d.slug}\` must match ^[a-z0-9-]+$`);
    if (d.slug !== e.expectedSlug) err(e.file, `slug \`${d.slug}\` must equal the filename \`${e.expectedSlug}\``);
  }
  if (e.kind === 'places') placeSlugs.add(d.slug);

  // enums
  for (const [field, [group, isMulti]] of Object.entries(ENUMS)) {
    if (d[field] == null) continue;
    const vals = isMulti ? (Array.isArray(d[field]) ? d[field] : [d[field]]) : [d[field]];
    if (isMulti && !Array.isArray(d[field])) err(e.file, `\`${field}\` must be a list`);
    for (const v of vals) {
      if (!(String(v) in (taxonomy[group] ?? {})))
        err(e.file, `\`${field}: ${v}\` is not a key in taxonomy.yml \`${group}\``);
    }
  }
  if (d.category && d.type && taxonomy.category[d.category]?.of !== d.type)
    err(e.file, `category \`${d.category}\` belongs to type \`${taxonomy.category[d.category]?.of}\`, not \`${d.type}\``);

  // bilingual blocks
  for (const k of BILINGUAL) {
    if (d[k] == null) continue;
    if (typeof d[k] !== 'object' || Array.isArray(d[k])) { err(e.file, `\`${k}\` must be a { vi, en } mapping`); continue; }
    if (!d[k].vi) err(e.file, `\`${k}.vi\` is empty — Vietnamese is the source language`);
    if (!d[k].en) warn(e.file, `\`${k}.en\` is missing — needs-translation`);
  }

  // freshness
  const lc = d.last_checked instanceof Date ? d.last_checked.toISOString().slice(0, 10) : String(d.last_checked ?? '');
  if (d.last_checked != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lc)) err(e.file, `last_checked \`${lc}\` must be an ISO date (YYYY-MM-DD)`);
    else if (lc > today) err(e.file, `last_checked \`${lc}\` is in the future`);
  }

  // links
  for (const [k, v] of Object.entries(d)) {
    if (k !== 'link' && k !== 'booking_link') continue;
    try { new URL(v); } catch { err(e.file, `\`${k}\` is not a valid URL: ${v}`); continue; }
    if (SHORTENERS.test(v)) warn(e.file, `\`${k}\` is a shortener and will rot — replace with a stable Maps place link`);
  }

  // PII in prose
  for (const [k, v] of Object.entries(d)) {
    for (const text of typeof v === 'string' ? [v] : (v && typeof v === 'object' ? Object.values(v).filter(x => typeof x === 'string') : [])) {
      if (k === 'link' || k === 'booking_link') continue;
      if (PHONE.test(text)) err(e.file, `\`${k}\` looks like it contains a phone number — remove personal contact details`);
      if (EMAIL.test(text)) err(e.file, `\`${k}\` contains an email address — remove personal contact details`);
    }
  }

  if (d.name) seen.push({ file: e.file, kind: e.kind, name: normalizeForCompare(d.name), address: normalizeForCompare(d.address) });
}

// experience stops must resolve to a real place
for (const e of entries.filter(x => x.kind === 'experiences' && x.data)) {
  for (const s of e.data.stops ?? [])
    if (!placeSlugs.has(s)) err(e.file, `stop \`${s}\` does not match any content/places/*.yml slug`);
}

// near-duplicates
for (let i = 0; i < seen.length; i++) {
  for (let j = i + 1; j < seen.length; j++) {
    const a = seen[i], b = seen[j];
    if (a.kind !== b.kind) continue;
    if (similarity(a.name, b.name) >= 0.85)
      err(b.file, `name is ${(similarity(a.name, b.name) * 100) | 0}% similar to ${a.file} — duplicate?`);
    else if (a.address && b.address && houseNumber(a.address) === houseNumber(b.address)
             && similarity(a.address, b.address) >= 0.85)
      err(b.file, `address is near-identical to ${a.file} — duplicate? If it's a second branch, keep one file and put the other address in hours_notes.`);
  }
}

/** Leading house number, so "92 Huỳnh Thúc Kháng" and "134 Huỳnh Thúc Kháng"
 *  are not reported as the same address. */
function houseNumber(s) { return (s.match(/\d+/) ?? [''])[0]; }

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// ---- report ---------------------------------------------------------------
const counts = KINDS.map(k => `${entries.filter(e => e.kind === k).length} ${k}`).join(', ');
const lines = [];
if (errors.length) lines.push(`### ❌ ${errors.length} error${errors.length > 1 ? 's' : ''}\n`, ...errors.map(e => `- ${e}`), '');
if (warnings.length) lines.push(`### ⚠️ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}\n`, ...warnings.map(w => `- ${w}`), '');
if (!errors.length) lines.push(`### ✅ All checks passed\n`);
lines.push(`_Checked ${counts}._`);
const report = lines.join('\n');
console.log(report);

if (process.env.GITHUB_STEP_SUMMARY)
  (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');

process.exit(errors.length ? 1 : 0);

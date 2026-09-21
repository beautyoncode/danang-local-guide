// The shared content loader. validate.mjs, sync-notion.mjs and build-readme.mjs
// all read content through here — it is the project's de-facto internal API.
// Future surfaces (website, chatbot, app) should do the same rather than
// re-parsing YAML or scraping Notion.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT = join(ROOT, 'content');

export const KINDS = ['places', 'experiences', 'neighborhoods'];

export function loadTaxonomy() {
  return YAML.parse(readFileSync(join(CONTENT, 'taxonomy.yml'), 'utf8'));
}

function loadDir(kind) {
  const dir = join(CONTENT, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.yml'))
    .sort()
    .map(f => {
      const path = join(dir, f);
      const raw = readFileSync(path, 'utf8');
      let data;
      try {
        data = YAML.parse(raw);
      } catch (e) {
        return { file: `content/${kind}/${f}`, kind, parseError: e.message, data: null };
      }
      return { file: `content/${kind}/${f}`, kind, expectedSlug: basename(f, '.yml'), data };
    });
}

export function loadContent() {
  const taxonomy = loadTaxonomy();
  const entries = KINDS.flatMap(loadDir);
  return { taxonomy, entries, byKind: k => entries.filter(e => e.kind === k) };
}

/** Stable hash of an entry's data — drives the Notion sync short-circuit. */
export function contentHash(data) {
  return createHash('sha256').update(canonicalJson(data)).digest('hex').slice(0, 32);
}

function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

/** "Son Tra" / "Sơn Trà" — a single label in one language. */
export function label(taxonomy, group, key, lang = 'en') {
  return taxonomy[group]?.[key]?.[lang] ?? key;
}

/** "🌅 Early Morning · Sáng sớm" — the V2 Notion select-option convention. */
export function notionLabel(taxonomy, group, key) {
  const t = taxonomy[group]?.[key];
  if (!t) return key;
  if (group === 'price_band') return t.glyph;
  return `${t.emoji ? t.emoji + ' ' : ''}${t.en} · ${t.vi}`;
}

/** Vietnamese-aware slug: "Mỳ Quảng Vỉa Hè (Hà Thân)" -> "my-quang-via-he-ha-than" */
export function slugify(s) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Diacritic- and punctuation-insensitive form, for duplicate detection. */
export function normalizeForCompare(s) {
  return slugify(String(s || '')).replace(/-/g, ' ').trim();
}

export { YAML };

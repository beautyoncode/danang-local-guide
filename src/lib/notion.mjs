// Minimal Notion REST client. We touch four endpoints, so plain fetch beats
// @notionhq/client — and we need our own 429/529 handling either way.
//
// API shape note: since 2025-09-03 a database exposes one or more *data
// sources*. Pages are created with parent { type: 'data_source_id', ... } and
// queried at /v1/data_sources/{id}/query. Older `database_id` parenting is the
// pre-2025 shape — don't copy it from old blog posts.
const API = 'https://api.notion.com';
export const NOTION_VERSION = '2026-03-11';

// Notion's published limit is an average of ~3 requests/second per integration.
const MIN_GAP_MS = 400;
const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;

export class NotionError extends Error {
  constructor(status, body, method, path) {
    super(`${method} ${path} -> ${status} ${body?.code ?? ''}: ${body?.message ?? ''}`.trim());
    this.name = 'NotionError';
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
  /** A free-plan block limit surfaces as a 403 and reads like a permissions
   *  problem. Tell the two apart so the sync-failure issue is actionable. */
  get isBlockLimit() {
    return this.status === 403 && /block limit|workspace.*limit/i.test(this.body?.message ?? '');
  }
}

let chain = Promise.resolve();
let lastSentAt = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** All requests run through one serialized, paced queue. */
export function notion(method, path, body) {
  const run = async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastSentAt);
    if (wait > 0) await sleep(wait);
    lastSentAt = Date.now();
    return send(method, path, body);
  };
  chain = chain.then(run, run);
  return chain;
}

async function send(method, path, body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN is not set.');
  const idempotent = method === 'GET' || path.endsWith('/query');

  for (let attempt = 1; ; attempt++) {
    let res, json;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      json = await res.json().catch(() => ({}));
    } catch (networkError) {
      if (attempt >= MAX_ATTEMPTS) throw networkError;
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) return json;

    const retryable = res.status === 429 || res.status === 529
      || (res.status >= 500 && idempotent);
    if (!retryable || attempt >= MAX_ATTEMPTS) throw new NotionError(res.status, json, method, path);

    // Notion sends Retry-After as whole seconds on 429.
    const after = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : backoff(attempt));
  }
}

const backoff = attempt =>
  Math.min(MAX_BACKOFF_MS, 2 ** attempt * 250) + Math.random() * 250;

/** Every page in a data source, following pagination. 100 rows per request. */
export async function queryAll(dataSourceId) {
  const out = [];
  let cursor;
  do {
    const page = await notion('POST', `/v1/data_sources/${dataSourceId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return out;
}

export const getDataSource = id => notion('GET', `/v1/data_sources/${id}`);
export const updateDataSource = (id, properties) =>
  notion('PATCH', `/v1/data_sources/${id}`, { properties });
export const createPage = (dataSourceId, properties) =>
  notion('POST', '/v1/pages', {
    parent: { type: 'data_source_id', data_source_id: dataSourceId },
    properties,
  });
export const updatePage = (pageId, properties) =>
  notion('PATCH', `/v1/pages/${pageId}`, { properties });
export const archivePage = pageId =>
  notion('PATCH', `/v1/pages/${pageId}`, { archived: true });

// ---- property value helpers ----------------------------------------------
// Notion caps a single rich_text item at 2000 characters.
const RICH_TEXT_LIMIT = 2000;

export const title = s => ({ title: [{ text: { content: String(s ?? '').slice(0, RICH_TEXT_LIMIT) } }] });
export const richText = s => {
  const v = String(s ?? '');
  return { rich_text: v ? [{ text: { content: v.slice(0, RICH_TEXT_LIMIT) } }] : [] };
};
export const select = name => ({ select: name ? { name } : null });
export const multiSelect = names => ({ multi_select: (names ?? []).map(name => ({ name })) });
export const url = u => ({ url: u || null });
export const date = d => ({ date: d ? { start: d } : null });
export const relation = ids => ({ relation: (ids ?? []).map(id => ({ id })) });

/** Read a property back out of a page object, as a plain string. */
export function plain(page, name) {
  const p = page.properties?.[name];
  if (!p) return '';
  if (p.type === 'title') return p.title.map(t => t.plain_text).join('');
  if (p.type === 'rich_text') return p.rich_text.map(t => t.plain_text).join('');
  if (p.type === 'select') return p.select?.name ?? '';
  return '';
}

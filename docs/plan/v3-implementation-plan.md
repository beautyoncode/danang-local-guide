# V3 — Da Nang Local Guide: community repo → auto-synced Notion

## Context

Two assets exist and are drifting apart:

- **V1** — [`GraphicDThanh/danang-cuisine`](https://github.com/GraphicDThanh/danang-cuisine), now flattened into [this repo's root](../../). A 544-line hand-written Vietnamese README plus 6 translated copies in [versions/](../../versions/). Content only. Contribution = "create an issue"; no schema, no review process, no freshness signal.
- **V2** — a manually built bilingual Notion workspace, specced in [docs/claude-notion-da-nang-local-guide/](../claude-notion-da-nang-local-guide/): 62 places, 9 experiences, 5 neighborhoods as CSVs, a 222-line [build guide](../claude-notion-da-nang-local-guide/00%20-%20Build%20Guide%20(start%20here).md), homepages and a methodology page. Everything is `Data status = Draft - verify`.

The problem: V1 and V2 are **two copies of the same facts**. Every price change has to be made twice, by hand, in a format only the author can edit. Neither has a way for a local to add a place without a maintainer rewriting Markdown. V2's strengths (structured fields — Area, Price band, Best session, Vibe, Good for; a real "Why we go" note per place; `Last checked`) exist nowhere in V1.

**V3 makes the repo the single source of truth and the Notion page a generated view of it.** One structured YAML file per place; CI validates every contribution; a GitHub Action pushes merged changes into the Notion databases; the README is regenerated from the same data. Anyone can contribute — **including people with no GitHub account**, via a public form that opens an issue for your team to review. The Notion page stays public and duplicatable.

**Decisions taken** (confirmed):

1. Content licensed **CC BY-NC-SA 4.0** with contributor terms granting the project the right to publish paid products, including software services (§7 Risk 5).
2. The sync owns **database properties only** — Notion page bodies stay human-owned.
3. YAML carries **vi + en**; the 5 other translations are frozen.
4. **`best_season` is a first-class field** alongside `best_session`, so the guide answers "I'm in Da Nang in October" as well as "it's 7AM" (§3.1).
5. **A public Google Form → GitHub issue** is the on-ramp for non-technical contributors (§4.6).
6. Website, membership, chatbot and mobile app are **out of scope for V3** but are the stated direction — §6.1 records what today's design must not block.

---

## 1. Summary

| | V1 | V2 | V3 |
| --- | --- | --- | --- |
| Source of truth | README.md | Notion (manual) | `content/**/*.yml` in the repo |
| Structure | Markdown headings | 28 Notion properties | YAML schema + `taxonomy.yml` |
| Contribution | Open an issue, maintainer types it | None | Public form (no account) → issue → PR; GitHub Issue Form → PR; or direct PR |
| Quality gate | Reviewer's memory | None | CI schema + duplicate + staleness checks |
| Freshness | Unknown | `Last checked` column, unused | `last_checked` + status + re-verify bot |
| Publishing | GitHub README | Manual Notion edits | Action pushes to Notion on merge |
| Languages | 7 hand-written | VI + EN columns | VI + EN generated; 5 frozen |

**Scope in:** places, experiences, neighborhoods; bilingual VI/EN; one-way sync GitHub → Notion; public duplicatable Notion page.

**Scope out (deliberately):** two-way sync, a website, photo hosting in Git, machine translation, maps/geo, the paid edition's storefront. Each is a later phase, none blocks launch.

---

## 2. Architecture overview

```
 contributor                   repo (source of truth)              Notion (published view)
┌──────────────┐  Google    ┌──────────────────────────┐        ┌────────────────────────┐
│ anyone       │──Form───┐  │                          │        │ 🌴 Da Nang Local Guide │
│ (no GitHub)  │         │  │                          │        │   ├ Places (DS)        │
└──────────────┘         ▼  │                          │        │   ├ Experiences (DS)   │
              Apps Script ──▶ GitHub Issue (via-form)  │        │   └ Neighborhoods (DS) │
┌──────────────┐   issue    │        │                 │        │  published + duplicate │
│ local/tourist│──form────▶ │ .github/ISSUE_TEMPLATE   │        └────────────▲───────────┘
│ (has GitHub) │            │        │                 │                     │
└──────────────┘            │        ▼ issue-to-pr bot │                     │
┌──────────────┐    PR      │ content/places/*.yml     │                     │
│ contributor  │──────────▶ │ content/taxonomy.yml     │                     │
│ (git)        │            └──────────┬───────────────┘                     │
└──────────────┘                       │                                     │
                        PR CI ─────────┤ validate.mjs (schema, enums,        │
                        (no secrets)   │   dupes, URLs, PII, translation)    │
                                       │                                     │
                        merge to main ─┴─▶ sync-notion.mjs ───── Notion API ─┘
                                          build-readme.mjs ──▶ README.md / README.en.md
```

**Data flow on merge:** push to `main` touching `content/**` → `sync-notion.yml` → read all YAML → fetch slug→page_id map from each Notion data source (1 query per 100 rows) → for each file whose `sync_hash` differs, `PATCH /v1/pages/{id}` or `POST /v1/pages` → write back nothing to the repo except the regenerated README (separate job, commits to `main`).

### Tool choices

| Choice | Why |
| --- | --- |
| **YAML, one file per entry** | PR diffs are readable by a reviewer who doesn't code; two people adding places never conflict; the GitHub web editor handles it. CSV (V2's format) fails all three — 28 quoted columns on one line, and every PR touches the same file. |
| **GitHub Actions** | Already where the repo lives. No server, no cron host, no bill. |
| **Notion REST API, `Notion-Version: 2026-03-11`** | Current version: databases expose **data sources**; pages are created with `parent: { type: "data_source_id", data_source_id }`. Older `database_id` parenting is the pre-2025-09-03 shape — do not copy it from old blog posts. |
| **Plain `fetch` + a ~60-line client, not `@notionhq/client`** | We use 4 endpoints. The SDK's retry behaviour is good but we need custom 429/529 handling anyway (see §4.5). Revisit if we ever touch blocks in bulk. |
| **Properties-only sync** | Notion has no "replace all children" block operation — syncing bodies means delete-all + re-append on every run, destroying manually added photos. All prose lives in `rich_text` properties (2000-char limit is ample), page bodies stay human-owned. |
| **One-way sync** | Two-way sync needs conflict resolution and is where projects like this die. The public Notion page is read-only to visitors anyway; duplicates are snapshots by design. Notion edits by maintainers get overwritten — stated loudly in CONTRIBUTING. |

---

## 3. Repository design

Work in the existing repo. Current [README.md](../../README.md) becomes generated output; [src/images/](../../src/images/) stays.

```
content/
  taxonomy.yml                 # every enum + its bilingual display label
  places/<slug>.yml            # 62 entries, migrated from Places.csv
  experiences/<slug>.yml       # 9,  from Experiences.csv
  neighborhoods/<slug>.yml     # 5,  from Neighborhoods.csv
scripts/
  validate.mjs                 # PR CI — no secrets
  sync-notion.mjs              # main only
  build-readme.mjs             # regenerates README.md + versions/README.en.md
  import-csv.mjs               # one-shot migration, deleted after Phase 1
  lib/notion.mjs               # fetch wrapper, retry, pagination
.github/
  ISSUE_TEMPLATE/{new-place.yml,update-place.yml,report-closed.yml,config.yml}
  PULL_REQUEST_TEMPLATE.md
  workflows/{validate.yml,sync-notion.yml,stale-check.yml,issue-to-pr.yml}
  CODEOWNERS
CONTRIBUTING.md  CODE_OF_CONDUCT.md  STYLE.md
LICENSE-CONTENT (CC BY-NC-SA 4.0)   LICENSE-CODE (MIT)
README.md  (generated, VI)          versions/README.en.md (generated)
versions/legacy/  (ko, ja, zh, es, ar — frozen, banner added)
```

### 3.1 Place schema

`content/places/my-quang-via-he-ha-than.yml`:

```yaml
slug: my-quang-via-he-ha-than      # immutable; the Notion join key
name: Mỳ Quảng Vỉa Hè (Hà Thân)     # Vietnamese name — matches signs and Maps
type: food                          # taxonomy key
category: my-quang
area: son-tra
address: Ngã tư viện kiểm sát Sơn Trà và chợ Hà Thân, đối diện xéo công viên
price_vnd: "15k–20k"                # string: ranges don't fit a number
price_band: "1"                     # 1..4 → ₫ ₫₫ ₫₫₫ ₫₫₫₫
best_session: [early-morning, morning]
best_season: [year-round]           # or e.g. [summer] for beach/SUP, [autumn, winter] for rainy-day food
vibe: [street-food, local]
good_for: [solo]
must_try:   { vi: Mỳ Quảng, en: Mỳ Quảng }
why_we_go:
  vi: Mỳ Quảng siêu ngon, chưa ăn chỗ nào ngon hơn và rẻ hơn...
  en: Best and cheapest Mỳ Quảng we know. The seller comes from Quảng Nam...
hours_notes: { vi: "Chỉ bán 6–8AM, tầm 8h là hết.", en: "6–8AM only, sells out ~8AM." }
link: https://maps.app.goo.gl/3UofRQcmJy12LZc37
status: draft                       # draft | verified | closed
last_checked: 2026-09-21
relationship: none                  # none | owner | family-or-friend  (disclosure)
contributed_by: [GraphicDThanh]
```

Notes:
- **Keys not labels.** V2 stored `🍜 Food · Đồ ăn` in every row. V3 stores `food`; `taxonomy.yml` holds the label once. Renaming a category becomes a one-line change instead of 62.
- `slug` is immutable and drives the Notion upsert. Renaming a place changes `name`, never `slug`.
- `price_band` is `1..4`, not glyphs — typo-proof and sortable.
- `relationship` is the conflict-of-interest disclosure; `owner` forces a maintainer review and shows as a badge.
- `status: closed` keeps the file (so we don't re-add a dead place) and archives the Notion page.
- **`best_season` is the second time axis.** `best_session` answers *what time today*; `best_season` answers *what month of the year you're visiting*. A tourist arriving in October needs different answers than one arriving in June — beach swimming, SUP and sunset spots are summer-shaped, while garden cafés, rainy-day food and Hội An rice fields have their own windows. Defaults to `[year-round]`, which is the honest answer for most food stalls.

`experiences` adds `session`, `best_season`, `duration`, `stops: [<place slug>]` (validated to exist — fixes V2's fragile text-matching relation), `local_tip: {vi,en}`. `neighborhoods` adds `what_we_like` / `what_we_dont_like` `{vi,en}`.

### 3.2 taxonomy.yml

```yaml
area:
  son-tra:    { vi: Sơn Trà,   en: Son Tra }
  hai-chau:   { vi: Hải Châu,  en: Hai Chau }
  my-an:      { vi: Mỹ An,     en: My An }
  lien-chieu: { vi: Liên Chiểu, en: Lien Chieu }
  hoi-an:     { vi: Hội An,    en: Hoi An }
best_session:
  early-morning: { vi: Sáng sớm, en: Early Morning, emoji: "🌅", time: "4:30–7AM" }
  # ...
best_season:
  year-round: { vi: Quanh năm,  en: Year-round, emoji: "🗓️", months: "1–12" }
  spring:     { vi: Mùa xuân,   en: Spring,     emoji: "🌸", months: "2–4",  note_en: "Mild, Tết, least rain", note_vi: "Mát mẻ, dịp Tết, ít mưa" }
  summer:     { vi: Mùa hè,     en: Summer,     emoji: "☀️", months: "5–8",  note_en: "Hot; beach, SUP, sunsets", note_vi: "Nóng; biển, SUP, hoàng hôn" }
  autumn:     { vi: Mùa thu (mùa mưa), en: "Autumn · rainy season", emoji: "🌧️", months: "9–11", note_en: "Rain and storm season", note_vi: "Mùa mưa bão" }
  winter:     { vi: Mùa đông,   en: Winter,     emoji: "🧥", months: "12–1", note_en: "Cool, drizzly, cosy food weather", note_vi: "Trời lạnh, mưa phùn, hợp món nóng" }
```

Notion select options render as `en · vi` (V2's convention — Notion cannot translate option labels). CI rejects any value not in `taxonomy.yml`, so the sync never invents junk select options.

**Finding from surveying the V2 CSVs — `Vibe` needs consolidating before import.** Current distinct-value counts across the 62 places:

| Column | Distinct values | Verdict |
| --- | --- | --- |
| Type | 6 | Keep as-is |
| Area | 5 | Keep as-is |
| Best session | 8 | Keep as-is |
| Good for | 14 | Keep, minor merges (`Group` / `Small group`) |
| Category | 26 | Keep — genuinely one taxonomy per Type |
| **Vibe** | **53, of which ~30 are used exactly once** | **Consolidate to ~24** |

A 53-option multi-select is not a filter, it's noise — `Views` / `View` / `Sea view`, `Chill` / `Chill music` / `Relax` / `Relaxed`, `Forest` / `Jungle`, `Retro` / `Retro-modern`, and `Premium` / `Mid-range` / `Budget` (which duplicate `price_band`) all fragment the same intent. `import-csv.mjs` therefore carries an **explicit alias map** from each old label to its new key; the map doubles as the migration record, so any later question of "where did `Tree-lined` go?" has a written answer. Values that are really other fields (`Sunrise`, `Sunset` → `best_session`; the price tiers → `price_band`) are dropped from `vibe` rather than translated.

> **Assumption:** area names stay the informal ones locals use. Da Nang merged with Quảng Nam in 2025 and official district names changed; `taxonomy.yml` gets an `official_name` field per area so the guide can show both without restructuring.

### 3.3 Two non-technical paths

| Path | For | Needs | Lands as |
| --- | --- | --- | --- |
| **Public Google Form** | Anyone — a tourist who just ate somewhere, a local with no GitHub account | Nothing | An issue labelled `via-form` `needs-triage`, body already formatted as a YAML block (§4.6) |
| **GitHub Issue Form** | Someone who has a GitHub account but doesn't want to touch files | GitHub login | An issue labelled `new-place` |
| Direct PR | Contributors comfortable with Git | GitHub + Git | A PR straight into CI review |

All three converge on the same issue/PR body shape, so triage and the Phase 4 `issue-to-pr` bot have **one** parser, not three.

#### GitHub Issue Forms

`new-place.yml` asks, in Vietnamese and English on the same form: name, address or Maps link, type, area, rough price, best time of day, **best season** (checkboxes: year-round / spring / summer / autumn-rainy / winter), what to order, why you go (2–3 sentences), when you last went, any downside, and a relationship disclosure. All fields map 1:1 to schema keys so the conversion (manual in Phase 1, bot in Phase 4) is mechanical. `update-place.yml` and `report-closed.yml` take a slug plus what changed. `config.yml` points general chat at Discussions.

### 3.4 PR template

Checklist: I've been there in person · price/hours are what I actually saw · I filled `last_checked` · VI and EN both written (or `needs-translation` label) · no phone numbers or personal data · I agree to CC BY-NC-SA 4.0 and to the project publishing a compiled edition with credit.

### 3.5 Labels

`new-place` · `update` · `closed-or-moved` · `needs-verification` · `needs-translation` · `needs-en-review` · `duplicate` · `good-first-contribution` · `area:hai-chau` (one per area) · `sync-failure` · `stale`

### 3.6 CODEOWNERS

```
/content/     @GraphicDThanh
/scripts/     @GraphicDThanh
/.github/     @GraphicDThanh
```
Area stewards are added here as they appear. Steward-per-area starts as a social role in CONTRIBUTING, not machinery.

---

## 4. Automation design

### 4.1 `validate.yml` — every PR, no secrets

Runs on `pull_request` (including from forks, hence **no secrets**): `node scripts/validate.mjs`.

| Check | Failure mode |
| --- | --- |
| YAML parses; required fields present | error |
| Every enum value exists in `taxonomy.yml` | error |
| `slug` unique, matches filename, `^[a-z0-9-]+$` | error |
| `experiences[].stops` all resolve to a place slug | error |
| `link` is a valid URL; no `bit.ly`/`share.google` shorteners | warning (V2 flagged several) |
| Near-duplicate: normalized name or address ≥0.85 similar to an existing entry | error, names the match |
| PII: phone-number and email regex in prose fields | error (V2 had to strip a seller's phone by hand) |
| `last_checked` present, ISO date, not in the future | error |
| `why_we_go.en` missing | warning → bot applies `needs-translation` |

Posts a single sticky comment with the results so a first-time contributor sees a readable list, not a log.

### 4.2 `sync-notion.yml` — push to `main`

```yaml
on:
  push: { branches: [main], paths: ['content/**'] }
  workflow_dispatch:
    inputs: { full: { description: 'Force full resync', type: boolean, default: false } }
concurrency: { group: notion-sync, cancel-in-progress: false }   # never two syncs at once
permissions: { contents: write, issues: write }
```

Steps: checkout → setup-node → `node scripts/sync-notion.mjs` → `node scripts/build-readme.mjs` → commit README if changed (`[skip ci]`) → on failure, open-or-update a `sync-failure` issue.

### 4.3 `sync-notion.mjs`

1. **Load** all `content/**/*.yml` + `taxonomy.yml`. Compute `sha256` of each file's canonical JSON.
2. **Snapshot Notion** — `POST /v1/data_sources/{id}/query` paginated (100/page ⇒ 1 request for today's 62 places), building `slug → { page_id, sync_hash, archived }`. Two extra properties on each database carry this: `Slug` (rich_text, unique) and `Sync hash` (rich_text). Cheaper and more robust than storing page IDs back in the repo.
3. **Diff** — create / update-if-hash-differs / archive when `status: closed` or the file is gone. `full: true` ignores hashes.
4. **Write** — serialized through a queue at ~2.5 req/s (limit is ~3/s average per connection).

```js
// create
POST /v1/pages
{ "parent": { "type": "data_source_id", "data_source_id": PLACES_DS },
  "properties": { "Name": { "title": [{ "text": { "content": name } }] },
                  "Slug": { "rich_text": [{ "text": { "content": slug } }] },
                  "Area": { "select": { "name": "Son Tra · Sơn Trà" } },
                  "Best session": { "multi_select": [{ "name": "🌅 Early Morning · Sáng sớm" }] },
                  "Last checked": { "date": { "start": "2026-09-21" } },
                  "Link": { "url": link },
                  "Sync hash": { "rich_text": [{ "text": { "content": hash } }] } } }
// update: PATCH /v1/pages/{page_id} with the same properties object
// close:  PATCH /v1/pages/{page_id} { "archived": true }
```

Page **bodies are never touched** — no `blocks.children` calls at all. That is the whole reason this stays safe to re-run.

### 4.4 Property mapping

| YAML | Notion property | Type |
| --- | --- | --- |
| `slug` | Slug | rich_text (join key) |
| `name` | Name | title |
| `type`, `category`, `area` | Type, Category, Area | select (`en · vi` label from taxonomy) |
| `price_vnd` | Price (VND) | rich_text |
| `price_band` | Price band | select (`₫`…`₫₫₫₫`) |
| `best_session`, `best_season`, `vibe`, `good_for` | same names (`Best season` is **new** — added to the V2 databases in Phase 2's backfill) | multi_select |
| `must_try.{vi,en}` etc. | Must try (EN) / (VI), Why we go (EN) / (VI), Hours & notes (EN) / (VI) | rich_text |
| `link` | Link | url |
| `status` | Data status | select |
| `last_checked` | Last checked | date |
| `contributed_by` | Contributed by | rich_text |
| file hash | Sync hash | rich_text |
| `experiences.stops` | Stops | relation → Places (resolved slug → page_id from the snapshot; fixes V2's paste-and-hope matching) |

Everything else V2 defined (`Photo`, `EN reviewed`, `Localness`, `Value`, `Indoor/Outdoor`, `English friendly`, `Payment`, `Open days`) stays **Notion-owned and untouched by the sync** — maintainers curate those in Notion. Documented in CONTRIBUTING so nobody expects them in YAML.

> **Assumption:** we reuse the V2 databases rather than creating new ones. Phase 2 starts with a one-off backfill that writes `Slug` + `Sync hash` onto the 62 existing rows by matching `Name`, so no content is recreated or lost.

### 4.5 Failure handling

| Failure | Handling |
| --- | --- |
| 429 / 529 | Honour `Retry-After` (integer seconds); else exponential backoff capped at 30s + up to 250ms jitter; 5 attempts. Notion's documented policy. |
| 500/502/503/504 | Retry only idempotent GETs; a failed write is left for the next run — the hash simply doesn't advance. |
| 400 (bad property/option) | Fail fast, no retry. Almost always a taxonomy drift → the error names the file and property. |
| 401 / 403 | Fail the job and open a `sync-failure` issue: token expired, or the integration lost access to the parent page. |
| Partial run | Safe by construction: hashes are written per page after its own successful write, so a re-run resumes. |
| Two syncs racing | `concurrency: notion-sync` with `cancel-in-progress: false`. |
| Silent drift | `workflow_dispatch` with `full: true` reconciles everything; weekly scheduled full sync in Phase 4. |

### 4.6 Public form → GitHub issue

**The whole point:** someone who has never heard of GitHub can add a place from their phone, and it arrives in your review queue in the shape you already review.

**Chosen stack: Google Form + Apps Script trigger.** Justification against the "least resource" constraint:

| Option | Hosting | Cost | Why not |
| --- | --- | --- | --- |
| **Google Form + Apps Script** ✅ | None | Free | — Token lives in Script Properties, never in a browser. Native Vietnamese, mobile-first, file upload to Drive (photos, which the repo deliberately doesn't store). You already run on Google. |
| Tally / Fillout + webhook | None | Free tier | Custom auth headers on webhooks are usually a paid feature; adds a vendor with a row limit. |
| Static HTML + Cloudflare Worker | Worker | Free tier | A deploy, a secret, and a domain to maintain. **This is the right upgrade path when the public website happens** — the Worker replaces Apps Script and nothing downstream changes. |
| Static form posting straight to GitHub | None | Free | **Rejected on security**: any token shipped to the browser is public. Non-starter. |

**Apps Script** (~40 lines, bound to the form's response sheet, `onFormSubmit` installable trigger):

```js
function onFormSubmit(e) {
  const r = e.namedValues;                       // { "Tên quán / Name": ["..."], ... }
  const get = k => (r[k] && r[k][0] || '').trim();

  if (!get('Tên quán / Name')) return;                                  // empty submit
  if (/https?:\/\//i.test(get('Vì sao bạn thích / Why you go')))         // crude link-spam guard
    return label_(createIssue_(r, ['via-form', 'needs-triage', 'possible-spam']));

  const body = [
    '> Submitted via the public form. Not yet reviewed.',
    '', '```yaml', toYamlBlock_(r), '```', '',
    `**Last visited:** ${get('Bạn đi gần đây nhất khi nào / When did you last go')}`,
    `**Downside:** ${get('Điểm trừ / Any downside')}`,
    `**Relationship to the place:** ${get('Bạn có liên quan tới quán không / Relationship')}`,
    `**Photos:** ${get('Ảnh / Photos')}`,
    `**Contact (optional, for credit):** ${get('Tên để ghi nhận / Name for credit')}`,
  ].join('\n');

  UrlFetchApp.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('GH_TOKEN'),
      Accept: 'application/vnd.github+json',
    },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      title: `[form] ${get('Tên quán / Name')}`,
      body,
      labels: ['via-form', 'needs-triage'],
    }),
  });
}
```

`toYamlBlock_()` maps form answers onto the §3.1 schema keys (`name`, `area`, `type`, `best_session`, `best_season`, `price_vnd`, `must_try.vi`, `why_we_go.vi`, …) and emits `status: draft` + today's `last_checked`. **Triage is then copy-the-block-into-a-file**, and the Phase 4 bot automates exactly that.

| Concern | Handling |
| --- | --- |
| Token exposure | Fine-grained PAT, **this repo only**, `Issues: read & write` and nothing else, 1-year expiry, stored in Script Properties. Rotatable without touching the form. |
| Spam | Issues are triaged by a human before any PR exists — spam costs you a click. Plus: link-in-prose heuristic above, Apps Script quota as a natural rate limit, and Form settings → limit to 1 response per Google account if it ever gets bad. |
| GitHub API down / token expired | `muteHttpExceptions` + check the status; on failure the script emails you and the row stays in the response sheet — **nothing is lost**, replay by re-running the trigger on that row. |
| Form fields drifting from the schema | The form's field titles are listed in `CONTRIBUTING.md` next to the schema; `toYamlBlock_` fails loudly (emails you) on an unknown field rather than silently dropping it. |
| Anonymous attribution | Optional "name for credit" field → `contributed_by`. Blank means the entry lands credited to the project. |

### 4.7 Things you must set up

| Item | Where | Note |
| --- | --- | --- |
| Notion internal integration + token | notion.so/my-integrations | **Then connect it to the parent page** (page `⋯ → Connections`). A token alone grants nothing. |
| `NOTION_TOKEN` | Repo → Settings → Secrets → Actions | Never exposed to fork PRs — `validate.yml` has no secrets by design. |
| `NOTION_PLACES_DS_ID`, `NOTION_EXPERIENCES_DS_ID`, `NOTION_NEIGHBORHOODS_DS_ID` | Repo variables (not secret) | **Data source** IDs, not database IDs — `GET /v1/databases/{id}` → `data_sources[0].id`. |
| Actions write permission | Settings → Actions → Workflow permissions | Needed for the README commit + issue creation. |
| Branch protection on `main` | Settings → Rules | Require `validate` to pass + 1 approval. |
| Notion publish + duplicate | Parent page → Share → Publish → allow duplicate as template | Test in an incognito window. |
| **Google Form + Apps Script** | forms.google.com, then Extensions → Apps Script on the response sheet | Add an **installable** `onFormSubmit` trigger (the simple trigger can't call external URLs). First run asks you to authorize `UrlFetchApp`. |
| **Fine-grained PAT for the form** | github.com/settings/personal-access-tokens | Scope: this repo only, `Issues: read & write`, nothing else. Paste into Apps Script → Project Settings → **Script Properties** as `GH_TOKEN`. Never into the form or a page. |

---

## 5. Contribution & review workflow

```
 Idea ──▶ Google Form ─┐
         (no account)  │
                       ├──▶ GitHub issue ──▶ triage ──▶ PR (bot or hand) ──▶ CI ──▶ review ──▶ merge ──▶ Notion
 Idea ──▶ Issue Form ──┘   (one body shape)  label +     content/places/x.yml   auto    human    main     ~2 min
         (has GitHub)                        dedupe
 Idea ──▶ PR directly ──────────────────────────────────────────────────────────▲
         (technical)
```

### Roles

| Role | Can | How you get it |
| --- | --- | --- |
| Contributor | File issues, open PRs | Anyone |
| Area steward | Review PRs in their area, set `status: verified` | 3 merged contributions in that area |
| Translator | Fill/repair `en` fields, clear `needs-translation` | Self-nominate; native or fluent |
| Maintainer | Merge, taxonomy changes, Notion admin, moderation | You, plus whoever you add |

### Quality gates

1. **CI** (§4.1) — mechanical: schema, enums, dupes, PII, dates.
2. **Human review** — one reviewer who is not the author confirms: the note says *when to go and what to order* (not "food is good"); at least one honest downside where one exists; the price is what the contributor actually paid; the Maps link resolves to the right place.
3. **`status` ladder** — `draft` on merge; `verified` only when a steward or maintainer has been there or cross-checked. **Public Notion views filter to `verified`**, so a merge never immediately publishes an unchecked claim. This is the safeguard that makes open contribution safe. (All 62 migrated entries start as `draft` — V2 already marked them so.)
4. **Freshness** — `stale-check.yml` runs weekly: any `verified` entry with `last_checked` older than 180 days gets a `needs-verification` issue (batched, max 10/week) and its Notion `Data status` flipped back to `draft`. This is the mechanism V2's "re-verify after 6 months" principle was missing.
5. **Duplicates** — CI catches near-matches; branches (e.g. The Local Beans' two sites) stay one file with the second address in `hours_notes`, matching how V1 wrote them.

### Content standards (`STYLE.md`)

Write what a friend would say. 2–4 sentences of *Why we go*. Name the dish and the price you paid. Say the downside. No superlatives without a reason, no copied marketing text. **No paid placements, ever** — disclose any relationship in `relationship:`. Vietnamese is the source language; English is a faithful translation, not a rewrite (V1's voice — jokes, `=))`, local slang — is the asset; keep it in VI and translate the meaning).

### Moderation

CODE_OF_CONDUCT (Contributor Covenant). Maintainers may close without merging: promotional submissions, places the contributor hasn't visited, anything naming a private individual. Repeat spam → block. Disputed removals go to a Discussion, not a PR thread.

---

## 6. Phased roadmap

| Phase | Deliverables | Done when |
| --- | --- | --- |
| **0 — Prep** *(you, ~30 min)* | Notion integration created and **connected to the parent page**; token + 3 data-source IDs added to the repo; Actions write permission on; license decision recorded. | `curl` with the token returns the Places data source. |
| **1 — Repo foundation** | `content/taxonomy.yml` (incl. `best_season`); `scripts/import-csv.mjs` converts the 3 V2 CSVs into 62 + 9 + 5 YAML files and **derives `best_season` from VI keywords** (`mùa hè`/`tắm biển`/`SUP` → summer, `trời chuyển lạnh`/`gió mùa` → winter, `mùa lúa` → its own window), defaulting the rest to `year-round` for human review (one-shot, then deleted); `validate.mjs` + `validate.yml` green on all of them; `build-readme.mjs` regenerates `README.md` (VI) and `versions/README.en.md`; 5 legacy translations moved to `versions/legacy/` with a frozen banner; `LICENSE-CONTENT`. | Generated README is content-equivalent to today's hand-written one; CI passes; V2 CSVs are now derived artifacts, not sources. |
| **2 — Notion sync** | `lib/notion.mjs`; one-off backfill writes `Slug` + `Sync hash` onto the 62 existing rows by name match; `sync-notion.mjs` + `sync-notion.yml`; run first via `workflow_dispatch` only. | Editing one `why_we_go.vi`, merging, and seeing it in Notion within ~2 minutes — with page bodies and `Photo` untouched. Then enable the `push` trigger. |
| **3 — Community on-ramp** | `CONTRIBUTING.md`, `STYLE.md`, `CODE_OF_CONDUCT.md`, PR template, 4 Issue Forms, labels, CODEOWNERS, branch protection, README contribution section in VI + EN. **Plus the public path:** bilingual Google Form, Apps Script + `GH_TOKEN`, `via-form` / `needs-triage` labels, form link in the README, the Notion homepage and the repo's issue-chooser (`config.yml`). | A stranger with **no GitHub account** submits from their phone and an issue appears within seconds carrying a paste-ready YAML block. |
| **4 — Launch** | `issue-to-pr.yml` handles `via-form` and `new-place` issues identically (one parser, §3.3); public Notion views filtered to `verified`, including a **"What's good this season"** row of views (Summer / Rainy / Winter / Spring, each `Best season contains X or year-round`) next to the existing session shortlists, and a homepage line pairing the two axes ("arriving in October? start here"); Share → Publish + duplicate-as-template; `stale-check.yml`; `issue-to-pr.yml` (approved Issue Form → branch + YAML + PR); weekly full-sync reconciliation. | Public link works incognito; duplicating gives a stranger their own copy; ≥30 entries at `verified`. |
| **5 — Growth** *(post-launch, not blocking — see §6.1)* | Content gaps V2 identified: desserts/late-night, markets, museums, coworking, SIM, healthcare. Photo strategy. Extra languages if demand appears. Then the product line: public website → membership → trip-planner chatbot → React Native app. | — |

Phases 1–3 are independent of the Notion account and can proceed while Phase 0 is pending.

### 6.1 The long game — designed for, deliberately not built now

Stated direction: a public **website**, a **membership** tier, a **chatbot** that plans someone's day in Da Nang and answers questions, and later a **React Native app**. None of it is in V3's scope. The only obligation today is that V3 doesn't block any of it — and the structure already chosen happens to be exactly what those surfaces need:

| Future surface | What it will consume | Already true in V3 | What it would still need |
| --- | --- | --- | --- |
| Public website | `content/**` at build time | Structured fields, stable slugs, bilingual prose | A static generator + a domain |
| Membership | A `verified` corpus worth paying for | CC BY-NC-SA + the contributor grant in the PR template | Payments, accounts, and a CLA (see Risk 5) |
| **Trip-planner chatbot / QnA** | The same entries as retrieval context | **This is the real payoff of the schema.** "Cheap dinner near the beach in October, I'm vegetarian" is answerable by *filtering* `type` + `area` + `price_band` + `best_season` + `good_for` and grounding the answer in `why_we_go` — structured filter first, prose second. A Markdown README could never support this; V2's Notion databases could, but only for a human clicking filters. | An API key, a retrieval layer, and a `last_checked` guardrail so the bot never confidently recommends a closed place |
| React Native app | The same data + the same chatbot endpoint | One content model, no per-surface fork | A client |

**The single design rule that keeps all four cheap:** `scripts/lib/content.mjs` — the loader that `validate`, `sync-notion` and `build-readme` all share — is the de-facto internal API. Every future surface reads content through it (or a `dist/guide.json` it emits in about five lines), never by re-parsing YAML or, worse, scraping Notion.

**What I am deliberately *not* adding now,** because each would be speculative weight on a guide that still has 62 unverified entries: a database, an auth system, an API server, a `dist/` bundle with no consumer, geo/coordinates, or embeddings. Each is additive later; none requires reshaping `content/**`. The one thing that *is* worth doing early is Risk 5's CLA question — rights are cheap to secure now and expensive to retrofit once 40 people have contributed.

### Files that will be created or changed

- New: [content/](../../content/), [scripts/](../../scripts/), [.github/](../../.github/), `CONTRIBUTING.md`, `STYLE.md`, `CODE_OF_CONDUCT.md`, `LICENSE-CONTENT`, `LICENSE-CODE`
- Rewritten as generated output: [README.md](../../README.md), `versions/README.en.md`
- Moved: [versions/README.ko.md](../../versions/README.ko.md) and the ja/zh/es/ar siblings → `versions/legacy/`
- Reused as migration input, then retired: [Places.csv](../claude-notion-da-nang-local-guide/Places.csv), [Experiences.csv](../claude-notion-da-nang-local-guide/Experiences.csv), [Neighborhoods.csv](../claude-notion-da-nang-local-guide/Neighborhoods.csv)
- Reused as Notion setup reference (property types, views, language layer — Steps 3–8 stay valid): [00 - Build Guide](../claude-notion-da-nang-local-guide/00%20-%20Build%20Guide%20(start%20here).md)

---

## 7. Risks & open decisions

| # | Risk / decision | Position |
| --- | --- | --- |
| 1 | **Notion edits get overwritten.** Any maintainer editing a synced property in Notion loses it on the next merge. | Accepted — one-way sync is the reason this stays maintainable. Mitigated by the property split: `Photo`, `EN reviewed`, scores etc. are Notion-owned and never written. Must be stated at the top of CONTRIBUTING. |
| 2 | **62 entries are all unverified.** Prices and hours come from a README of unknown age; some places have certainly closed. | Launch with `verified`-only public views. Getting to ~30 verified is real legwork and is the true critical path to launch, not the code. |
| 3 | **Bilingual cost.** Every fact change is two edits. V2 already called this the main cost. | `needs-translation` label + translator role + short prose. If VI outpaces EN, EN fields degrade — acceptable, CI warns. |
| 4 | **Notion "duplicate as template" is a snapshot.** Duplicates never receive updates. | By design. Say it on the Notion homepage: "duplicate for your trip; come back for the live version." |
| 5 | **Rights to contributed content.** CC BY-NC-SA + a PR-template grant, not a signed CLA. A checkbox is weaker than a CLA if you later sell a compiled edition. | **Upgraded in priority:** a membership tier and a paid chatbot are now stated direction (§6.1), not a maybe — so the grant text in the PR template must cover *"the project may offer this content in paid products, including software services"*, not just "a compiled edition". Still no CLA bot for launch (it deters first contributors), but revisit the moment money is actually charged, and get explicit OK from V1's existing contributors before then. Retrofitting rights across 40 contributors is the expensive version of this conversation. |
| 6 | **Administrative renaming** (Da Nang–Quảng Nam merger, 2025). Informal area names diverge from official ones. | `official_name` per area in taxonomy; show both. Low cost, avoids a migration later. |
| 7 | **Bus factor of one.** Everything routes through you. | Area stewards from Phase 3; the repo is the source of truth, so Notion is reproducible from Git if the workspace is ever lost. |
| 8 | **Google Maps share links rot** (`share.google`, `bit.ly` — V2 flagged several). | CI warns on shorteners; verification pass replaces them with stable place links. |
| 9 | **Photos.** Gallery cards look empty without them, but images in Git bloat the repo and carry licensing risk. | Out of scope for launch; photos uploaded directly into Notion's `Photo` property, which the sync never touches. Revisit in Phase 5. |
| 10 | **Public form invites spam and low-quality submissions.** An anonymous form has no reputation signal behind it. | Accepted and contained: a form submission creates an *issue*, never content. Nothing reaches the repo, the README or Notion without a maintainer opening a PR and CI passing. Worst case is a triage chore, not a bad recommendation. Escalation ladder if it gets noisy: link-spam heuristic → require a Google sign-in (1 response/account) → close the form and fall back to GitHub Issue Forms. |
| 11 | **Triage load lands entirely on you.** The form is designed to increase submissions; that's the point, and it's also the cost. | Phase 4's `issue-to-pr` bot turns triage from "retype it" into "review a diff". Watch the `needs-triage` count after launch — if it outruns you, that's the signal to recruit area stewards (Risk 7), not to close the form. |
| 12 | **Google dependency** for the public path (Forms, Apps Script, Drive photos). | Low stakes: responses persist in the sheet, so a GitHub outage loses nothing and a Google outage only pauses intake. The Cloudflare Worker in Phase 5 is a drop-in replacement — the contract is "POST an issue with a YAML block". |
| 13 | **Notion workspace block limits** on a free plan can surface as a 403. | Watch it; the guide is small (~80 pages), but the error is easy to misread as a permissions problem — `sync-notion.mjs` checks the message and says which it is. |

### What I need from you

1. **Phase 0 setup** (integration + connect to page + 4 repo secrets/variables) — nothing in Phase 2 can be tested without it.
2. **Confirm we reuse the V2 Notion databases** rather than rebuilding (assumed yes; the backfill in Phase 2 depends on it).
3. **Who else can be a maintainer/steward** — names for CODEOWNERS, even one is enough to halve the bus factor. This matters more now that the public form will raise submission volume.
4. **A Google account to own the form** and a fine-grained PAT for it (§4.7). I'll write the Apps Script and the form's field list; creating the form and pasting the token is a 10-minute job only you can do.

---

## Verification

| Phase | How to verify |
| --- | --- |
| 1 | `node scripts/validate.mjs` exits 0 on all 76 files. `node scripts/build-readme.mjs && git diff README.md` — inspect that the generated README matches the current one section by section (spot-check Mỳ Quảng Vỉa Hè, The Local Beans' two branches, the Sơn Trà walk). Open a deliberately broken PR (bad area key, duplicate name, a phone number in prose) and confirm CI fails with a readable comment. |
| 2 | `gh workflow run sync-notion.yml -f full=true`, then in Notion: 62 places present, each with `Slug` and `Sync hash` filled, no duplicated rows, `Photo` and page bodies unchanged. Then change one `why_we_go.vi`, merge, and confirm only that page updates (check `Last edited time`). Re-run the sync unchanged and confirm **zero** writes (hash short-circuit). Temporarily set a bad token and confirm the job fails with a `sync-failure` issue rather than a stack trace. |
| 3 | On a phone, open the repo → Issues → New issue → "Add a place", submit; confirm the form captures every required schema field. Check branch protection actually blocks a merge with failing CI. **Public form:** submit from a browser signed out of Google entirely, confirm an issue appears within seconds with `via-form` + `needs-triage` and a YAML block that pastes into `content/places/<slug>.yml` and passes `validate.mjs` with only `slug` and `last_checked` to fill. Then break it on purpose — revoke the PAT and submit again: you get an email, the response is still in the sheet, and re-running the trigger on that row creates the issue. |
| 4 | Open the published Notion link in an incognito window: only `verified` entries visible, both language homepages work, duplicate-as-template produces a working copy in a second workspace. Run the two visitor questions the season axis exists for: *"I'm here in June"* → Summer view shows beach swim, SUP, Cá Chuồn Space, Wonder Park sunset; *"I'm here in October"* → Rainy view shows ram cuốn cải, garden cafés, indoor bars and **not** the SUP trip. Set one entry's `last_checked` to 200 days ago and confirm the weekly job flags it and flips its Notion status to draft. |

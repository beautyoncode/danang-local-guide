#!/usr/bin/env node
// ONE-SHOT migration: V2's three Notion CSV exports -> content/**/*.yml.
// Delete this file once Phase 1 is merged; the CSVs become derived artifacts.
//
// The alias maps below are the migration record: they are the written answer
// to "where did `Tree-lined` go?".
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { parseCsv } from './lib/csv.mjs';
import { CONTENT, ROOT, slugify, loadTaxonomy } from './lib/content.mjs';

const CSV_DIR = join(ROOT, 'docs', 'claude-notion-da-nang-local-guide');
const MIGRATED_ON = '2026-09-21';
const OWNER = 'GraphicDThanh';

const TYPE = {
  '🍜 Food · Đồ ăn': 'food',
  '☕ Coffee · Cà phê': 'coffee',
  '🍻 Nightlife · Bar/Pub': 'nightlife',
  '💆 Wellness · Spa & Massage': 'wellness',
  '🚶 Sights & Walks · Đi dạo': 'sights',
  '🏄 Outdoor · Ngoài trời': 'outdoor',
};

const CATEGORY = {
  'Rice · Cơm': 'com', 'Bún · Noodles': 'bun', 'Mỳ Quảng': 'my-quang',
  'Bánh canh': 'banh-canh', 'Seafood · Hải sản': 'hai-san',
  'Chinese · Ẩm thực Trung Hoa': 'trung-hoa', 'Snacks · Ăn vặt': 'an-vat',
  'Breakfast · Ăn sáng': 'an-sang', 'Vegan · Thuần chay': 'thuan-chay',
  'Other Vietnamese · Món khác': 'mon-khac',
  'Local coffee · Cafe truyền thống': 'local-coffee',
  'Specialty coffee · Cafe specialty': 'specialty-coffee',
  'Garden cafe · Cafe sân vườn': 'garden-cafe',
  'View cafe · Cafe view đẹp': 'view-cafe',
  'Work-friendly cafe · Cafe làm việc': 'work-cafe',
  'Beach bar · Bar biển': 'beach-bar', 'Chill bar · Bar chill': 'chill-bar',
  'Club / DJ': 'club-dj', 'Club / live music · Nhạc sống': 'live-music',
  'Spa & Massage': 'spa-massage',
  'Walk · Đi dạo': 'di-dao', 'Beach · Đi biển': 'di-bien',
  'Motorbike ride · Đi dạo xe máy': 'xe-may',
  'Sunset spot · Ngắm hoàng hôn': 'hoang-hon',
  'Hike · Leo núi': 'leo-nui', 'SUP · Chèo SUP': 'sup',
};

const AREA = {
  'Hai Chau · Hải Châu': 'hai-chau', 'Son Tra · Sơn Trà': 'son-tra',
  'My An · Mỹ An': 'my-an', 'Lien Chieu · Liên Chiểu': 'lien-chieu',
  'Hoi An · Hội An': 'hoi-an',
};

const SESSION = {
  '🌅 Early Morning · Sáng sớm': 'early-morning', '☀️ Morning · Buổi sáng': 'morning',
  '🍜 Lunch · Buổi trưa': 'lunch', '☕ Afternoon · Buổi chiều': 'afternoon',
  '🌇 Sunset · Hoàng hôn': 'sunset', '🍽️ Dinner · Bữa tối': 'dinner',
  '🌙 Evening · Buổi tối': 'evening', '🌃 Late Night · Khuya': 'late-night',
};

const GOOD_FOR = {
  'Solo · Đi một mình': 'solo', 'Couple · Cặp đôi': 'couple',
  'Family · Gia đình': 'family', 'Friends · Bạn bè': 'friends',
  'Group · Nhóm bạn': 'group', 'Small group · Nhóm nhỏ': 'group',   // merged
  'Students · Sinh viên': 'students', 'Work · Làm việc': 'work',
  'Study · Học bài': 'study', 'Deadline crunch · Chạy deadline': 'deadline',
  'Reading · Đọc sách': 'reading', 'Coffee lovers · Dân mê cà phê': 'coffee-lovers',
  'Vegan · Thuần chay': 'vegan', 'Vegetarian · Ăn chay': 'vegetarian',
};

const PRICE_BAND = { '₫': '1', '₫₫': '2', '₫₫₫': '3', '₫₫₫₫': '4' };

// 53 free-text values -> 25 keys. `null` = deliberately dropped because the
// value is really a different field (noted alongside).
const VIBE = {
  'Local · Bản địa': 'local',
  'Casual · Bình dân': 'casual',
  'Sit-down · Ngồi thoải mái': 'casual',
  'Street food · Ăn vỉa hè': 'street-food',
  'Family-run · Quán gia đình': 'family-run',
  'Old school · Quán lâu đời': 'retro',
  'Retro · Bao cấp': 'retro',
  'Retro-modern · Retro hiện đại': 'retro',
  'Classic European · Cổ điển châu Âu': 'retro',
  'Quiet · Yên tĩnh': 'quiet',
  'Chill · Chill': 'chill',
  'Chill music · Nhạc chill': 'chill',
  'Relax · Thư giãn': 'chill',
  'Relaxed · Thong thả': 'chill',
  'Busy · Đông khách': 'busy',
  'Lively · Sôi động': 'busy',
  'Local hangout · Tụ tập giới trẻ': 'busy',
  'City life · Nhịp sống phố': 'busy',
  'Airy · Thoáng mát': 'airy',
  'Spacious · Rộng rãi': 'airy',
  'Indoor · Không gian đóng': 'indoor',
  'Garden · Sân vườn': 'garden',
  'Green · Xanh mát': 'green',
  'Tree-lined · Nhiều cây xanh': 'green',
  'Shady · Nhiều bóng mát': 'green',
  'Nature · Thiên nhiên': 'nature',
  'Forest · Rừng': 'nature',
  'Jungle · Rừng': 'nature',
  'Wildlife · Thú rừng': 'nature',
  'Remote · Hoang sơ': 'nature',
  'Rice fields · Cánh đồng lúa': 'rice-fields',
  'Beach · Biển': 'beach',
  'Sea · Biển': 'sea-view',
  'Sea view · View biển': 'sea-view',
  'Views · Ngắm cảnh': 'view',
  'View · View đẹp': 'view',
  'Riverside · Ven sông': 'riverside',
  'Roastery · Rang xay': 'roastery',
  'Work-friendly · Làm việc tốt': 'work-friendly',
  'Study · Học bài': 'work-friendly',
  'Romantic · Lãng mạn': 'romantic',
  'Live music · Nhạc sống': 'live-music',
  'DJ · DJ': 'dj',
  'Tourist friendly · Thân thiện du khách': 'tourist-friendly',
  'Expat friendly · Thân thiện người nước ngoài': 'tourist-friendly',
  'Open 24h · Mở 24/24': 'open-24h',
  // dropped — these are other fields, not a vibe:
  'Sunrise · Bình minh': null,          // -> best_session: early-morning
  'Sunset · Hoàng hôn': null,           // -> best_session: sunset
  'Budget · Giá rẻ': null,              // -> price_band
  'Mid-range · Tầm trung': null,        // -> price_band
  'Premium · Cao cấp': null,            // -> price_band
  'Specialty · Specialty': null,        // -> category: specialty-coffee
  'Vegan · Thuần chay': null,           // -> category / good_for
};

const DURATION = {
  '2–3 hours · 2–3 giờ': '2-3h', '3–4 hours · 3–4 giờ': '3-4h',
  '1–2 hours · 1–2 giờ': '1-2h', '2 hours · 2 giờ': '1-2h',
  'Under 1 hour · Dưới 1 giờ': 'under-1h', 'Half day · Nửa ngày': 'half-day',
  'Full day · Cả ngày': 'full-day',
};

// best_season is derived from Vietnamese prose, then left for human review.
// Ordered: first match wins per bucket, all matching buckets are collected.
const SEASON_HINTS = [
  ['summer', /mùa hè|tắm biển|đi biển|sup|chèo|bãi biển|hoàng hôn|bình minh|nắng/i],
  ['winter', /chuyển lạnh|trời lạnh|gió mùa|mưa phùn|lẩu|món nóng/i],
  ['autumn', /mùa mưa|mưa bão|ngày mưa|trú mưa/i],
  ['spring', /mùa lúa|lúa chín|cánh đồng|tết|xuân/i],
];

const multi = (s, map, dropped) =>
  [...new Set(s.split(',').map(v => v.trim()).filter(Boolean).map(v => {
    if (!(v in map)) { console.warn(`  ! unmapped value: ${JSON.stringify(v)}`); return null; }
    if (map[v] === null) dropped?.push(v);
    return map[v];
  }).filter(Boolean))];

const one = (s, map) => {
  if (!s.trim()) return undefined;
  if (!(s in map)) { console.warn(`  ! unmapped value: ${JSON.stringify(s)}`); return undefined; }
  return map[s];
};

const bi = (en, vi) => (en?.trim() || vi?.trim()) ? { vi: vi.trim(), en: en.trim() } : undefined;

function deriveSeason(...prose) {
  const text = prose.filter(Boolean).join(' ');
  const hits = SEASON_HINTS.filter(([, re]) => re.test(text)).map(([k]) => k);
  return hits.length ? hits : ['year-round'];
}

function drop(o) { // strip undefined / empty so the YAML stays readable
  return Object.fromEntries(Object.entries(o).filter(
    ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
}

function write(kind, slug, data) {
  mkdirSync(join(CONTENT, kind), { recursive: true });
  writeFileSync(join(CONTENT, kind, `${slug}.yml`),
    YAML.stringify(data, { lineWidth: 0 }));
}

// ---- V1 README prose ------------------------------------------------------
// V2's CSV condensed V1's README into two flat sentences, losing the voice that
// is the guide's actual asset (the jokes, the "=))", the practical asides).
// The migration reads both: V2 for structure, V1 for the Vietnamese prose.
//
// Headings V2 renamed into English, so name-matching can't find them:
const README_ALIASES = {
  'Đi dạo trên núi Sơn Trà': 'son-tra-walk-guard-station-to-vong-canh-hill',
  'Đi dạo trong thành phố': 'city-walk-nguyen-chi-thanh-le-loi-loop',
  'Đi dạo dọc sông Hàn': 'han-river-walk-bach-dang',
  'Đi dạo trên cầu đi bộ Nguyễn Văn Trỗi': 'nguyen-van-troi-pedestrian-bridge',
  'Đi dạo xe máy': 'scenic-motorbike-loops',
  'Đi bơi biển': 'sunrise-swim-at-pham-van-dong-beach',
  'Ngắm hoàng hôn & thăm công viên kỳ quan (bé tẹo)': 'sunset-at-wonder-park-thuan-phuoc-bridge',
  'Chèo SUP ngắm san hô Hòn Sụp': 'sup-to-hon-sup-coral',
  'Quán nước Ghềnh Bàng': 'ghenh-bang-hike-son-tra',
  'Leo đường rừng Hải Vân Quan': 'hai-van-quan-forest-trail',
  'Chickpea Eatery — Vegan / Thuần Chay': 'chickpea-eatery-da-nang',
  'Nhóm bán đồ ăn sáng': 'breakfast-stalls-nguyen-chi-thanh-hai-phong',
  'Miến Măng Gà & Bún Măng Gà Cô Nhâm — Tố Hữu': 'mien-bun-mang-ga-co-nham',
  'Bún Bò Huế': 'bun-bo-hue-kiet-123-nguyen-thi-minh-khai',
  'Bún Chả Hà Nội': 'bun-cha-ha-noi-huy-can',
  'Mỳ Quảng Vỉa Hè': 'my-quang-via-he-ha-than',
  'Bánh Bèo - Nậm & Lọc Huế': 'banh-beo-nam-loc-hue-thanh-tinh',
  'Namto House Coffee Da Nang': 'namto-house-coffee',
  '7AM': '7am-coffee',
  // 'The Local Beans' is one V1 heading covering two branches in two different
  // areas. A place has exactly one `area`, so it stays two files; the branch
  // prose is split by hand below rather than dropped.
};

const PROSE_OVERRIDE = {
  'the-local-beans-186-phan-chau-trinh':
    '- Cơ sở Premium: view đẹp, không gian thoáng. Phù hợp làm việc, hẹn hò, tụ tập bạn bè.\n' +
    '- Giá cao hơn cơ sở 2, tầm 50k – 100k =)))\n' +
    '- Cơ sở 2 ở [84 Châu Thị Vĩnh Tế](https://goo.gl/maps/G6bNML96hS74Aetm6) (Mỹ An) rẻ hơn và có working space.',
  'the-local-beans-84-chau-thi-vinh-te':
    '- Làm việc tốt (tầng 3 có working space). Ngồi với bạn cũng được, giá tầm trung, chất lượng.\n' +
    '- Cafe bình thường 30k – 60k; working space 85k/ngày (free 1 ly nước bất kỳ).\n' +
    '- Cơ sở 1 ở [186 Phan Châu Trinh](https://maps.app.goo.gl/edQf8TPuizwtgbJN7) (Hải Châu) là bản premium, view đẹp hơn.',
};

// V2 renamed the walks and outdoor activities into English. They have no
// Vietnamese name on a sign to match, so `name` keeps V2's spelling (Phase 2's
// Notion backfill matches on it) and `name_vi` carries V1's heading for the
// Vietnamese README.
const NAME_VI = {
  'son-tra-walk-guard-station-to-vong-canh-hill': 'Đi dạo trên núi Sơn Trà',
  'city-walk-nguyen-chi-thanh-le-loi-loop': 'Đi dạo trong thành phố',
  'han-river-walk-bach-dang': 'Đi dạo dọc sông Hàn',
  'nguyen-van-troi-pedestrian-bridge': 'Đi dạo trên cầu đi bộ Nguyễn Văn Trỗi',
  'scenic-motorbike-loops': 'Đi dạo xe máy',
  'sunrise-swim-at-pham-van-dong-beach': 'Đi bơi biển (Phạm Văn Đồng)',
  'sunset-at-wonder-park-thuan-phuoc-bridge': 'Ngắm hoàng hôn & công viên kỳ quan',
  'sup-to-hon-sup-coral': 'Chèo SUP ngắm san hô Hòn Sụp',
  'ghenh-bang-hike-son-tra': 'Quán nước Ghềnh Bàng (leo núi)',
  'hai-van-quan-forest-trail': 'Leo đường rừng Hải Vân Quan',
  'breakfast-stalls-nguyen-chi-thanh-hai-phong': 'Nhóm bán đồ ăn sáng',
  'chickpea-eatery-da-nang': 'Chickpea Eatery — Vegan / Thuần Chay',
};

// Disclosures V1 wrote as an aside ("có quen chủ :3") rather than a field.
const RELATIONSHIP_OVERRIDE = {
  'the-local-beans-84-chau-thi-vinh-te': 'family-or-friend',
};

// Bullets that are really structured fields, not prose.
const FIELD_BULLET = /^- \*\*(Địa chỉ|Giá|Giờ mở cửa):\*\*\s*/;
// A seller's mobile number sits in one V1 address line. Personal contact details
// do not belong in a public dataset (validate.mjs enforces this).
const STRIP_PII = /,?\s*(hoặc gọi|or call)[^,.]*\d[\d\s.\-]{7,}\d[^,.]*/gi;

function readReadmeProse() {
  // README.md is regenerated by build-readme.mjs, so the migration reads the
// preserved V1 original instead of its own output.
  const md = readFileSync(join(ROOT, 'docs', 'v1-README.original.md'), 'utf8').split('\n');
  const out = new Map();
  let cur = null;
  for (const line of md) {
    const h = line.match(/^#{3,4} (.+)$/);
    if (h) {
      const title = h[1].replace(/<a name="[^"]*"><\/a>\s*/, '').trim();
      const linked = title.match(/^\[(.+?)\]\((.+?)\)$/);
      cur = { title: (linked ? linked[1] : title).trim(), link: linked?.[2], body: [] };
      out.set(cur.title, cur);
    } else if (cur) cur.body.push(line);
  }
  for (const e of out.values()) {
    const kept = [];
    for (let i = 0; i < e.body.length; i++) {
      const line = e.body[i].replace(STRIP_PII, '');
      const f = line.match(FIELD_BULLET);
      if (!f) { kept.push(line); continue; }
      let value = line.replace(FIELD_BULLET, '').trim();
      // "- **Địa chỉ:**" often heads an indented list (a place with several
      // branches, or two ways onto a bridge). Those children belong to the
      // field, not to the prose that follows.
      const child = [];
      while (i + 1 < e.body.length && /^\s+\S/.test(e.body[i + 1]))
        child.push(e.body[++i].replace(STRIP_PII, '').replace(/^ {2}/, ''));
      if (child.length) value = [value, ...child].filter(Boolean).join('\n');
      if (f[1] === 'Địa chỉ') e.address = value;
      else if (f[1] === 'Giá') e.price = value;
      else if (f[1] === 'Giờ mở cửa') e.hours = value;
      else kept.push(line);
    }
    // Trim blank lines only — leading indentation is meaningful Markdown.
    e.prose = kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*\n|\n\s*$/g, '');
  }
  return out;
}

const README = readReadmeProse();
const readmeUsed = new Set();

/** V1 README entry for a place, by alias or by name. */
function proseFor(name, slug) {
  const byAlias = [...README.values()].find(e => README_ALIASES[e.title] === slug);
  const hit = byAlias ?? README.get(name)
    ?? [...README.values()].find(e => slugify(e.title) === slug);
  if (hit) readmeUsed.add(hit.title);
  return hit;
}

// ---- places ---------------------------------------------------------------
const csv = f => parseCsv(readFileSync(join(CSV_DIR, f), 'utf8'));
const droppedVibes = [];
const slugByName = new Map();

// V2 left Area blank on these two. Filled here so the migration is repeatable.
const AREA_BACKFILL = {
  'Miến & Bún măng gà Cô Nhâm': 'hoa-xuan',   // 22 Tố Hữu
  'Scenic motorbike loops': 'hai-chau',       // Nguyễn Chí Thanh / Phan Châu Trinh / Thanh Thủy
};

const places = csv('Places.csv');
for (const r of places) {
  const slug = slugify(r.Name);
  const v1 = proseFor(r.Name, slug);
  slugByName.set(r.Name.toLowerCase(), slug);
  const sessions = multi(r['Best session'], SESSION);
  // a Sunrise/Sunset vibe is really a session — fold it in before dropping it
  if (/Sunrise · Bình minh/.test(r.Vibe) && !sessions.includes('early-morning')) sessions.unshift('early-morning');
  if (/Sunset · Hoàng hôn/.test(r.Vibe) && !sessions.includes('sunset')) sessions.push('sunset');

  write('places', slug, drop({
    slug,
    name: r.Name,
    name_vi: NAME_VI[slug],
    type: one(r.Type, TYPE),
    category: one(r.Category, CATEGORY),
    area: one(r.Area, AREA) ?? AREA_BACKFILL[r.Name],
    address: v1?.address || r.Address,
    price_vnd: v1?.price || r['Price (VND)'],
    price_band: one(r['Price band'], PRICE_BAND),
    best_session: sessions,
    best_season: deriveSeason(r['Why we go (VI)'], r['Hours & notes (VI)'], r.Category, r.Vibe),
    vibe: multi(r.Vibe, VIBE, droppedVibes),
    good_for: multi(r['Good for'], GOOD_FOR),
    must_try: bi(r['Must try (EN)'], r['Must try (VI)']),
    // V1's fuller prose wins; V2's condensed EN stays as the translation seed.
    why_we_go: bi(r['Why we go (EN)'], PROSE_OVERRIDE[slug] || v1?.prose || r['Why we go (VI)']),
    hours_notes: bi(r['Hours & notes (EN)'], v1?.hours || r['Hours & notes (VI)']),
    link: v1?.link || r.Link,
    status: 'draft',
    last_checked: MIGRATED_ON,
    relationship: RELATIONSHIP_OVERRIDE[slug] ?? 'none',
    contributed_by: [OWNER],
  }));
}

// ---- experiences ----------------------------------------------------------
const unresolvedStops = [];
for (const r of csv('Experiences.csv')) {
  const slug = slugify(r['Name (VI)'] || r.Name);
  const stops = [], extra = [];
  for (const s of (r['Stops (in order)'] || '').split(',').map(x => x.trim()).filter(Boolean)) {
    const hit = slugByName.get(s.toLowerCase())
      ?? [...slugByName].find(([n]) => s.toLowerCase().includes(n))?.[1];
    if (hit) stops.push(hit); else { extra.push(s); unresolvedStops.push(s); }
  }
  write('experiences', slug, drop({
    slug,
    name: r['Name (VI)'],
    name_en: r.Name,
    session: multi(r.Session, SESSION),
    best_season: deriveSeason(r['Local tip (VI)'], r['Name (VI)']),
    area: one(r.Area, AREA),
    duration: one(r.Duration, DURATION),
    good_for: multi(r['Best for'], GOOD_FOR),
    stops,
    stops_extra: extra,
    local_tip: bi(r['Local tip (EN)'], r['Local tip (VI)']),
    status: 'draft',
    last_checked: MIGRATED_ON,
    contributed_by: [OWNER],
  }));
}

// ---- neighborhoods --------------------------------------------------------
for (const r of csv('Neighborhoods.csv')) {
  const slug = slugify(r.Name.replace(/\(.*\)/, ''));
  write('neighborhoods', slug, drop({
    slug,
    name: r['Name (VI)'],
    name_en: r.Name,
    area: AREA[Object.keys(AREA).find(k => k.startsWith(r.Name.split(' (')[0])) ?? ''],
    vibe_notes: bi(r['Vibe (EN)'], r['Vibe (VI)']),
    best_for: bi(r['Best for (EN)'], r['Best for (VI)']),
    whats_here: bi(r["What's here (EN)"], r["What's here (VI)"]),
    what_we_like: bi(r['What we like (EN)'], r['What we like (VI)']),
    what_we_dont_like: bi(r["What we don't like (EN)"], r["What we don't like (VI)"]),
    status: 'draft',
    last_checked: MIGRATED_ON,
    contributed_by: [OWNER],
  }));
}

console.log(`\nimported: ${places.length} places, ${csv('Experiences.csv').length} experiences, ${csv('Neighborhoods.csv').length} neighborhoods`);
if (droppedVibes.length)
  console.log(`dropped vibes (now other fields): ${[...new Set(droppedVibes)].join(', ')}`);
const unusedProse = [...README.keys()].filter(t => !readmeUsed.has(t) && README.get(t).prose);
console.log(`V1 README prose merged into ${readmeUsed.size} places`);
if (unusedProse.length) console.log(`README headings with no matching place: ${unusedProse.join(' | ')}`);
if (unresolvedStops.length)
  console.log(`\nTODO — experience stops with no matching place (kept as stops_extra):\n  ${[...new Set(unresolvedStops)].join('\n  ')}`);

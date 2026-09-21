#!/usr/bin/env node
// Regenerates README.md (VI) and versions/README.en.md from content/**.
// Both files are GENERATED — edit the YAML, not the Markdown.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent, ROOT, label } from './lib/content.mjs';

// The README's shape is a curation decision, not derivable from the taxonomy:
// Hội An is grouped by area, and `outdoor` splits into two sections.
const SECTIONS = [
  {
    anchor: 'food', emoji: '🍽️', vi: 'Đồ Ăn', en: 'Food', type: 'food',
    groups: [
      { anchor: 'food-com', cats: ['com'], vi: 'Cơm', en: 'Rice (Cơm)' },
      { anchor: 'food-bun', cats: ['bun'], vi: 'Bún', en: 'Noodles (Bún)' },
      { anchor: 'food-my-quang', cats: ['my-quang'], vi: 'Mỳ Quảng', en: 'Mì Quảng' },
      { anchor: 'food-banh-canh', cats: ['banh-canh'], vi: 'Bánh Canh', en: 'Bánh Canh' },
      { anchor: 'food-hai-san', cats: ['hai-san'], vi: 'Hải Sản', en: 'Seafood' },
      { anchor: 'food-trung-hoa', cats: ['trung-hoa'], vi: 'Ẩm thực Trung Hoa', en: 'Chinese Cuisine' },
      { anchor: 'food-an-vat', cats: ['an-vat'], vi: 'Ăn Vặt', en: 'Snacks' },
      { anchor: 'food-khac', cats: ['mon-khac', 'an-sang', 'thuan-chay'], vi: 'Món Khác', en: 'Other Dishes' },
    ],
  },
  { anchor: 'cafe', emoji: '☕', vi: 'Quán Cà phê', en: 'Cafés', type: 'coffee' },
  { anchor: 'bar-pub', emoji: '🍻', vi: 'Quán Bar / Pub', en: 'Bars / Pubs', type: 'nightlife' },
  { anchor: 'spa', emoji: '💆', vi: 'Spa & Massage', en: 'Spa & Massage', type: 'wellness' },
  { anchor: 'sight-seeing', emoji: '🚶', vi: 'Đi dạo', en: 'Walks & Sightseeing', type: 'sights' },
  { anchor: 'rowing-sup', emoji: '🏄', vi: 'Chèo SUP & Lướt sóng', en: 'Paddle Boarding (SUP) & Surfing', cats: ['sup'] },
  { anchor: 'treaking', emoji: '⛰️', vi: 'Leo núi', en: 'Hiking', cats: ['leo-nui'] },
  { anchor: 'hoi-an', emoji: '🏮', vi: 'Hội An', en: 'Hội An', area: 'hoi-an' },
];

const T = {
  vi: {
    address: 'Địa chỉ', price: 'Giá', mustTry: 'Món ăn', hours: 'Giờ & lưu ý',
    season: 'Mùa đẹp nhất', toc: '📑 Mục lục',
    title: '🍜 Đồ ăn thức uống Đà Nẵng, Việt Nam',
    tagline: "### ✅ Lượm by DaNang's Local Members And Friends",
    langs: '**🌐 Ngôn ngữ / Languages:**',
    intro: [
      '- 👉 Ghé website của tụi mình tại [danang.fyi](https://danang.fyi/)',
      '- 🙌 Có thêm idea thì [thêm địa điểm mới](../../issues/new/choose) nhé!',
      '- 🚀 Cùng lưu lại những chỗ hay ho để đỡ phải tìm kiếm nào!',
      '- 🥰 Chia sẻ cho bạn bè ở xa đến Đà Nẵng chơi nữa ha. Đảm bảo ghi điểm vô cực nè ^^',
      '- 🌟 Cuối cùng, hãy [star repo này](https://github.com/GraphicDThanh/danang-cuisine) 🌟',
    ],
    note: '> **Lưu ý:** file này được **tạo tự động** từ `content/**/*.yml`. Đừng sửa trực tiếp — sửa file YAML rồi mở PR. Xem [CONTRIBUTING.md](./CONTRIBUTING.md).',
  },
  en: {
    address: 'Address', price: 'Price', mustTry: 'Must try', hours: 'Hours & notes',
    season: 'Best season', toc: '📑 Table of Contents',
    title: '🍜 Food & Drinks in Đà Nẵng, Vietnam',
    tagline: "### ✅ Collected by Đà Nẵng's local members and friends",
    langs: '**🌐 Languages:**',
    intro: [
      '- 👉 Visit our website at [danang.fyi](https://danang.fyi/)',
      '- 🙌 Got an idea? [Add a place](../../../issues/new/choose)!',
      "- 🚀 Let's save the good spots together so nobody has to keep searching!",
      "- 🥰 Share it with friends coming to Đà Nẵng from afar. You'll score infinite points ^^",
      '- 🌟 And finally, [star this repo](https://github.com/GraphicDThanh/danang-cuisine)! 🌟',
    ],
    note: '> **Note:** this file is **generated** from `content/**/*.yml` — edit the YAML and open a PR, not this Markdown. See [CONTRIBUTING.md](../CONTRIBUTING.md).\n>\n> Addresses, street names and proper nouns are kept in Vietnamese so they are easy to look up on a map. Prices are in Vietnamese dong (`45k` = 45,000 VND).',
  },
};

const LANG_NAV = {
  vi: '**Tiếng Việt** · [English](./versions/README.en.md) · [한국어](./versions/legacy/README.ko.md) · [日本語](./versions/legacy/README.ja.md) · [中文](./versions/legacy/README.zh.md) · [Español](./versions/legacy/README.es.md) · [العربية](./versions/legacy/README.ar.md)',
  en: '[Tiếng Việt](../README.md) · **English** · [한국어](./legacy/README.ko.md) · [日本語](./legacy/README.ja.md) · [中文](./legacy/README.zh.md) · [Español](./legacy/README.es.md) · [العربية](./legacy/README.ar.md)',
};

const { taxonomy, entries } = loadContent();
const places = entries
  .filter(e => e.kind === 'places' && e.data && e.data.status !== 'closed')
  .map(e => e.data);

const collator = new Intl.Collator('vi');
const sectionOf = p =>
  SECTIONS.find(s => (s.area && p.area === s.area))
  ?? SECTIONS.find(s => (s.cats ? s.cats.includes(p.category) : s.type === p.type));

function bucket(section, group) {
  return places
    .filter(p => sectionOf(p) === section && (!group || group.cats.includes(p.category)))
    .sort((a, b) => collator.compare(a.name_vi ?? a.name, b.name_vi ?? b.name));
}

const text = (p, field, lang) => p[field]?.[lang] || p[field]?.vi || '';

function renderEntry(p, lang, level) {
  const t = T[lang];
  // `name` is the name on the sign; `name_vi` is an optional Vietnamese display
  // name for entries whose primary name isn't Vietnamese (walks, activities).
  const name = (lang === 'vi' && p.name_vi) || p.name;
  const head = p.link ? `[${name}](${p.link})` : name;
  const out = [`${'#'.repeat(level)} ${head}`, ''];
  if (p.address) out.push(p.address.includes('\n')
    ? `- **${t.address}:**\n${p.address.split('\n').map(l => '  ' + l).join('\n')}`
    : `- **${t.address}:** ${p.address}`);
  if (p.price_vnd) out.push(`- **${t.price}:** ${p.price_vnd}`);
  const prose = text(p, 'why_we_go', lang);
  const mustTry = text(p, 'must_try', lang);
  if (mustTry && !prose.includes(mustTry)) out.push(`- **${t.mustTry}:** ${mustTry}`);
  const seasons = (p.best_season ?? []).filter(s => s !== 'year-round');
  if (seasons.length)
    out.push(`- **${t.season}:** ${seasons.map(s => `${taxonomy.best_season[s].emoji} ${label(taxonomy, 'best_season', s, lang)}`).join(', ')}`);
  const hours = text(p, 'hours_notes', lang);
  if (hours && !prose.includes(hours)) out.push(`- **${t.hours}:** ${hours}`);
  // why_we_go carries V1's Markdown bullets verbatim, so it renders as-is.
  if (prose) out.push(/^(-|\d+\.)\s/.test(prose) ? prose : `- ${prose}`);
  out.push('');
  return out.join('\n');
}

function build(lang) {
  const t = T[lang];
  const imgPrefix = lang === 'vi' ? './assets' : '../assets';
  const out = [
    '<p align="center">',
    ` <img align="center" alt="WeDanang Logo" src="${imgPrefix}/images/wedanang-logo-landscape.png" />`,
    '</p>',
    '',
    `${t.langs} ${LANG_NAV[lang]}`,
    '',
    `# ${t.title}`,
    '',
    t.tagline,
    '',
    ...t.intro,
    '',
    '**Enjoy Your DaNang!**',
    '',
    '---',
    '',
    `# ${t.toc}`,
    '',
  ];

  SECTIONS.forEach((s, i) => {
    out.push(`${i + 1}. [${s[lang]}](#${s.anchor})`);
    for (const g of s.groups ?? []) out.push(`   - [${g[lang]}](#${g.anchor})`);
  });

  out.push('', t.note, '', '---', '');

  for (const s of SECTIONS) {
    out.push(`## <a name="${s.anchor}"></a> ${s.emoji} ${s[lang]}`, '');
    if (s.groups) {
      for (const g of s.groups) {
        const items = bucket(s, g);
        if (!items.length) continue;
        out.push(`### <a name="${g.anchor}"></a> ${g[lang]}`, '');
        for (const p of items) out.push(renderEntry(p, lang, 4));
      }
    } else {
      for (const p of bucket(s)) out.push(renderEntry(p, lang, 3));
    }
    out.push('---', '');
  }

  out.push('<p align="center"><strong>🥰 Enjoy Your DaNang And Share With Us 🥰</strong></p>', '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const orphans = places.filter(p => !sectionOf(p));
if (orphans.length) {
  console.error(`No README section for: ${orphans.map(p => p.slug).join(', ')}`);
  console.error('Add a section (or a category to an existing one) in src/build-readme.mjs.');
  process.exit(1);
}

writeFileSync(join(ROOT, 'README.md'), build('vi'));
writeFileSync(join(ROOT, 'versions', 'README.en.md'), build('en'));
console.log(`Wrote README.md and versions/README.en.md from ${places.length} places.`);

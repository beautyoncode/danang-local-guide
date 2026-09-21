#!/usr/bin/env node
// Runs .github/google-form/Code.gs against a sample submission in a stubbed
// Apps Script environment, then feeds the YAML it produces through the same
// validator CI uses. Catches the form and the schema drifting apart.
//
//   node src/test-form-script.mjs
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { ROOT, CONTENT, loadTaxonomy } from './lib/content.mjs';

const src = readFileSync(join(ROOT, '.github', 'google-form', 'Code.gs'), 'utf8');
const sandbox = {
  Utilities: { formatDate: (d, _tz, _f) => d.toISOString().slice(0, 10) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'stub' }) },
  UrlFetchApp: null, MailApp: null, Session: null, Logger: null,
};
// eslint-disable-next-line no-new-func
const gs = new Function(...Object.keys(sandbox),
  `${src}; return { toYamlBlock_, slugify_, Q, TYPE, AREA, SESSION, SEASON, RELATIONSHIP };`
)(...Object.values(sandbox));

const { Q } = gs;
const answer = {
  [Q.name]: ['Bánh mì Bà Lan'],
  [Q.address]: ['https://maps.app.goo.gl/exampleLinkForTesting1'],
  [Q.type]: ['Đồ ăn / Food'],
  [Q.area]: ['Hải Châu'],
  [Q.price]: ['15k–25k'],
  [Q.session]: ['Sáng sớm (4:30–7AM), Buổi sáng (7–11AM)'],
  [Q.season]: ['Quanh năm / Year-round'],
  [Q.mustTry]: ['Bánh mì thịt nướng'],
  [Q.why]: ['Bánh mì nóng giòn, pate nhà làm.\nCô bán từ 5h sáng, tầm 8h là hết.'],
  [Q.lastVisited]: ['2026-09-15'],
  [Q.downside]: ['Không có chỗ ngồi, phải mua mang đi.'],
  [Q.relationship]: ['Không liên quan / No relationship'],
  [Q.photos]: [''],
  [Q.credit]: ['Minh'],
  Timestamp: ['2026-09-21 08:00:00'],
};

const block = gs.toYamlBlock_(answer, 'Bánh mì Bà Lan');
console.log(block + '\n');

// 1. It parses, and the TODO comments don't break it.
const parsed = YAML.parse(block);
assert.equal(parsed.slug, 'banh-mi-ba-lan', 'slug is Vietnamese-aware');
assert.equal(parsed.type, 'food');
assert.equal(parsed.area, 'hai-chau');
assert.equal(parsed.status, 'draft');
assert.deepEqual(parsed.best_session, ['early-morning', 'morning']);
assert.deepEqual(parsed.best_season, ['year-round']);
assert.match(parsed.why_we_go.vi, /pate nhà làm/, 'multi-line prose survives');
assert.match(parsed.why_we_go.vi, /\n/, 'the newline survives as a block scalar');
assert.deepEqual(parsed.contributed_by, ['Minh']);

// 2. Every option label the form offers maps to a real taxonomy key.
const taxonomy = loadTaxonomy();
for (const [group, table] of [['type', gs.TYPE], ['area', gs.AREA],
  ['best_session', gs.SESSION], ['best_season', gs.SEASON], ['relationship', gs.RELATIONSHIP]]) {
  for (const [labelText, key] of Object.entries(table))
    assert.ok(key in taxonomy[group],
      `form option "${labelText}" maps to "${key}", which is not in taxonomy.yml ${group}`);
}

// 3. The block, once a maintainer fills the TODOs, passes the real validator.
const file = join(CONTENT, 'places', `${parsed.slug}.yml`);
const filled = { ...parsed, category: 'an-sang', price_band: '1', vibe: ['street-food', 'local'], good_for: ['solo'] };
delete filled.link;                        // the sample address IS the Maps link
filled.link = answer[Q.address][0];
writeFileSync(file, YAML.stringify(filled, { lineWidth: 0 }));
try {
  execFileSync('node', [join(ROOT, 'src', 'validate.mjs')], { stdio: 'pipe' });
  console.log('✅ form output passes validate.mjs once category/price_band/vibe/good_for are filled');
} catch (e) {
  console.error(e.stdout?.toString() ?? e.message);
  throw new Error('validate.mjs rejected the form-generated file');
} finally {
  unlinkSync(file);
}

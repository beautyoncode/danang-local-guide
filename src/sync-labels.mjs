#!/usr/bin/env node
// Applies .github/labels.yml to the repo via the gh CLI. Idempotent: creates
// what is missing, updates colour and description on what exists, deletes
// nothing. Run it after editing labels.yml.
//
//   npm run labels            # apply
//   npm run labels -- --dry   # show what would change
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { ROOT, loadTaxonomy } from './lib/content.mjs';

const DRY = process.argv.includes('--dry');
const labels = YAML.parse(readFileSync(join(ROOT, '.github', 'labels.yml'), 'utf8'));

// One area label per taxonomy area — catches a new area being added to the
// taxonomy without its label.
const areas = Object.keys(loadTaxonomy().area);
const missing = areas.filter(a => !labels.some(l => l.name === `area:${a}`));
if (missing.length) {
  console.error(`labels.yml is missing an entry for: ${missing.map(a => `area:${a}`).join(', ')}`);
  process.exit(1);
}

// An unquoted hex colour like 5319E7 parses as a number in YAML. Catch it here
// rather than as an opaque HTTP 422 halfway through applying the set.
const badColor = labels.filter(l => !/^[0-9a-f]{6}$/i.test(String(l.color)));
if (badColor.length) {
  console.error('Invalid colour in .github/labels.yml — must be 6 hex digits, quoted:');
  for (const l of badColor) console.error(`  ${l.name}: ${l.color}`);
  console.error('\nIf it looks like a big number, YAML read the hex as scientific notation. Quote it.');
  process.exit(1);
}

const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const existing = new Map(
  JSON.parse(gh(['label', 'list', '--limit', '200', '--json', 'name,color,description']))
    .map(l => [l.name, l]));

let created = 0, updated = 0, same = 0;
for (const l of labels) {
  const have = existing.get(l.name);
  if (have && have.color.toLowerCase() === l.color.toLowerCase() && have.description === l.description) {
    same++;
    continue;
  }
  const verb = have ? 'update' : 'create';
  console.log(`${verb}: ${l.name}`);
  if (!DRY) gh(['label', verb === 'create' ? 'create' : 'edit', l.name,
    '--color', l.color, '--description', l.description, ...(have ? [] : ['--force'])]);
  have ? updated++ : created++;
}
console.log(`\n${created} created, ${updated} updated, ${same} already correct${DRY ? ' (dry run)' : ''}`);

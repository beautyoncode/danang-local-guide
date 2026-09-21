/**
 * Da Nang Local Guide — public submission form -> GitHub issue.
 *
 * Bound to the FORM'S RESPONSE SPREADSHEET (Extensions -> Apps Script), with an
 * INSTALLABLE onFormSubmit trigger. The simple trigger cannot call UrlFetchApp.
 *
 * Setup: Project Settings -> Script Properties
 *   GH_TOKEN  fine-grained PAT, this repo only, "Issues: read & write", nothing else
 *   GH_REPO   GraphicDThanh/danang-local-guide
 *
 * A submission creates an ISSUE, never content. Nothing reaches the repo,
 * the README or Notion until a maintainer opens a PR and CI passes.
 */

// Question titles, verbatim. If you rename a question in the form, rename it
// here too — the script emails you rather than silently dropping the answer.
var Q = {
  name:         'Tên quán / Place name',
  address:      'Địa chỉ hoặc link Google Maps / Address or Google Maps link',
  type:         'Loại / Type',
  area:         'Khu vực / Area',
  price:        'Giá khoảng bao nhiêu? / Roughly how much?',
  session:      'Thời điểm nên đi / Best time of day',
  season:       'Mùa nào đẹp nhất? / Best season',
  mustTry:      'Nên gọi món gì? / What should you order?',
  why:          'Vì sao bạn thích chỗ này? / Why do you go?',
  lastVisited:  'Bạn đi gần đây nhất khi nào? / When did you last go?',
  downside:     'Điểm trừ / Any downside',
  relationship: 'Bạn có liên quan tới quán không? / Your relationship to the place',
  photos:       'Ảnh / Photos',
  credit:       'Tên để ghi nhận / Name for credit (optional)'
};

// Option label -> taxonomy key. Must match content/taxonomy.yml.
var TYPE = {
  'Đồ ăn / Food': 'food',
  'Cà phê / Coffee': 'coffee',
  'Bar, pub / Nightlife': 'nightlife',
  'Spa & massage / Wellness': 'wellness',
  'Đi dạo, tham quan / Sights & walks': 'sights',
  'Ngoài trời / Outdoor': 'outdoor'
};
var AREA = {
  'Hải Châu': 'hai-chau', 'Sơn Trà': 'son-tra', 'Mỹ An': 'my-an',
  'Liên Chiểu': 'lien-chieu', 'Hòa Xuân': 'hoa-xuan', 'Hội An': 'hoi-an'
};
var SESSION = {
  'Sáng sớm (4:30–7AM)': 'early-morning', 'Buổi sáng (7–11AM)': 'morning',
  'Buổi trưa (11AM–2PM)': 'lunch', 'Buổi chiều (2–5PM)': 'afternoon',
  'Hoàng hôn (5–6:30PM)': 'sunset', 'Bữa tối (6–9PM)': 'dinner',
  'Buổi tối (7–11PM)': 'evening', 'Khuya (sau 11PM)': 'late-night'
};
var SEASON = {
  'Quanh năm / Year-round': 'year-round',
  'Mùa xuân (2–4) / Spring': 'spring',
  'Mùa hè (5–8) / Summer': 'summer',
  'Mùa thu, mùa mưa (9–11) / Autumn, rainy': 'autumn',
  'Mùa đông (12–1) / Winter': 'winter'
};
var RELATIONSHIP = {
  'Không liên quan / No relationship': 'none',
  'Mình là chủ quán / I own it': 'owner',
  'Người thân hoặc bạn bè / Family or friend': 'family-or-friend'
};

function onFormSubmit(e) {
  try {
    var r = e.namedValues;
    var name = get_(r, Q.name);
    if (!name) return;                       // empty or partial submission

    checkFieldNames_(r);

    var labels = ['via-form', 'needs-triage'];
    // Crude link-spam guard: a promo blast puts a URL in the free-text answer.
    if (/https?:\/\//i.test(get_(r, Q.why))) labels.push('possible-spam');
    if (RELATIONSHIP[get_(r, Q.relationship)] === 'owner') labels.push('needs-verification');

    createIssue_('[form] ' + name, buildBody_(r, name), labels);
  } catch (err) {
    notifyOwner_('Form -> GitHub failed', String(err && err.stack || err) +
      '\n\nThe response is still in the sheet. Fix the cause, then re-run ' +
      'onFormSubmit for that row (or re-submit) — nothing is lost.');
    throw err;
  }
}

function buildBody_(r, name) {
  var lines = [
    '> Submitted via the public form. **Not reviewed yet** — nothing here is published.',
    '',
    'Triage: check for a duplicate, sanity-check the price and the Maps link, then',
    'save the block below as `content/places/' + slugify_(name) + '.yml` and open a PR.',
    '',
    '```yaml',
    toYamlBlock_(r, name),
    '```',
    '',
    '| | |',
    '| --- | --- |',
    '| **Last visited** | ' + (get_(r, Q.lastVisited) || '_not given_') + ' |',
    '| **Downside** | ' + (get_(r, Q.downside) || '_not given_') + ' |',
    '| **Relationship** | ' + (get_(r, Q.relationship) || '_not given_') + ' |',
    '| **Photos** | ' + (get_(r, Q.photos) || '_none_') + ' |',
    '| **Credit as** | ' + (get_(r, Q.credit) || '_anonymous_') + ' |',
    '',
    '_Photos are Drive links: upload them to the Notion `Photo` property, not to the repo._'
  ];
  return lines.join('\n');
}

function toYamlBlock_(r, name) {
  var out = [];
  var push = function (k, v) { if (v !== '' && v != null) out.push(k + ': ' + v); };

  push('slug', slugify_(name));
  push('name', quote_(name));
  push('type', map_(TYPE, get_(r, Q.type)) || '# TODO: ' + get_(r, Q.type));
  push('category', '# TODO: pick from taxonomy.yml `category` (must belong to the type above)');
  push('area', map_(AREA, get_(r, Q.area)) || '# TODO: ' + get_(r, Q.area));
  push('address', quote_(get_(r, Q.address)));
  push('price_vnd', quote_(get_(r, Q.price)));
  push('price_band', '"1"  # TODO: 1..4');

  var sessions = mapList_(SESSION, getList_(r, Q.session));
  if (sessions.length) push('best_session', '[' + sessions.join(', ') + ']');
  var seasons = mapList_(SEASON, getList_(r, Q.season));
  push('best_season', '[' + (seasons.length ? seasons.join(', ') : 'year-round') + ']');

  var mustTry = get_(r, Q.mustTry);
  if (mustTry) { out.push('must_try:'); out.push('  vi: ' + quote_(mustTry)); }

  out.push('why_we_go:');
  out.push('  vi: ' + block_(get_(r, Q.why), '    '));

  var downside = get_(r, Q.downside);
  if (downside) { out.push('hours_notes:'); out.push('  vi: ' + quote_(downside)); }

  push('link', get_(r, Q.address).indexOf('http') === 0 ? get_(r, Q.address) : '# TODO: Google Maps link');
  push('status', 'draft');
  push('last_checked', today_());
  push('relationship', map_(RELATIONSHIP, get_(r, Q.relationship)) || 'none');
  var credit = get_(r, Q.credit);
  push('contributed_by', '[' + quote_(credit || 'anonymous') + ']');
  out.push('# TODO before merge: fill `category`, `price_band`, `vibe`, `good_for`,');
  out.push('# and translate why_we_go into `en` (or label the PR needs-translation).');
  return out.join('\n');
}

// ---- helpers --------------------------------------------------------------

function get_(r, key) {
  var v = r[key];
  return (v && v[0] ? String(v[0]) : '').trim();
}

function getList_(r, key) {
  return get_(r, key).split(',').map(function (s) { return s.trim(); }).filter(String);
}

function map_(table, label) { return table[label] || ''; }

function mapList_(table, labels) {
  var out = [];
  for (var i = 0; i < labels.length; i++) if (table[labels[i]]) out.push(table[labels[i]]);
  return out;
}

/** Emails you if a form question was renamed, instead of dropping the answer. */
function checkFieldNames_(r) {
  var known = {};
  for (var k in Q) known[Q[k]] = true;
  known['Timestamp'] = true;
  known['Dấu thời gian'] = true;
  var unknown = [];
  for (var title in r) if (!known[title]) unknown.push(title);
  if (unknown.length) {
    notifyOwner_('Form question renamed',
      'These form questions are not in Code.gs and their answers are being ignored:\n\n  ' +
      unknown.join('\n  ') + '\n\nUpdate the Q map in Code.gs.');
  }
}

/** "Mỳ Quảng Vỉa Hè (Hà Thân)" -> "my-quang-via-he-ha-than" */
function slugify_(s) {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function quote_(s) {
  return s ? "'" + String(s).replace(/'/g, "''") + "'" : '';
}

/** Multi-line prose as a YAML block scalar, so newlines survive. */
function block_(s, indent) {
  if (!s) return "''";
  if (s.indexOf('\n') === -1) return quote_(s);
  return '|-\n' + indent + String(s).split('\n').join('\n' + indent);
}

function today_() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
}

function createIssue_(title, body, labels) {
  var props = PropertiesService.getScriptProperties();
  var repo = props.getProperty('GH_REPO');
  var token = props.getProperty('GH_TOKEN');
  if (!repo || !token) throw new Error('Set GH_REPO and GH_TOKEN in Script Properties.');

  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/issues', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    muteHttpExceptions: true,
    payload: JSON.stringify({ title: title, body: body, labels: labels })
  });

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('GitHub returned ' + code + ': ' + res.getContentText().slice(0, 500));
  }
  return JSON.parse(res.getContentText());
}

function notifyOwner_(subject, message) {
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
      '[Da Nang Local Guide] ' + subject, message);
  } catch (ignored) { /* never let the mailer mask the original error */ }
}

/** Run once from the editor to confirm the token and repo work end to end. */
function testConnection() {
  var issue = createIssue_(
    '[form] Test submission — safe to close',
    'Created by `testConnection()` in Code.gs. If you can read this, the token and repo are correct.',
    ['via-form', 'needs-triage']);
  Logger.log('Created ' + issue.html_url);
}

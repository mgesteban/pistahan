/**
 * Pistahan 33 check-in backend — Google Apps Script, bound to the volunteer Sheet.
 *
 * Deploy: Extensions → Apps Script → Deploy → Web app
 *   Execute as: Me · Who has access: Anyone
 *
 * Script Properties (Project Settings → Script Properties):
 *   SCANNER_KEY — used by the station scanner app; typed in at device setup,
 *                 never shipped in any bundle. Guards roster/checkin/walkup/stats.
 *   LOOKUP_KEY  — baked into the public /pass page; guards ONLY the
 *                 one-record-by-email lookup.
 *   ADMIN_KEY   — guards roster import (bulk overwrite of the Roster tab);
 *                 known only to the coordinator's machine (.env), never
 *                 shipped in any bundle or typed on event day.
 *
 * CORS: clients POST with Content-Type text/plain (a "simple request", no
 * preflight — Apps Script cannot answer preflights). Body is a JSON string.
 */

var SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

var ROSTER_COLS = [
  'token', 'first_name', 'last_name', 'email', 'phone', 'shirt_size',
  'team', 'post', 'days', 'shift_start', 'shift_end', 'notes', 'is_minor',
  'assignments', 'pass_sent_email', 'pass_sent_sms'
];
var CHECKIN_COLS = [
  'scan_id', 'timestamp_client', 'timestamp_server', 'token',
  'station', 'method', 'operator'
];
var WALKUP_COLS = [
  'first_name', 'last_name', 'phone', 'shirt_size', 'post',
  'added_by', 'added_at'
];

var TOKEN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L

// Event timezone — all sheet timestamps are written in SF local time,
// not UTC (toISOString), which reads 7h ahead and rolls the date at 5pm.
var TZ = 'America/Los_Angeles';

function localStamp_(date) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM-dd HH:mm:ss');
}

// ---------------------------------------------------------------- entrypoints

function doGet(e) {
  try {
    var p = e.parameter || {};
    if (p.action === 'lookup') {
      requireKey_(p.key, 'LOOKUP_KEY');
      rateLimit_();
      return json_(lookup_(p));
    }
    requireKey_(p.key, 'SCANNER_KEY');
    if (p.action === 'roster') return json_(roster_());
    if (p.action === 'stats') return json_(stats_());
    return json_({ error: 'unknown action' });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'import_roster') {
      requireKey_(body.key, 'ADMIN_KEY');
      return json_(importRoster_(body.rows || []));
    }
    requireKey_(body.key, 'SCANNER_KEY');
    if (body.action === 'checkin') return json_(checkin_(body.scans || []));
    if (body.action === 'walkup') return json_(walkup_(body.walkups || []));
    return json_({ error: 'unknown action' });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// ------------------------------------------------------------------- actions

function roster_() {
  var rows = readTab_('Roster', ROSTER_COLS);
  var volunteers = rows.map(function (r) {
    // email/phone stay out of the payload — it lands in browser storage
    return {
      token: r.token, first_name: r.first_name, last_name: r.last_name,
      shirt_size: r.shirt_size, team: r.team, post: r.post, days: r.days,
      shift_start: r.shift_start, shift_end: r.shift_end,
      notes: r.notes, is_minor: truthy_(r.is_minor), assignments: r.assignments
    };
  }).filter(function (v) { return v.token; });
  return {
    version: localStamp_(new Date()),
    count: volunteers.length,
    volunteers: volunteers
  };
}

function lookup_(p) {
  var rows = readTab_('Roster', ROSTER_COLS);
  var email = String(p.email || '').trim().toLowerCase();
  var last = String(p.last_name || '').trim().toLowerCase();
  var phone4 = String(p.phone4 || '').replace(/\D/g, '');
  var match = null;

  if (email) {
    match = rows.filter(function (r) {
      return String(r.email).trim().toLowerCase() === email;
    })[0];
  } else if (last && phone4.length === 4) {
    match = rows.filter(function (r) {
      return String(r.last_name).trim().toLowerCase() === last &&
        String(r.phone).replace(/\D/g, '').slice(-4) === phone4;
    })[0];
  }

  if (!match || !match.token) {
    return { found: false, message: 'Not found — see the help desk on event day.' };
  }
  // One record only; no email/phone in the response.
  return {
    found: true,
    volunteer: {
      token: match.token, first_name: match.first_name, last_name: match.last_name,
      shirt_size: match.shirt_size, team: match.team, post: match.post,
      days: match.days, shift_start: match.shift_start, shift_end: match.shift_end,
      assignments: match.assignments
    }
  };
}

function checkin_(scans) {
  if (!scans.length) return { accepted: [], duplicates: [] };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = tab_('CheckIns');
    var existing = existingScanIds_(sheet);
    var now = localStamp_(new Date());
    var accepted = [], duplicates = [], newRows = [];

    scans.forEach(function (s) {
      if (!s.scan_id) return;
      if (existing[s.scan_id]) {
        duplicates.push(s.scan_id);
        return;
      }
      existing[s.scan_id] = true;
      accepted.push(s.scan_id);
      newRows.push([
        s.scan_id,
        s.timestamp_client ? localStamp_(new Date(s.timestamp_client)) : '',
        now, s.token || '',
        s.station || '', s.method || '', s.operator || ''
      ]);
    });

    if (newRows.length) {
      // Single batched write — appendRow in a loop is ~50x slower.
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, CHECKIN_COLS.length)
        .setValues(newRows);
    }
    return { accepted: accepted, duplicates: duplicates };
  } finally {
    lock.releaseLock();
  }
}

function walkup_(walkups) {
  if (!walkups.length) return { accepted: 0 };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = tab_('Walkups');
    var now = localStamp_(new Date());
    var rows = walkups.map(function (w) {
      return [
        w.first_name || '', w.last_name || '', w.phone || '',
        w.shirt_size || '', w.post || '', w.added_by || '', now
      ];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, WALKUP_COLS.length)
      .setValues(rows);
    return { accepted: rows.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Bulk-replace the Roster tab with a freshly converted roster (see
 * scripts/convert_assignments.py + scripts/push_roster.py). pass_sent_*
 * stamps already in the Sheet are kept for matching tokens so nobody
 * gets a duplicate pass email after a re-import.
 */
function importRoster_(rows) {
  if (!rows.length) return { error: 'no rows' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = tab_('Roster');
    var sent = {};
    readTab_('Roster', ROSTER_COLS).forEach(function (r) {
      if (r.token && (r.pass_sent_email || r.pass_sent_sms)) {
        sent[r.token] = { email: r.pass_sent_email, sms: r.pass_sent_sms };
      }
    });
    var values = rows.map(function (r) {
      var keep = sent[r.token] || {};
      return ROSTER_COLS.map(function (c) {
        if (c === 'pass_sent_email') return r[c] || keep.email || '';
        if (c === 'pass_sent_sms') return r[c] || keep.sms || '';
        return r[c] == null ? '' : r[c];
      });
    });
    var previous = sheet.getLastRow() - 1;
    if (previous > 0) {
      sheet.getRange(2, 1, previous, ROSTER_COLS.length).clearContent();
    }
    sheet.getRange(2, 1, values.length, ROSTER_COLS.length).setValues(values);
    return { imported: values.length, previous: previous };
  } finally {
    lock.releaseLock();
  }
}

function stats_() {
  var checkins = tab_('CheckIns');
  var tokens = {};
  if (checkins.getLastRow() > 1) {
    checkins.getRange(2, 4, checkins.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) tokens[r[0]] = true; });
  }
  var rosterCount = tab_('Roster').getLastRow() - 1;
  return { checked_in: Object.keys(tokens).length, roster: rosterCount };
}

// ----------------------------------------------------- one-time admin scripts

/** Run once from the editor. Fills empty token cells; never overwrites. */
function generateTokens() {
  var sheet = tab_('Roster');
  var col = ROSTER_COLS.indexOf('token') + 1;
  var n = sheet.getLastRow() - 1;
  if (n < 1) return;
  var range = sheet.getRange(2, col, n, 1);
  var values = range.getValues();
  var used = {};
  values.forEach(function (r) { if (r[0]) used[r[0]] = true; });
  var changed = 0;
  values.forEach(function (r) {
    if (r[0]) return;
    var t;
    do { t = 'PST-' + randomSuffix_(4); } while (used[t]);
    used[t] = true;
    r[0] = t;
    changed++;
  });
  range.setValues(values);
  Logger.log('Generated ' + changed + ' tokens');
}

/**
 * Run manually, once per day starting Aug 3 (consumer Gmail = 100 recipients/day).
 * Skips rows already stamped in pass_sent_email; stops at the daily budget.
 */
function sendPassEmails() {
  var DAILY_BUDGET = 95; // headroom under the 100/day consumer cap
  var PASS_URL = 'https://pistahan.vercel.app/pass'; // update after first deploy
  var sheet = tab_('Roster');
  var rows = readTab_('Roster', ROSTER_COLS);
  var sentCol = ROSTER_COLS.indexOf('pass_sent_email') + 1;
  var sent = 0;
  for (var i = 0; i < rows.length && sent < DAILY_BUDGET; i++) {
    var r = rows[i];
    if (!r.email || r.pass_sent_email) continue;
    MailApp.sendEmail({
      to: String(r.email).trim(),
      subject: 'Pistahan 33 — your volunteer check-in pass',
      htmlBody:
        '<p>Salamat for volunteering at Pistahan 33!</p>' +
        '<p><b>Open this link now and screenshot your pass:</b><br>' +
        '<a href="' + PASS_URL + '">' + PASS_URL + '</a></p>' +
        '<p>Enter the email address this message was sent to. Your pass has ' +
        'your QR code, assignment, and where to go. Screenshot it so it works ' +
        'even with bad cell service on event day.</p>' +
        '<p>Questions? Reply to this email or find the help desk on site.</p>'
    });
    sheet.getRange(i + 2, sentCol).setValue(localStamp_(new Date()));
    sent++;
  }
  Logger.log('Sent ' + sent + ' pass emails');
}

// -------------------------------------------------------------------- helpers

function requireKey_(key, propName) {
  var expected = PropertiesService.getScriptProperties().getProperty(propName);
  if (!expected) throw new Error(propName + ' not set in Script Properties');
  if (key !== expected) throw new Error('bad key');
}

/** Global (not per-client — Apps Script never sees the IP) lookup throttle. */
function rateLimit_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('lookup_rate') || 0) + 1;
  cache.put('lookup_rate', String(n), 60);
  if (n > 60) throw new Error('rate limited — try again in a minute');
}

function tab_(name) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('missing tab: ' + name);
  return sheet;
}

function readTab_(name, cols) {
  var sheet = tab_(name);
  var n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  return sheet.getRange(2, 1, n, cols.length).getValues().map(function (row) {
    var obj = {};
    cols.forEach(function (c, i) { obj[c] = row[i]; });
    return obj;
  });
}

function existingScanIds_(sheet) {
  var ids = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) ids[r[0]] = true; });
  }
  return ids;
}

function randomSuffix_(len) {
  var s = '';
  for (var i = 0; i < len; i++) {
    s += TOKEN_ALPHABET.charAt(Math.floor(Math.random() * TOKEN_ALPHABET.length));
  }
  return s;
}

function truthy_(v) {
  return v === true || String(v).toLowerCase() === 'true' || v === 1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

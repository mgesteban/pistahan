/**
 * Pistahan 33 check-in backend — Google Apps Script, bound to the volunteer Sheet.
 *
 * Deploy: Extensions → Apps Script → Deploy → Web app
 *   Execute as: Me · Who has access: Anyone
 *
 * Script Properties (Project Settings → Script Properties):
 *   SCANNER_KEY — used by the station scanner app; typed in at device setup,
 *                 never shipped in any bundle. Guards roster/checkin/walkup/
 *                 stats and the contingent actions (list/checkin/register).
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
// Parade contingents. code = cluster code (e.g. "A5"), the unique id.
// Run setupContingentTabs() once from the editor to create the three tabs.
var CONTINGENT_COLS = [
  'code', 'number', 'name', 'contact_name', 'contact_phone', 'participants',
  'vehicles', 'staging', 'description', 'fun_facts', 'notes'
];
var CONTINGENT_CHECKIN_COLS = [
  'checkin_id', 'timestamp_client', 'timestamp_server', 'code', 'operator'
];
var CONTINGENT_REG_COLS = [
  'name', 'contact_name', 'contact_phone', 'cluster', 'vehicles', 'notes',
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
    if (p.action === 'contingents') return json_(contingents_());
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
    if (body.action === 'contingent_checkin') return json_(contingentCheckin_(body.checkins || []));
    if (body.action === 'contingent_register') return json_(contingentRegister_(body.regs || []));
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
  var q = String(p.q || '').trim();
  var matches = [];

  if (q) {
    // One box, four ways in: email, phone digits, last name, or first name.
    var ql = q.toLowerCase();
    var digits = q.replace(/\D/g, '');
    var punctOnly = q.replace(/[\d\s().+-]/g, '') === '';
    if (q.indexOf('@') !== -1) {
      matches = rows.filter(function (r) {
        return String(r.email).trim().toLowerCase() === ql;
      });
    } else if (punctOnly && digits.length >= 4) {
      matches = rows.filter(function (r) {
        var ph = String(r.phone).replace(/\D/g, '');
        return ph && ph.slice(-digits.length) === digits;
      });
    } else {
      // Accept first, last, or full name ("Grace Esteban", "Esteban, Grace").
      var norm = ql.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      matches = rows.filter(function (r) {
        var first = String(r.first_name).trim().toLowerCase();
        var last = String(r.last_name).trim().toLowerCase();
        var full = (first + ' ' + last).replace(/\s+/g, ' ').trim();
        var rev = (last + ' ' + first).replace(/\s+/g, ' ').trim();
        return last === norm || first === norm || full === norm || rev === norm;
      });
    }
  } else {
    // Legacy params from clients cached before the single-box lookup.
    var email = String(p.email || '').trim().toLowerCase();
    var last = String(p.last_name || '').trim().toLowerCase();
    var phone4 = String(p.phone4 || '').replace(/\D/g, '');
    if (email) {
      matches = rows.filter(function (r) {
        return String(r.email).trim().toLowerCase() === email;
      });
    } else if (last && phone4.length === 4) {
      matches = rows.filter(function (r) {
        return String(r.last_name).trim().toLowerCase() === last &&
          String(r.phone).replace(/\D/g, '').slice(-4) === phone4;
      });
    }
  }

  if (matches.length > 1) {
    // Never list people — make the caller narrow it down instead.
    return { found: false, message: 'More than one volunteer matches — try your email or the last 4 digits of your phone.' };
  }
  var match = matches[0];
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

/**
 * Full contingent list for the Contingent and MC stations. Contact info IS
 * included — unlike the public volunteer roster, this payload only ever
 * lands on scanner-key devices held by the named coordinators and the MC.
 */
function contingents_() {
  var rows = readTab_('Contingents', CONTINGENT_COLS);
  var contingents = rows.map(function (r) {
    var obj = {};
    CONTINGENT_COLS.forEach(function (c) {
      obj[c] = r[c] == null ? '' : String(r[c]);
    });
    return obj;
  }).filter(function (c) { return c.code && c.name; });
  return {
    version: localStamp_(new Date()),
    count: contingents.length,
    contingents: contingents
  };
}

/** Arrival log for contingents — same append-only/dedupe shape as checkin_. */
function contingentCheckin_(checkins) {
  if (!checkins.length) return { accepted: [], duplicates: [] };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = tab_('ContingentCheckIns');
    var existing = existingScanIds_(sheet);
    var now = localStamp_(new Date());
    var accepted = [], duplicates = [], newRows = [];

    checkins.forEach(function (c) {
      if (!c.checkin_id) return;
      if (existing[c.checkin_id]) {
        duplicates.push(c.checkin_id);
        return;
      }
      existing[c.checkin_id] = true;
      accepted.push(c.checkin_id);
      newRows.push([
        c.checkin_id,
        c.timestamp_client ? localStamp_(new Date(c.timestamp_client)) : '',
        now, c.code || '', c.operator || ''
      ]);
    });

    if (newRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, CONTINGENT_CHECKIN_COLS.length)
        .setValues(newRows);
    }
    return { accepted: accepted, duplicates: duplicates };
  } finally {
    lock.releaseLock();
  }
}

/** On-site late adds; the parade team assigns them a real slot afterwards. */
function contingentRegister_(regs) {
  if (!regs.length) return { accepted: 0 };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = tab_('ContingentRegistrations');
    var now = localStamp_(new Date());
    var rows = regs.map(function (r) {
      return [
        r.name || '', r.contact_name || '', r.contact_phone || '',
        r.cluster || '', r.vehicles || '', r.notes || '',
        r.added_by || '', now
      ];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CONTINGENT_REG_COLS.length)
      .setValues(rows);
    return { accepted: rows.length };
  } finally {
    lock.releaseLock();
  }
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

/**
 * Run once from the editor before the parade build-out. Creates the three
 * contingent tabs with header rows if they don't exist; never touches data.
 * Paste/import the contingent roster into the Contingents tab afterwards.
 */
function setupContingentTabs() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  [
    ['Contingents', CONTINGENT_COLS],
    ['ContingentCheckIns', CONTINGENT_CHECKIN_COLS],
    ['ContingentRegistrations', CONTINGENT_REG_COLS]
  ].forEach(function (spec) {
    var name = spec[0], cols = spec[1];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      Logger.log('Created tab: ' + name);
    } else {
      Logger.log('Tab exists, skipped: ' + name);
    }
  });
}

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
  var PASS_URL = 'https://pistahan.app/pass'; // custom domain; must be live in Vercel before emailing
  var NOTIFY = 'gracesteban@gmail.com'; // gets a test copy + run summary each run
  var passBody =
    '<p>Salamat for volunteering at Pistahan 33!</p>' +
    '<p><b>Open this link now and screenshot your pass:</b><br>' +
    '<a href="' + PASS_URL + '">' + PASS_URL + '</a></p>' +
    '<p>Enter the email address this message was sent to. Your pass has ' +
    'your QR code, assignment, and where to go. Screenshot it so it works ' +
    'even with bad cell service on event day.</p>' +
    '<p>Questions? Reply to this email or find the help desk on site.</p>';
  var sheet = tab_('Roster');
  var rows = readTab_('Roster', ROSTER_COLS);
  var sentCol = ROSTER_COLS.indexOf('pass_sent_email') + 1;
  var sent = 0, recipients = [];
  for (var i = 0; i < rows.length && sent < DAILY_BUDGET; i++) {
    var r = rows[i];
    if (!r.email || r.pass_sent_email) continue;
    MailApp.sendEmail({
      to: String(r.email).trim(),
      subject: 'Pistahan 33 — your volunteer check-in pass',
      htmlBody: passBody
    });
    sheet.getRange(i + 2, sentCol).setValue(localStamp_(new Date()));
    recipients.push(r.first_name + ' ' + r.last_name + ' <' + String(r.email).trim() + '>');
    sent++;
  }
  MailApp.sendEmail({
    to: NOTIFY,
    subject: '[TEST] Pistahan pass run — ' + sent + ' sent · ' + localStamp_(new Date()),
    htmlBody:
      '<p><b>sendPassEmails just ran.</b> ' + sent + ' pass email(s) went out. ' +
      'Below the line is exactly what volunteers received.</p>' +
      (recipients.length
        ? '<p><b>Sent to:</b><br>' + recipients.join('<br>') + '</p>'
        : '<p>No one needed a pass — everyone with an email is already stamped.</p>') +
      '<hr>' + passBody
  });
  Logger.log('Sent ' + sent + ' pass emails; summary to ' + NOTIFY);
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
    cols.forEach(function (c, i) { obj[c] = cellText_(row[i]); });
    return obj;
  });
}

// A time typed straight into a cell ("8:00") becomes a Date on the epoch date
// 1899-12-30, which JSON-serializes as ISO gibberish on passes. Render it back
// to "8AM" / "1:30PM"; real datetimes (e.g. pass_sent stamps) keep localStamp_.
function cellText_(v) {
  if (!(v instanceof Date)) return v;
  // getValues() returns cell times in the script's timezone; the spreadsheet
  // timezone getter can return non-string in web-app calls and then
  // formatDate throws for every lookup.
  var tz = Session.getScriptTimeZone();
  if (typeof tz !== 'string' || !tz) tz = 'GMT';
  if (v.getFullYear() < 1970) {
    return Utilities.formatDate(v, tz, 'h:mma').replace(':00', '');
  }
  return localStamp_(v);
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

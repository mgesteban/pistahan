# Pistahan 33 — Volunteer check-in system

**Build brief for Claude Code**

Event: 33rd Annual Pistahan Parade, Saturday August 8, 2026, Market Street, San Francisco
Scale: ~300 volunteers, 30-minute check-in window, 3 scanning stations + 1 help desk
Brief written: July 26, 2026 — **13 days to event**

---

## 1. What we're building

Three deliverables:

| # | Thing | Who uses it | Where it runs |
|---|-------|-------------|---------------|
| 1 | **Pass page** — one static page per volunteer with their QR code and assignment | Volunteers, on their phone | Cloudflare Pages |
| 2 | **Scanner app** — offline-first PWA that scans, looks up, and logs check-ins | 3 station leads + help desk | Cloudflare Pages |
| 3 | **Backend** — Google Apps Script bound to the existing volunteer Sheet | Nobody directly | script.google.com |

The Google Sheet stays the source of truth. Nothing else gets introduced as a database.

---

## 2. Core design decisions (do not deviate without discussing)

### 2.1 The QR code contains only a token

Each QR encodes a single short string: `PST-4K7Q` — a 4-character random suffix drawn from an unambiguous alphabet (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — no `0/O`, no `1/I/L`).

Why this matters:

- **Scan speed.** A 8-character payload produces a QR "version 1" — large modules, decodes in well under a second from a dim, smudged, sun-washed phone screen. Encoding name + email + shirt + post + shift pushes you to version 6–7, where module size shrinks by more than half and decode reliability falls off a cliff outdoors. At 18 seconds per volunteer you cannot afford a re-scan.
- **Late edits.** Assignments will change the night before. With a token, you edit one Sheet cell. With embedded data, you'd reissue and resend.
- **Privacy.** A screenshotted badge leaks nothing.
- **Simplicity.** The scanner does a dictionary lookup, not a parse.

The token is also printed in plain text under the QR on the pass page, so it can be typed manually if the camera fails.

### 2.2 Offline-first, always

Downtown SF on a parade morning means degraded cell service — not "off", but "8-second requests that sometimes fail." **No user-facing action may ever wait on the network.**

- The full roster (~300 rows, ~60 KB JSON) is cached in IndexedDB before the event.
- A service worker caches the app shell so it boots with no connectivity.
- A scan does a local lookup and renders instantly.
- The check-in is written to a local outbox queue, then flushed by a background loop that retries indefinitely.
- The UI shows sync state (`Offline · 4 queued`) but never blocks on it.

**Test this properly: put the phone in airplane mode and do 20 check-ins.** If anything spins, it's a bug.

### 2.3 Append-only writes

The `CheckIns` tab is append-only. Nothing is ever updated in place. This gives us:

- No write contention between the 3 stations (appends can't collide; in-place cell updates can and will).
- Idempotency — a duplicate scan appends a second row and the dedupe happens at read time via `COUNTIF`.
- A free audit trail with timestamps, station, and operator.

---

## 3. Data model — Google Sheet

### Tab: `Roster` (read-only during the event)

| Column | Type | Notes |
|---|---|---|
| `token` | text | `PST-4K7Q`. Generated once, never changes. Primary key. |
| `first_name` | text | |
| `last_name` | text | Used for station lane assignment (A–F / G–P / Q–Z) |
| `email` | text | |
| `phone` | text | E.164 format for Twilio: `+14155550123` |
| `shirt_size` | text | XS/S/M/L/XL/2XL |
| `team` | text | e.g. "Parade marshals", "Route safety" |
| `post` | text | e.g. "Post 4 — 2nd & Market" |
| `shift_start` | text | `9:30 AM` |
| `shift_end` | text | `12:30 PM` |
| `notes` | text | Shown on the scan card — languages spoken, minor status, accessibility |
| `is_minor` | bool | Drives a visible flag on the scan card |
| `pass_sent_email` | timestamp | Written by the distribution script |
| `pass_sent_sms` | timestamp | Written by the distribution script |

### Tab: `CheckIns` (append-only log)

| Column | Notes |
|---|---|
| `scan_id` | Client-generated UUID. **Used for server-side dedupe.** |
| `timestamp_client` | ISO 8601, from the device |
| `timestamp_server` | ISO 8601, set on write |
| `token` | FK to Roster |
| `station` | `S1` / `S2` / `S3` / `HELP` |
| `method` | `qr` / `search` / `manual` / `walkup` |
| `operator` | Free text, set once per device at station setup |

### Tab: `Dashboard` (formulas only)

- Per-volunteer `checked_in` via `COUNTIF(CheckIns!D:D, Roster!A2) > 0`
- Total checked in, percentage, count by team, count by station
- A filtered "still missing" list — this is the sheet you'll actually stare at at 10:15am

### Tab: `Walkups`

Appended by the help desk for people not on the roster. Same columns as Roster plus `added_by` and `added_at`.

---

## 4. Backend — Google Apps Script

Bound to the Sheet (Extensions → Apps Script). Deployed as a Web App.

### Deployment settings

- Execute as: **Me**
- Who has access: **Anyone**
- Auth is a shared secret passed as `key` — not Google auth. Users must not need to sign in.

### CORS gotcha — read this before writing fetch calls

Apps Script's response handling breaks browser CORS in the usual configuration. The reliable pattern:

- `POST` with `Content-Type: text/plain;charset=utf-8` and a JSON **string** body. This is a "simple request" and skips the CORS preflight entirely. Do **not** use `application/json` — it triggers a preflight that Apps Script cannot answer.
- Parse server-side with `JSON.parse(e.postData.contents)`.
- `GET` works with query params.
- Apps Script redirects to `googleusercontent.com`; `fetch` follows this by default. Do not set `redirect: 'manual'`.

### Endpoints

**`GET ?key=SECRET&action=roster`**

Returns the full roster plus a version stamp:

```json
{
  "version": "2026-08-07T22:14:03Z",
  "volunteers": [
    { "token":"PST-4K7Q", "first_name":"Maria", "last_name":"Santos",
      "shirt_size":"L", "team":"Parade marshals", "post":"Post 4 — 2nd & Market",
      "shift_start":"9:30 AM", "shift_end":"12:30 PM",
      "notes":"Spanish + Tagalog", "is_minor": false }
  ]
}
```

Omit `email` and `phone` from this payload — the scanner doesn't need them and they'd be sitting in browser storage on borrowed phones.

**`POST` body: `{ key, action: "checkin", scans: [...] }`**

Accepts a **batch**. The client flushes its whole outbox in one request.

```json
{ "key":"SECRET", "action":"checkin",
  "scans":[
    { "scan_id":"a3f1-...", "token":"PST-4K7Q", "timestamp_client":"2026-08-08T09:47:12Z",
      "station":"S2", "method":"qr", "operator":"Ray" }
  ] }
```

Returns `{ "accepted": ["a3f1-...", ...], "duplicates": [...] }`. The client removes accepted **and** duplicate IDs from its outbox.

### Server implementation requirements

- **Dedupe on `scan_id`.** Build a Set of existing scan_ids and skip matches. This is what makes offline retries safe — without it, a flaky flush that succeeds server-side but fails client-side will double-log.
- **Use `LockService.getScriptLock()`** around the write, with a 30-second timeout. Cheap insurance against 3 stations flushing simultaneously.
- **Batch the write.** One `getRange(startRow, 1, rows.length, numCols).setValues(rows)` call, never `appendRow()` in a loop — the loop is ~50× slower and will time out.
- Wrap everything in try/catch and return JSON errors; never let Apps Script return its HTML error page, which the client can't parse.

### Quotas — verify these fit

- URL Fetch calls: 20,000/day. Non-issue.
- Script runtime: 6 min/execution. Non-issue at this batch size.
- **Email: 100 recipients/day on consumer Gmail, 1,500/day on Workspace.** See §7.

---

## 5. Scanner app

### Stack

- Vite + React + TypeScript
- `qr-scanner` (Nimiq) as the primary decoder — small, WebWorker-based, fast. Feature-detect native `BarcodeDetector` and prefer it when present (Chrome/Android), but **do not rely on it** — Safari support is unreliable and half your stations will be iPhones.
- `idb-keyval` for IndexedDB. Don't hand-roll IDB.
- `vite-plugin-pwa` for the service worker.
- No UI framework needed. Hand-rolled CSS is fine and faster.

### Deployment

Cloudflare Pages or Netlify. **HTTPS is mandatory** — `getUserMedia` is blocked on plain HTTP, so you cannot test the camera by opening `index.html` from disk. Deploy early and test on the real URL from day one.

### Camera gotchas that will otherwise cost you an afternoon

- Request `{ video: { facingMode: { ideal: 'environment' } } }`.
- The `<video>` element **must** have `playsinline` and `muted` attributes or iOS Safari refuses to play inline and hijacks fullscreen.
- Call `getUserMedia` from a user gesture (a "Start scanning" button), not on mount. iOS blocks it otherwise.
- Request a screen wake lock — `navigator.wakeLock.request('screen')` — or the phone sleeps every 30 seconds mid-shift. Re-acquire on `visibilitychange`.
- Expose a torch toggle if `track.getCapabilities().torch` is available. Yerba Buena's shade plus a dim phone screen is a real failure mode.
- Debounce repeat decodes of the same token within ~3 seconds so one held-up phone doesn't fire twenty scans.

### Screens

**Setup (once per device, persisted to localStorage)**
PIN gate → pick station (`S1`/`S2`/`S3`/`HELP`) → enter operator name → "Download roster" with an explicit success state showing volunteer count and roster version.

**Scan (primary)**
Live viewfinder. On decode: local lookup, render the result card immediately, play a short success tone (people will be looking at faces, not screens).

Result card visual hierarchy, in order of size:
1. **Shirt size** — largest element, legible at arm's length by the person working the shirt table
2. **Name**
3. **Post** — the thing you'll point at
4. Team and shift time
5. Notes / minor flag, if present

States to build: `on roster`, `already checked in at HH:MM` (warning, still allow re-check-in), `token not found` (route to help desk).

**Search fallback**
Fuzzy match on last name. Every result row has a one-tap "check in" so a dead phone costs about 10 seconds, not a conversation.

**Walk-up**
Minimal form — name, phone, shirt size, assigned post. Writes to the `Walkups` tab. Help desk only.

**Status bar (always visible)**
Live count `126 / 300`, progress bar, online/offline pill with queue depth, and a manual "sync now" button.

---

## 6. Pass page — single self-service lookup

**One URL for all 300 volunteers:** `/pass`

This is a deliberate change from per-volunteer unique URLs. Distribution is manual (no SMS API, no bulk mail service), so every message must be identical — otherwise sending becomes 300 individual copy-paste operations. A single lookup URL means one text, one email body, one social post, reused verbatim for everyone.

### Flow

1. Volunteer opens `/pass`
2. Enters the email address they signed up with (alternate: last name + last 4 digits of phone)
3. Page calls `GET ?key=SECRET&action=lookup&email=...`
4. Server returns that **one** record — never the full roster
5. Page renders the QR client-side with the `qrcode` npm package and caches the record in `localStorage`
6. Repeat visits render instantly from cache with **zero connectivity**

### Page contents

- The QR code, large and high-contrast
- Name, token in large monospace text (the manual-entry fallback)
- Shirt size, team, post, shift times
- Where to go and when, with a map link
- **"Screenshot this page"** as the most prominent instruction on the screen — this one line saves more event-day time than any code in this project
- "Add to home screen" hint as a secondary option

### Lookup endpoint requirements

- Match email case-insensitively and trim whitespace
- Return exactly one record; on no match, return a friendly "not found — see the help desk on Saturday" rather than an error
- Rate-limit crudely (e.g. reject after N lookups per minute) to discourage enumeration
- Exposure if abused is low — shirt size and post assignment — but don't return phone numbers or emails in the response

Keep it to one screen, high contrast, large QR. Volunteers will view this at 6am with one hand while holding coffee.

---

## 7. Distribution pipeline

A separate Apps Script function, run manually from the editor.

### Token generation

One-time: iterate the roster, generate a random unused token per row, write it back. Guard against re-running over existing tokens.

**Zero budget. No paid services anywhere in this project.** Apps Script, Cloudflare Pages, and the build tooling are all free tiers.

Because the pass URL is now identical for everyone (§6), the message body is the same for every volunteer. Nothing needs personalizing, so nothing needs to be done 300 separate times.

### Email

`MailApp.sendEmail()` with an HTML body linking to `/pass`. Keep the QR out of the email body — clients block remote images and render inline attachments inconsistently.

**Quota:** consumer `@gmail.com` is capped at **100 recipients/day**; Workspace gets 1,500. Verify which one `pistahansf@gmail.com` is before building the send logic. Three free ways to handle 300:

1. **Batch over three days**, starting Aug 3. The script tracks `pass_sent_email` and skips already-sent rows, so it's just "run it again tomorrow." Simplest option.
2. **Recruit two co-organizers.** The quota is per account, so three people each running the send against a slice of the roster clears all 300 in one day. Each copies the script into a standalone Apps Script project using `SpreadsheetApp.openById()` against the shared Sheet.
3. **Free email service tier.** Brevo's free plan allows 300 sends/day — exactly the roster size — and adds open tracking so you know who to chase.

### SMS — relay through team leads

Do not attempt 300 individual texts. Instead:

- Text the ~15 team leads one message containing the `/pass` link and a short relay script
- Each lead forwards it to their own team

This is free, distributes the labor across people who already have those relationships, and gets substantially better open rates than a text from an unfamiliar organizing number. Your effort drops from 300 messages to about 15.

Supplement with a post to the volunteer Facebook group and an Instagram story — same link, no extra work.

### Reminder send

Friday Aug 7 evening. If the email quota is already spent, the team-lead relay plus a social post covers it at zero cost.

### Distribution does not need to be perfect

The scanner's name-search fallback (§5) handles a volunteer with no pass in about 10 seconds. **70% QR adoption is completely fine.** Do not spend hours optimizing delivery. What protects the 30-minute window is the separate help desk, not universal QR coverage.

---

## 8. Event-day runbook

### Physical setup

- 3 scanning lanes, split by last name with **large printed signs**: A–F, G–P, Q–Z. Roughly equal thirds; check the actual distribution in the Sheet and adjust the letter breaks.
- **1 help desk, physically separate from the lanes.** This handles dead phones, not-on-the-list, questions, and anything that takes more than 20 seconds. Pulling exceptions out of the queues is the single highest-leverage decision in the whole plan — one three-minute conversation in a lane puts that lane ten people behind and it never recovers.
- Shirt table **downstream** of the scanners, pre-bagged by size. The scanner points, a separate volunteer hands over the bag. Never let the scanning person also handle inventory.

### Device checklist

- Every device at 100% charge, with a power bank
- Roster downloaded and verified (check the version stamp) **the night before**
- Airplane-mode test on each device the night before
- One spare charged phone with the app already set up
- Printed paper roster, sorted by last name, as the true last resort

### Timeline

| Time | What |
|---|---|
| Aug 7, evening | Reminder send. Devices charged, rosters synced, airplane-mode test. |
| 8:15 am | Staff arrive, set up signage and tables |
| 8:30 am | All devices online, roster re-synced, test scan of a known token |
| 9:00 am | Check-in opens |
| 9:30 am | Peak — expect ~60% of arrivals in a 15-minute crush |
| 10:00 am | Pull the "still missing" list from the Dashboard tab and start calling |
| ~11:00 am | Parade steps off |

### If something breaks

- **Camera won't start** → use manual token entry; the token is printed on every pass
- **App won't load** → another device is already synced; ferry people to it
- **Backend down** → irrelevant during the event. Everything queues locally and flushes later. Do not let anyone "fix" this mid-rush.
- **Total tech failure** → paper roster, highlighter, reconcile after

---

## 9. Build order

Sequenced so the riskiest, longest-lead items go first.

**Day 1 (today, Jul 26)**
- Confirm whether the sending Gmail account is consumer or Workspace
- Decide the email path: 3-day batch, co-organizer accounts, or Brevo free tier
- Set up the Sheet tabs and columns per §3
- Scaffold the Vite PWA, deploy a hello-world to Cloudflare Pages over HTTPS

**Days 2–3**
- Apps Script: `GET roster` + `POST checkin` with scan_id dedupe and LockService
- Scanner app: roster download and IndexedDB cache
- Camera + decode working end to end on a real phone at the real URL

**Days 4–5**
- Outbox queue, background flush, retry logic
- **Airplane-mode test — 20 check-ins with no connectivity**
- Result card UI, duplicate handling, search fallback

**Days 6–7**
- Token generation
- `/pass` lookup page + the `action=lookup` endpoint
- Email send function with resume-from-`pass_sent_email` logic
- Dashboard tab formulas

**Day 8 (Aug 3)**
- **First email batch goes out** (start here if you're on the 100/day consumer quota)
- Send the relay message to team leads; post the link to the volunteer Facebook group
- Walk-up flow, help desk screens

**Days 9–10**
- Polish, error states, sound feedback, wake lock
- Second email batch

**Day 11 (Aug 5) — dress rehearsal**
- 3 devices, 30 fake volunteers, run the whole flow with the phones in airplane mode
- Time yourselves. If you're over 18 seconds per person, cut steps until you're not.

**Days 12–13**
- Fixes from the rehearsal. Reminder send. Charge everything.

---

## 10. Non-negotiables checklist

- [ ] QR contains only the token, nothing else
- [ ] Every user action works with the network fully off
- [ ] `scan_id` dedupe on the server, so retries are safe
- [ ] Append-only `CheckIns`; nothing updated in place
- [ ] `Content-Type: text/plain` on POSTs to Apps Script
- [ ] HTTPS deployment (camera won't work otherwise)
- [ ] `playsinline` + `muted` on the video element
- [ ] Screen wake lock acquired and re-acquired
- [ ] Shirt size is the largest thing on the result card
- [ ] Help desk is physically separate from the scanning lanes
- [ ] "Screenshot this page" prominent on the pass
- [ ] One identical pass URL for all volunteers — nothing personalized in outgoing messages
- [ ] Lookup returns one record only, never the full roster
- [ ] Pass page renders from `localStorage` cache on repeat visits, offline
- [ ] Paper roster printed and on site

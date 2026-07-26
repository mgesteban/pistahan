# Pistahan 33 — Volunteer Check-In

Offline-first volunteer check-in for the 33rd Annual Pistahan Parade & Festival
(Aug 8–9, 2026, San Francisco). Full spec: [pistahan-checkin-build-brief.md](pistahan-checkin-build-brief.md).

Three pieces:

1. **`/pass`** — self-service volunteer pass: email lookup → QR code + assignment, cached in `localStorage`.
2. **`/`** — station scanner PWA: QR scan → local roster lookup → offline outbox → background sync.
3. **`apps-script/Code.gs`** — backend bound to the volunteer Google Sheet (roster, check-in, lookup, token generation, email send).

## Deltas from the original brief

- **Vercel** instead of Cloudflare Pages (`vercel.json` handles SPA rewrites).
- **Two-day event in the real data** — roster carries a `days` field (`SAT`, `SUN`, `SAT|SUN`, …); check-in works both days.
- **One token per person, multiple assignments** — 55 of 193 volunteers hold more than one role; an `assignments` column carries all of them.
- **Two API keys** — `LOOKUP_KEY` ships in the public pass page (one-record lookup only); `SCANNER_KEY` is typed in at station setup and never appears in any bundle.
- **Consumer Gmail confirmed** → email goes out in daily batches of ~95 starting Aug 3 (`sendPassEmails` resumes automatically via the `pass_sent_email` stamp).

## PII rule

The real roster (`*.xlsx`), converted CSVs (`out/`), and the orientation PDF are
**gitignored and must never be committed**. The Google Sheet is the source of truth.

## Local dev

```bash
npm install
npm run dev
```

Camera APIs need HTTPS — test scanning on the deployed Vercel URL from a real
phone, not on localhost from disk.

## Roster conversion

```bash
python3 scripts/convert_roster.py "Pistahan 33 Volunteer Roster.xlsx"
# -> out/roster_clean.csv    (paste into the Roster tab of the Google Sheet — tokens included)
# -> out/issues.csv          (rows needing human review, with reasons)
# -> out/roster_scanner.json (import into the scanner app at device setup)
# -> out/tokens_issued.json  (persistent token cache — re-runs never change an issued token)
```

Tokens are issued here, stably: re-running after roster edits keeps every
existing person's token and only mints tokens for new people. After the CSV is
imported to the Sheet, `generateTokens()` in Apps Script only fills blanks.

## Demo / offline path (no backend needed)

On the scanner Setup screen choose **Import roster file** and pick
`out/roster_scanner.json` (AirDrop/Drive it to the phone). The device then has
the full real roster locally. In the **Search** tab, "Pass" shows any
volunteer's QR on screen — scan it from another device to demo the full flow.
Check-ins queue locally and sync whenever a backend URL + scanner key are
configured.

## Vercel environment variables (for the /pass page)

Set after the Apps Script web app is deployed, then redeploy:

- `VITE_API_URL` — the Apps Script `/exec` URL
- `VITE_LOOKUP_KEY` — the low-privilege lookup key (safe to ship in the bundle)

## Backend setup (once)

1. Create the Google Sheet with tabs `Roster`, `CheckIns`, `Walkups`, `Dashboard`
   (columns per the brief §3, plus `days` and `assignments` on Roster).
2. Extensions → Apps Script → paste `apps-script/Code.gs`.
3. Project Settings → Script Properties: set `SCANNER_KEY` and `LOOKUP_KEY`
   (long random strings — `openssl rand -hex 16`).
4. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone**.
5. Run `generateTokens()` once from the editor.

## Deploy

Push to `main` → Vercel builds and deploys (framework preset: Vite).

## License

MIT — see [LICENSE](LICENSE). Built for the [Filipino American Arts
Exposition](https://www.pistahan.net/)'s Pistahan Parade & Festival; fork it
for your own event. No volunteer data lives in this repo — the roster stays in
a private Google Sheet, and API keys live in Script Properties and env vars.

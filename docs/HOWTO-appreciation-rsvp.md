# Appreciation Night RSVP — wiring the Google Form backend

The RSVP page at **pistahan.app/volunteer-appreciation** (aliases: /appreciation, /rsvp) is LIVE and wired to the "Volunteer Appreciation" Google Form
(created 2026-08-15, form ID + entry IDs are in src/pages/Rsvp.tsx). This
doc records how the wiring works in case the form must be recreated.
Responses land in a Google Sheet you own — no Apps Script, no
redeploys beyond a git push.

## 1. Create the form (~3 minutes)

Go to [forms.google.com](https://forms.google.com) **in the Google account
where you want the responses**, create a blank form titled
*Pistahan 33 — Volunteer Appreciation Night RSVP*, and add these questions
**in this order**. Choice texts must match character-for-character
(copy-paste them), or that answer silently drops out of responses.

| # | Question | Type | Choices |
|---|----------|------|---------|
| 1 | Full name | Short answer | — |
| 2 | Email | Short answer | — |
| 3 | Phone | Short answer | — |
| 4 | Will you join us? | Multiple choice | `Yes, I will be there` / `Sorry I can't make it` |
| 5 | Bringing someone? | Multiple choice | `Just me` / `+ 1` / `+ 2` |
| 6 | Dietary restrictions or allergies | Short answer | — |
| 7 | A note, memory, or shout-out | Paragraph | — |

Leave every question **not required** — the page does its own validation,
and a "required" mismatch would make Google reject the whole submission.

In **Settings → Responses**: turn **off** "Limit to 1 response" and set
"Collect email addresses" to **Do not collect** (both would force a Google
sign-in, which many volunteers won't have on their phone browser).

In the **Responses** tab, click the Sheets icon to link a response
spreadsheet.

## 2. Grab the IDs

- **Form ID**: open the form's *Send → link* (or Preview). The URL looks
  like `https://docs.google.com/forms/d/e/1FAIpQL…/viewform` — the long
  token between `/d/e/` and `/viewform` is the form ID.
- **Entry IDs**: in the form editor, ⋮ menu → **Get pre-filled link**.
  Type a recognizable value into every field (e.g. `NAME`, `EMAIL`, …),
  click *Get link → Copy link*. The copied URL contains one
  `entry.NNNNNNNNN=VALUE` pair per question — match them up by the values
  you typed.

## 3. Wire them in

Paste the form ID and the seven `entry.*` IDs into the constants at the top
of `src/pages/Rsvp.tsx` (`FORM_ID` and `ENTRY`), commit, push to `main`.
Vercel deploys it; the form goes live at **pistahan.app/volunteer-appreciation**.
(Or just send the pre-filled link + form URL to Claude and ask it to wire
them in.)

## 4. Sanity-check

Submit one RSVP from your phone and confirm the row appears in the linked
response Sheet. Then email volunteers the link.

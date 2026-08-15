import { useState } from 'react'

// Backend is a plain Google Form: responses land in a Sheet Grace owns, no
// Apps Script involved. Create the form per docs/HOWTO-appreciation-rsvp.md,
// then paste the form ID and entry.* field IDs below. Until FORM_ID is set,
// the page shows a "not open yet" notice instead of the form.
const FORM_ID = ''
const ENTRY = {
  name: '', // e.g. 'entry.123456789'
  email: '',
  phone: '',
  attending: '',
  guests: '',
  dietary: '',
  note: '',
}

// Answer strings must match the Google Form's choices character-for-character
// or the response is dropped from that question.
const ATTEND_YES = "Yes, I'll be there!"
const ATTEND_NO = "Sorry, I can't make it"
const GUEST_CHOICES = ['Just me', '+1', '+2']

const EVENT = {
  date: 'Thursday, September 10',
  time: '6–9 PM',
  venue: 'Fort McKinley Restaurant',
  address: '101 Brentwood Dr, South San Francisco, CA 94080',
  rsvpBy: 'September 3',
}
const MAPS_URL =
  'https://maps.google.com/?q=' +
  encodeURIComponent(`${EVENT.venue}, ${EVENT.address}`)
const CALENDAR_URL =
  'https://calendar.google.com/calendar/render?action=TEMPLATE' +
  '&text=' + encodeURIComponent('Pistahan 33 Volunteer Appreciation Night') +
  '&dates=20260910T180000/20260910T210000&ctz=America/Los_Angeles' +
  '&location=' + encodeURIComponent(`${EVENT.venue}, ${EVENT.address}`) +
  '&details=' + encodeURIComponent('Dinner, thank-yous, and volunteer awards!')

const CACHE_KEY = 'p33-rsvp'

export default function Rsvp() {
  const [done, setDone] = useState<string | null>(() =>
    localStorage.getItem(CACHE_KEY)
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [attending, setAttending] = useState(ATTEND_YES)
  const [guests, setGuests] = useState(GUEST_CHOICES[0])
  const [dietary, setDietary] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const coming = attending === ATTEND_YES

  async function submit() {
    setBusy(true)
    setMessage('')
    const body = new URLSearchParams()
    body.set(ENTRY.name, name.trim())
    body.set(ENTRY.email, email.trim())
    if (phone.trim()) body.set(ENTRY.phone, phone.trim())
    body.set(ENTRY.attending, attending)
    if (coming) {
      body.set(ENTRY.guests, guests)
      if (dietary.trim()) body.set(ENTRY.dietary, dietary.trim())
    }
    if (note.trim()) body.set(ENTRY.note, note.trim())
    try {
      // no-cors: Google Forms accepts the POST but the response is opaque,
      // so only network-level failures are catchable.
      await fetch(`https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      localStorage.setItem(CACHE_KEY, attending)
      setDone(attending)
    } catch {
      setMessage(
        navigator.onLine
          ? 'Could not reach the RSVP server — please try again in a moment.'
          : 'You appear to be offline — try again with a connection.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <main className="shell pass-shell">
        <header className="statusbar">
          <span className="brand">Pistahan 33 · Appreciation Night</span>
        </header>
        <section className="card">
          {done === ATTEND_YES ? (
            <>
              <h1>Salamat — see you there! 🎉</h1>
              <p>
                You're on the list for {EVENT.date}, {EVENT.time} at{' '}
                {EVENT.venue}. We can't wait to celebrate you.
              </p>
              <a
                className="btn btn-primary btn-big"
                href={CALENDAR_URL}
                target="_blank"
                rel="noreferrer"
              >
                Add to Google Calendar
              </a>
              <a className="btn-link" href={MAPS_URL} target="_blank" rel="noreferrer">
                {EVENT.venue}, {EVENT.address} →
              </a>
            </>
          ) : (
            <>
              <h1>We'll miss you 💛</h1>
              <p>
                Thanks for letting us know — and thank you for everything you
                gave Pistahan 33. You made the festival happen.
              </p>
            </>
          )}
          <button
            className="btn-link"
            onClick={() => {
              localStorage.removeItem(CACHE_KEY)
              setDone(null)
            }}
          >
            Change my RSVP
          </button>
        </section>
        <a className="btn-link" href="/help#volunteers">
          Volunteer help guide →
        </a>
        <footer className="credit">
          Developed with ❤️ by{' '}
          <a href="https://www.mgesteban.com" target="_blank" rel="noreferrer">
            www.mgesteban.com
          </a>
        </footer>
      </main>
    )
  }

  const canSubmit =
    name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email.trim())

  return (
    <main className="shell pass-shell">
      <header className="statusbar">
        <span className="brand">Pistahan 33 · Appreciation Night</span>
      </header>
      <section className="card">
        <h1>Volunteer Appreciation Night 🏆</h1>
        <p>
          You made Pistahan 33 happen — now let us feed you. Join us for an
          evening of thanks, good food, and special awards honoring our
          exceptional volunteers.
        </p>
        <p>
          <strong className="rsvp-when">
            {EVENT.date} · {EVENT.time}
          </strong>
          <br />
          <a href={MAPS_URL} target="_blank" rel="noreferrer" className="rsvp-venue">
            {EVENT.venue}
            <br />
            {EVENT.address}
          </a>
        </p>
        <p>Please RSVP by {EVENT.rsvpBy} so we can give the restaurant a headcount.</p>
      </section>

      <section className="card">
        {!FORM_ID ? (
          <p>RSVPs aren't open quite yet — check back soon.</p>
        ) : (
          <>
            <label className="rsvp-label">
              Full name
              <input
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="rsvp-label">
              Email
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="rsvp-label">
              Phone <span className="rsvp-optional">(optional)</span>
              <input
                className="input"
                type="tel"
                placeholder="For day-of updates"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>

            <div className="rsvp-label">Will you join us?</div>
            <div className="rsvp-choices">
              {[ATTEND_YES, ATTEND_NO].map((opt) => (
                <button
                  key={opt}
                  className={`btn rsvp-choice ${attending === opt ? 'rsvp-choice-on' : ''}`}
                  onClick={() => setAttending(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>

            {coming && (
              <>
                <div className="rsvp-label">Bringing anyone?</div>
                <div className="rsvp-choices">
                  {GUEST_CHOICES.map((opt) => (
                    <button
                      key={opt}
                      className={`btn rsvp-choice ${guests === opt ? 'rsvp-choice-on' : ''}`}
                      onClick={() => setGuests(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <label className="rsvp-label">
                  Dietary restrictions or allergies{' '}
                  <span className="rsvp-optional">(optional)</span>
                  <input
                    className="input"
                    placeholder="Vegetarian, shellfish allergy…"
                    value={dietary}
                    onChange={(e) => setDietary(e.target.value)}
                  />
                </label>
              </>
            )}

            <label className="rsvp-label">
              A note, memory, or shout-out{' '}
              <span className="rsvp-optional">(optional)</span>
              <textarea
                className="input rsvp-note"
                placeholder="Favorite festival moment? A volunteer who deserves a shout-out?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <button
              className="btn btn-primary btn-big"
              disabled={!canSubmit || busy}
              onClick={() => void submit()}
            >
              {busy ? 'Sending…' : 'Send my RSVP'}
            </button>
            {message && <div className="error">{message}</div>}
          </>
        )}
      </section>
      <a className="btn-link" href="/help#volunteers">
        Volunteer help guide →
      </a>
      <footer className="credit">
        Developed with ❤️ by{' '}
        <a href="https://www.mgesteban.com" target="_blank" rel="noreferrer">
          www.mgesteban.com
        </a>
      </footer>
    </main>
  )
}

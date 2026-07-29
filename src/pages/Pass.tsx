import { useState } from 'react'
import PassCard from '../components/PassCard'
import { apiLookup } from '../lib/api'
import type { Volunteer } from '../lib/types'

const CACHE_KEY = 'p33-pass'
const API_URL = import.meta.env.VITE_API_URL ?? ''
const LOOKUP_KEY = import.meta.env.VITE_LOOKUP_KEY ?? ''

function loadCached(): Volunteer | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Volunteer) : null
  } catch {
    return null
  }
}

export default function Pass() {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(() => loadCached())
  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone4, setPhone4] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function lookup() {
    setBusy(true)
    setMessage('')
    try {
      const params =
        mode === 'email'
          ? { email: email.trim() }
          : { last_name: lastName.trim(), phone4: phone4.trim() }
      const res = await apiLookup(API_URL, LOOKUP_KEY, params)
      if (res.found && res.volunteer) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(res.volunteer))
        setVolunteer(res.volunteer)
      } else {
        setMessage(res.message ?? 'Not found — see the help desk on event day.')
      }
    } catch (err) {
      setMessage(
        navigator.onLine
          ? `Lookup failed: ${String(err)}`
          : 'You appear to be offline — try again with a connection.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (volunteer) {
    return (
      <main className="shell pass-shell">
        <PassCard volunteer={volunteer} />
        <button
          className="btn"
          onClick={() => {
            localStorage.removeItem(CACHE_KEY)
            setVolunteer(null)
          }}
        >
          Not you? Look up again
        </button>
        <a className="btn-link" href="/help">
          How check-in works →
        </a>
        <a className="btn-link" href="/help#maps">
          Event maps (parade route, pavilion, assembly) →
        </a>
      </main>
    )
  }

  const canSubmit =
    mode === 'email'
      ? email.trim().includes('@')
      : lastName.trim().length > 1 && phone4.trim().length === 4

  return (
    <main className="shell pass-shell">
      <header className="statusbar">
        <span className="brand">Pistahan 33 · Volunteer Pass</span>
      </header>
      <section className="card">
        <h1>Get your check-in pass</h1>
        {!API_URL || !LOOKUP_KEY ? (
          <p>Pass lookup isn’t open yet — check back soon.</p>
        ) : (
          <>
            <p>Enter the email you signed up with.</p>
            {mode === 'email' ? (
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && void lookup()}
              />
            ) : (
              <>
                <input
                  className="input"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Last 4 digits of your phone"
                  inputMode="numeric"
                  maxLength={4}
                  value={phone4}
                  onChange={(e) => setPhone4(e.target.value.replace(/\D/g, ''))}
                />
              </>
            )}
            <button
              className="btn btn-primary btn-big"
              disabled={!canSubmit || busy}
              onClick={() => void lookup()}
            >
              {busy ? 'Looking up…' : 'Show my pass'}
            </button>
            <button
              className="btn-link"
              onClick={() => setMode(mode === 'email' ? 'phone' : 'email')}
            >
              {mode === 'email'
                ? 'No email? Use last name + phone instead'
                : 'Use email instead'}
            </button>
            {message && <div className="error">{message}</div>}
          </>
        )}
      </section>
      <a className="btn-link" href="/help">
        How check-in works →
      </a>
    </main>
  )
}

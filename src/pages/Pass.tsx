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
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function lookup() {
    setBusy(true)
    setMessage('')
    try {
      const res = await apiLookup(API_URL, LOOKUP_KEY, { q: query.trim() })
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
        <footer className="credit">
          Developed with ❤️ by{' '}
          <a href="https://www.mgesteban.com" target="_blank" rel="noreferrer">
            www.mgesteban.com
          </a>
        </footer>
      </main>
    )
  }

  const canSubmit = query.trim().length >= 2

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
            <p>
              Enter your last name, first name, email, or the last 4 digits
              of your phone number.
            </p>
            <input
              className="input"
              placeholder="Name, email, or phone last 4"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && void lookup()}
            />
            <button
              className="btn btn-primary btn-big"
              disabled={!canSubmit || busy}
              onClick={() => void lookup()}
            >
              {busy ? 'Looking up…' : 'Show my pass'}
            </button>
            {message && <div className="error">{message}</div>}
          </>
        )}
      </section>
      <a className="btn-link" href="/help">
        How check-in works →
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

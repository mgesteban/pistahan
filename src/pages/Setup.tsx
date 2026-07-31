import { useRef, useState } from 'react'
import { apiFetchRoster } from '../lib/api'
import { saveRoster } from '../lib/db'
import { saveSettings } from '../lib/settings'
import type { Settings, Station, Volunteer } from '../lib/types'

const STATIONS: Station[] = ['Parade', 'Festival', 'Pistahan', 'HELP']

interface Props {
  onDone: (s: Settings) => void
}

// Provisioning link support: /?api=<exec-url>&key=<scanner-key> pre-fills the
// backend fields so station phones only pick a station and tap Download.
const boot = new URLSearchParams(window.location.search)

export default function Setup({ onDone }: Props) {
  const [station, setStation] = useState<Station | null>(null)
  const [operator, setOperator] = useState('')
  const [apiUrl, setApiUrl] = useState(
    boot.get('api') ?? import.meta.env.VITE_API_URL ?? ''
  )
  const [scannerKey, setScannerKey] = useState(boot.get('key') ?? '')
  const [rosterInfo, setRosterInfo] = useState<{ count: number; version: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadFromFile(file: File) {
    setError('')
    try {
      const parsed = JSON.parse(await file.text()) as
        | Volunteer[]
        | { version?: string; volunteers: Volunteer[] }
      const volunteers = Array.isArray(parsed) ? parsed : parsed.volunteers
      const version = Array.isArray(parsed)
        ? `file ${file.name}`
        : (parsed.version ?? `file ${file.name}`)
      if (!volunteers?.length || !volunteers[0].token) {
        throw new Error('not a roster file (expected volunteers with tokens)')
      }
      await saveRoster(volunteers)
      setRosterInfo({ count: volunteers.length, version })
    } catch (err) {
      setError(`Roster file failed: ${String(err)}`)
    }
  }

  async function loadFromBackend() {
    setError('')
    setBusy(true)
    try {
      const res = await apiFetchRoster(apiUrl.trim(), scannerKey.trim())
      await saveRoster(res.volunteers)
      setRosterInfo({ count: res.count ?? res.volunteers.length, version: res.version })
    } catch (err) {
      setError(`Download failed: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const ready = station && operator.trim() && rosterInfo

  function start() {
    if (!ready || !station || !rosterInfo) return
    const settings: Settings = {
      station,
      operator: operator.trim(),
      apiUrl: apiUrl.trim(),
      scannerKey: scannerKey.trim(),
      demo: false,
      rosterVersion: rosterInfo.version,
      rosterCount: rosterInfo.count,
    }
    saveSettings(settings)
    onDone(settings)
  }

  return (
    <main className="shell setup">
      <h1 className="setup-title">Station setup</h1>

      <section className="setup-step">
        <h2>1 · Station</h2>
        <div className="station-grid">
          {STATIONS.map((s) => (
            <button
              key={s}
              className={`station-btn ${station === s ? 'selected' : ''}`}
              onClick={() => setStation(s)}
            >
              {s === 'HELP' ? 'Help desk' : s}
            </button>
          ))}
        </div>
      </section>

      <section className="setup-step">
        <h2>2 · Operator</h2>
        <input
          className="input"
          placeholder="Your name"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
        />
      </section>

      <section className="setup-step">
        <h2>3 · Roster</h2>
        {rosterInfo ? (
          <div className="roster-loaded">
            ✓ {rosterInfo.count} volunteers loaded
            <div className="roster-version">{rosterInfo.version}</div>
          </div>
        ) : (
          <>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Import roster file (.json)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void loadFromFile(f)
              }}
            />
            <div className="setup-or">or download from the backend</div>
            <input
              className="input"
              placeholder="Apps Script web app URL"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
            <input
              className="input"
              placeholder="Scanner key"
              type="password"
              value={scannerKey}
              onChange={(e) => setScannerKey(e.target.value)}
            />
            <button
              className="btn"
              disabled={!apiUrl.trim() || !scannerKey.trim() || busy}
              onClick={() => void loadFromBackend()}
            >
              {busy ? 'Downloading…' : 'Download roster'}
            </button>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </section>

      <button className="btn btn-primary btn-big" disabled={!ready} onClick={start}>
        Start
      </button>
      <p className="setup-note">
        Backend URL + key are optional when importing from a file — add them
        later from ⚙ to enable sync. New to this?{' '}
        <a href="/help#coordinators">Read the coordinator guide</a>.
      </p>
    </main>
  )
}

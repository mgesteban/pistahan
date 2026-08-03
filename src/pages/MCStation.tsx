import { useEffect, useMemo, useState } from 'react'
import { normCode, paradeOrder } from '../lib/contingents'
import { getContingents, requestPersistentStorage } from '../lib/db'
import type { Contingent, Settings } from '../lib/types'

interface Props {
  settings: Settings
  onReset: () => void
}

/** MC station: read-only, iPad-friendly. Type a cluster code (A5) as the
 *  contingent approaches the stage — get name, bio, and fun facts in big
 *  type, with prev/next to walk the parade order. Fully offline. */
export default function MCStation({ settings, onReset }: Props) {
  const [contingents, setContingents] = useState<Contingent[]>([])
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    requestPersistentStorage()
    void getContingents().then((c) => setContingents(paradeOrder(c)))
  }, [])

  // A typed code jumps straight to that contingent; partial codes match by prefix.
  const matchIndex = useMemo(() => {
    const qc = normCode(query)
    if (!qc) return -1
    const exact = contingents.findIndex((c) => normCode(c.code) === qc)
    if (exact !== -1) return exact
    return contingents.findIndex((c) => normCode(c.code).startsWith(qc))
  }, [contingents, query])

  const current = query.trim() ? matchIndex : index
  const c = current >= 0 ? contingents[current] : undefined
  const next = current >= 0 ? contingents[current + 1] : undefined

  function go(i: number) {
    setQuery('')
    setIndex(Math.max(0, Math.min(contingents.length - 1, i)))
  }

  return (
    <main className="shell mc-shell">
      <header className="statusbar">
        <div className="statusbar-row">
          <span className="brand">
            Pistahan 33 <span className="station-tag">MC</span>
          </span>
          <span className="pill pill-muted">
            {contingents.length} contingents · {settings.rosterVersion}
          </span>
          <button className="gear" onClick={onReset} aria-label="Device setup">
            ⚙
          </button>
        </div>
      </header>

      <input
        className="input input-mono mc-search"
        placeholder="Cluster code — e.g. A5"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />

      {c ? (
        <section className="mc-card">
          <div className="mc-card-top">
            <span className="mc-code">{c.code}</span>
            <span className="mc-number">#{c.number}</span>
          </div>
          <h1 className="mc-name">{c.name}</h1>
          {c.description && <p className="mc-bio">{c.description}</p>}
          {c.fun_facts && (
            <div className="mc-fun">
              <span className="mc-fun-label">Fun facts</span>
              <p>{c.fun_facts}</p>
            </div>
          )}
          {c.notes && <div className="result-notes">📌 {c.notes}</div>}
          <div className="mc-nav">
            <button className="btn" disabled={current <= 0} onClick={() => go(current - 1)}>
              ‹ Prev
            </button>
            <button
              className="btn btn-primary"
              disabled={current >= contingents.length - 1}
              onClick={() => go(current + 1)}
            >
              Next ›
            </button>
          </div>
          {next && (
            <p className="mc-upnext">
              Up next: <b>{next.code}</b> · {next.name}
            </p>
          )}
        </section>
      ) : (
        <p className="search-empty">
          {contingents.length === 0
            ? 'No contingent list loaded — tap ⚙ to set up this device.'
            : query.trim()
              ? 'No contingent with that code.'
              : 'Type a cluster code, or pick from the order below.'}
        </p>
      )}

      <ul className="search-results">
        {contingents.map((ct, i) => (
          <li key={ct.code}>
            <button
              className={`ctg-row-head ${i === current ? 'mc-row-current' : ''}`}
              onClick={() => go(i)}
            >
              <span className="ctg-code">{ct.code}</span>
              <span className="search-info">
                <b>{ct.name}</b>
                <span className="search-sub">#{ct.number}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

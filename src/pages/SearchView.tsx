import { useMemo, useState } from 'react'
import type { Volunteer } from '../lib/types'
import type { ResultState } from './Scanner'

interface Props {
  roster: Volunteer[]
  checkins: Record<string, string>
  onCheckin: (token: string) => Promise<ResultState>
  onShowPass: (v: Volunteer) => void
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function SearchView({ roster, checkins, onCheckin, onShowPass }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return roster
      .filter(
        (v) =>
          v.last_name.toLowerCase().includes(q) ||
          v.first_name.toLowerCase().includes(q) ||
          `${v.first_name} ${v.last_name}`.toLowerCase().includes(q)
      )
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
      .slice(0, 20)
  }, [roster, query])

  return (
    <div className="searchview">
      <input
        className="input"
        placeholder="Last name…"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="search-results">
        {results.map((v) => {
          const at = checkins[v.token]
          return (
            <li key={v.token} className="search-row">
              <div className="search-info">
                <b>
                  {v.last_name}, {v.first_name}
                </b>
                <span className="search-sub">
                  {v.shirt_size || '?'} · {v.post || v.team}
                  {at ? ` · ✓ ${fmtTime(at)}` : ''}
                </span>
              </div>
              <div className="search-actions">
                <button className="btn btn-small" onClick={() => onShowPass(v)}>
                  Pass
                </button>
                <button
                  className={`btn btn-small ${at ? '' : 'btn-primary'}`}
                  onClick={() => void onCheckin(v.token)}
                >
                  Check in
                </button>
              </div>
            </li>
          )
        })}
        {query.trim().length >= 2 && results.length === 0 && (
          <li className="search-empty">
            No match — check spelling, or use the walk-up form at the help desk.
          </li>
        )}
      </ul>
    </div>
  )
}

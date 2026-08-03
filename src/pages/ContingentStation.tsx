import { useEffect, useMemo, useState } from 'react'
import StatusBar from '../components/StatusBar'
import { beepOk } from '../lib/beep'
import { normCode, paradeOrder } from '../lib/contingents'
import {
  getContingentArrivals,
  getContingents,
  markContingentArrived,
  queueContingentReg,
  queueContingentScan,
  requestPersistentStorage,
} from '../lib/db'
import { flushNow, startSyncLoop, type SyncState } from '../lib/sync'
import type { Contingent, ContingentReg, Settings } from '../lib/types'

interface Props {
  settings: Settings
  onReset: () => void
}

type Tab = 'list' | 'register'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Contingent station: search the contingent roster, open full details
 *  (contact, vehicles, staging, notes), mark arrivals, register late adds. */
export default function ContingentStation({ settings, onReset }: Props) {
  const [contingents, setContingents] = useState<Contingent[]>([])
  const [arrivals, setArrivals] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<Tab>('list')
  const [query, setQuery] = useState('')
  const [openCode, setOpenCode] = useState('')
  const [sync, setSync] = useState<SyncState>({
    online: navigator.onLine,
    queued: 0,
    syncing: false,
    lastError: '',
    configured: false,
  })

  useEffect(() => {
    requestPersistentStorage()
    void getContingents().then((c) => setContingents(paradeOrder(c)))
    void getContingentArrivals().then(setArrivals)
    return startSyncLoop(settings, setSync)
  }, [settings])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contingents
    const qc = normCode(query)
    return contingents.filter(
      (c) =>
        normCode(c.code).startsWith(qc) ||
        c.name.toLowerCase().includes(q) ||
        String(c.number) === q
    )
  }, [contingents, query])

  async function markArrived(c: Contingent) {
    const nowIso = new Date().toISOString()
    // Append-only, like volunteer scans: dedupe happens server-side.
    await queueContingentScan({
      checkin_id: crypto.randomUUID(),
      code: c.code,
      timestamp_client: nowIso,
      operator: settings.operator,
    })
    if (!arrivals[c.code]) {
      await markContingentArrived(c.code, nowIso)
      setArrivals((a) => ({ ...a, [c.code]: nowIso }))
    }
    setSync((prev) => ({ ...prev, queued: prev.queued + 1 }))
    beepOk()
  }

  const arrivedCount = contingents.filter((c) => arrivals[c.code]).length

  return (
    <main className="shell">
      <StatusBar
        station={settings.station}
        checkedIn={arrivedCount}
        rosterCount={contingents.length}
        sync={sync}
        onSyncNow={() => void flushNow(settings)}
        onReset={onReset}
      />

      <nav className="tabs">
        <button className={tab === 'list' ? 'tab active' : 'tab'} onClick={() => setTab('list')}>
          Contingents
        </button>
        <button
          className={tab === 'register' ? 'tab active' : 'tab'}
          onClick={() => setTab('register')}
        >
          Register
        </button>
      </nav>

      {tab === 'list' && (
        <div className="searchview">
          <input
            className="input"
            placeholder="Cluster code, name, or number…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="search-results">
            {results.map((c) => {
              const at = arrivals[c.code]
              const open = openCode === c.code
              return (
                <li key={c.code} className="ctg-row">
                  <button
                    className="ctg-row-head"
                    onClick={() => setOpenCode(open ? '' : c.code)}
                  >
                    <span className="ctg-code">{c.code}</span>
                    <span className="search-info">
                      <b>{c.name}</b>
                      <span className="search-sub">
                        #{c.number}
                        {/* vehicles is free text ("2" or "12 motorcycles") */}
                        {c.vehicles
                          ? ` · ${/^\d+$/.test(c.vehicles.trim()) ? `${c.vehicles.trim()} vehicle(s)` : c.vehicles}`
                          : ''}
                        {at ? ` · ✓ ${fmtTime(at)}` : ''}
                      </span>
                    </span>
                    <span className="ctg-caret">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <div className="ctg-detail">
                      {c.contact_name && (
                        <div className="ctg-field">
                          <span>Contact</span>
                          <b>
                            {c.contact_name}
                            {c.contact_phone && (
                              <>
                                {' · '}
                                <a href={`tel:${c.contact_phone}`}>{c.contact_phone}</a>
                              </>
                            )}
                          </b>
                        </div>
                      )}
                      {c.participants && (
                        <div className="ctg-field">
                          <span>Participants</span>
                          <b>{c.participants}</b>
                        </div>
                      )}
                      {c.vehicles && (
                        <div className="ctg-field">
                          <span>Vehicles</span>
                          <b>{c.vehicles}</b>
                        </div>
                      )}
                      {c.staging && (
                        <div className="ctg-field ctg-field-block">
                          <span>Staging</span>
                          <p>{c.staging}</p>
                        </div>
                      )}
                      {c.notes && <div className="result-notes">📌 {c.notes}</div>}
                      <button
                        className={`btn ${at ? '' : 'btn-primary'}`}
                        onClick={() => void markArrived(c)}
                      >
                        {at ? `✓ Arrived ${fmtTime(at)} — log again` : 'Mark arrived'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
            {query.trim() && results.length === 0 && (
              <li className="search-empty">
                No match — check the code, or use the Register tab for a late add.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === 'register' && (
        <RegisterForm
          operator={settings.operator}
          onQueued={() => setSync((p) => ({ ...p, queued: p.queued + 1 }))}
        />
      )}
    </main>
  )
}

function RegisterForm({ operator, onQueued }: { operator: string; onQueued: () => void }) {
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [cluster, setCluster] = useState('')
  const [vehicles, setVehicles] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  async function submit() {
    if (!name.trim()) return
    const r: ContingentReg = {
      reg_id: crypto.randomUUID(),
      name: name.trim(),
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      cluster: cluster.trim().toUpperCase(),
      vehicles: vehicles.trim(),
      notes: notes.trim(),
      added_by: operator,
    }
    await queueContingentReg(r)
    onQueued()
    setSaved(true)
    setName('')
    setContactName('')
    setContactPhone('')
    setCluster('')
    setVehicles('')
    setNotes('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="walkupview">
      <p className="walkup-hint">
        Contingent not on the list? Register it here — it syncs to the
        ContingentRegistrations tab for the parade team to place.
      </p>
      <input className="input" placeholder="Contingent name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Primary contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
      <input className="input" placeholder="Contact phone" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      <input className="input input-mono" placeholder="Cluster assignment (e.g. A5)" value={cluster} onChange={(e) => setCluster(e.target.value)} />
      <input className="input" placeholder="Number of vehicles" inputMode="numeric" value={vehicles} onChange={(e) => setVehicles(e.target.value)} />
      <input className="input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button
        className="btn btn-primary btn-big"
        disabled={!name.trim()}
        onClick={() => void submit()}
      >
        Register contingent
      </button>
      {saved && <div className="roster-loaded">✓ Added to queue</div>}
    </div>
  )
}

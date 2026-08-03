import { useEffect, useMemo, useRef, useState } from 'react'
import PassCard from '../components/PassCard'
import StatusBar from '../components/StatusBar'
import { beepError, beepOk, beepWarn } from '../lib/beep'
import {
  getCheckins,
  getRoster,
  markCheckedIn,
  queueScan,
  requestPersistentStorage,
} from '../lib/db'
import { clearSettings, loadSettings } from '../lib/settings'
import { flushNow, startSyncLoop, type SyncState } from '../lib/sync'
import type { Settings, Volunteer } from '../lib/types'
import ContingentStation from './ContingentStation'
import MCStation from './MCStation'
import ScanView from './ScanView'
import SearchView from './SearchView'
import Setup from './Setup'
import WalkupView from './WalkupView'

export interface ResultState {
  status: 'ok' | 'already' | 'notfound'
  volunteer?: Volunteer
  token: string
  checkedInAt?: string
}

type Tab = 'scan' | 'search' | 'walkup'

export default function Scanner() {
  const [settings, setSettings] = useState<Settings | null>(() => loadSettings())
  const [roster, setRoster] = useState<Volunteer[]>([])
  const [checkins, setCheckins] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<Tab>('scan')
  const [passView, setPassView] = useState<Volunteer | null>(null)
  const [sync, setSync] = useState<SyncState>({
    online: navigator.onLine,
    queued: 0,
    syncing: false,
    lastError: '',
    configured: false,
  })
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const contingentStation = settings?.station === 'Contingent' || settings?.station === 'MC'

  useEffect(() => {
    // Contingent/MC stations manage their own data + sync loop.
    if (!settings || contingentStation) return
    requestPersistentStorage()
    void getRoster().then(setRoster)
    void getCheckins().then(setCheckins)
    return startSyncLoop(settings, setSync)
  }, [settings, contingentStation])

  const byToken = useMemo(() => {
    const m = new Map<string, Volunteer>()
    roster.forEach((v) => m.set(v.token.toUpperCase(), v))
    return m
  }, [roster])

  async function process(
    rawToken: string,
    method: 'qr' | 'search' | 'manual'
  ): Promise<ResultState> {
    const s = settingsRef.current!
    const token = rawToken.toUpperCase()
    const volunteer = byToken.get(token)
    if (!volunteer) {
      beepError()
      return { status: 'notfound', token }
    }

    const already = checkins[token]
    const nowIso = new Date().toISOString()
    // Append-only: a re-check-in just logs another row; dedupe is at read time.
    await queueScan({
      scan_id: crypto.randomUUID(),
      token,
      timestamp_client: nowIso,
      station: s.station,
      method,
      operator: s.operator,
    })
    if (!already) {
      await markCheckedIn(token, nowIso)
      setCheckins((c) => ({ ...c, [token]: nowIso }))
    }
    setSync((prev) => ({ ...prev, queued: prev.queued + 1 }))
    if (already) {
      beepWarn()
      return { status: 'already', volunteer, token, checkedInAt: already }
    }
    beepOk()
    return { status: 'ok', volunteer, token, checkedInAt: nowIso }
  }

  if (!settings) {
    return <Setup onDone={setSettings} />
  }

  const reset = () => {
    if (confirm('Reset this device? Saved data and queued check-ins stay on the device.')) {
      clearSettings()
      setSettings(null)
    }
  }

  if (settings.station === 'MC') {
    return <MCStation settings={settings} onReset={reset} />
  }
  if (settings.station === 'Contingent') {
    return <ContingentStation settings={settings} onReset={reset} />
  }

  const checkedCount = Object.keys(checkins).length

  return (
    <main className="shell">
      <StatusBar
        station={settings.station}
        checkedIn={checkedCount}
        rosterCount={roster.length}
        sync={sync}
        onSyncNow={() => void flushNow(settings)}
        onReset={reset}
      />

      <nav className="tabs">
        <button className={tab === 'scan' ? 'tab active' : 'tab'} onClick={() => setTab('scan')}>
          Scan
        </button>
        <button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => setTab('search')}>
          Search
        </button>
        {settings.station === 'HELP' && (
          <button className={tab === 'walkup' ? 'tab active' : 'tab'} onClick={() => setTab('walkup')}>
            Walk-up
          </button>
        )}
      </nav>

      {tab === 'scan' && <ScanView onToken={(t, m) => process(t, m)} />}
      {tab === 'search' && (
        <SearchView
          roster={roster}
          checkins={checkins}
          onCheckin={(t) => process(t, 'search')}
          onShowPass={setPassView}
        />
      )}
      {tab === 'walkup' && (
        <WalkupView
          operator={settings.operator}
          onQueued={() => setSync((p) => ({ ...p, queued: p.queued + 1 }))}
        />
      )}

      {passView && (
        <div className="modal" onClick={() => setPassView(null)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <PassCard volunteer={passView} />
            <button className="btn btn-big" onClick={() => setPassView(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

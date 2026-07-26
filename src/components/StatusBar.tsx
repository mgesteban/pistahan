import type { SyncState } from '../lib/sync'

interface Props {
  station: string
  checkedIn: number
  rosterCount: number
  sync: SyncState
  onSyncNow: () => void
  onReset: () => void
}

export default function StatusBar({
  station,
  checkedIn,
  rosterCount,
  sync,
  onSyncNow,
  onReset,
}: Props) {
  const pct = rosterCount ? Math.round((checkedIn / rosterCount) * 100) : 0
  const pill = !sync.configured
    ? { cls: 'pill-muted', text: 'local only' }
    : sync.online
      ? sync.queued
        ? { cls: 'pill-warn', text: `syncing · ${sync.queued} queued` }
        : { cls: 'pill-ok', text: 'online · synced' }
      : { cls: 'pill-warn', text: `offline · ${sync.queued} queued` }

  return (
    <header className="statusbar">
      <div className="statusbar-row">
        <span className="brand">
          Pistahan 33 <span className="station-tag">{station}</span>
        </span>
        <span className={`pill ${pill.cls}`} onClick={onSyncNow}>
          {sync.syncing ? 'syncing…' : pill.text}
        </span>
        <button className="gear" onClick={onReset} aria-label="Device setup">
          ⚙
        </button>
      </div>
      <div className="statusbar-row">
        <div className="progress">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="count">
          {checkedIn} / {rosterCount}
        </span>
      </div>
    </header>
  )
}

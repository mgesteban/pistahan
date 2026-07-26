import { apiCheckin, apiWalkup } from './api'
import { getOutbox, getWalkupQueue, removeScans, removeWalkups } from './db'
import type { Settings } from './types'

export interface SyncState {
  online: boolean
  queued: number
  syncing: boolean
  lastError: string
  configured: boolean
}

let flushing = false

/** Flush the outbox + walkup queue. Safe to call repeatedly; never throws. */
export async function flushNow(settings: Settings): Promise<void> {
  if (flushing) return
  if (!settings.apiUrl || !settings.scannerKey) return
  flushing = true
  try {
    const scans = await getOutbox()
    if (scans.length) {
      const res = await apiCheckin(settings.apiUrl, settings.scannerKey, scans)
      // duplicates are already on the server — clear them too
      await removeScans([...res.accepted, ...res.duplicates])
    }
    const walkups = await getWalkupQueue()
    if (walkups.length) {
      await apiWalkup(settings.apiUrl, settings.scannerKey, walkups)
      await removeWalkups(walkups.map((w) => w.walkup_id))
    }
  } finally {
    flushing = false
  }
}

export async function queueDepth(): Promise<number> {
  const [scans, walkups] = await Promise.all([getOutbox(), getWalkupQueue()])
  return scans.length + walkups.length
}

/**
 * Background flush loop: every 15s while online, plus immediately on
 * reconnect. Retries indefinitely — the UI never waits on this.
 */
export function startSyncLoop(
  settings: Settings,
  onChange: (s: SyncState) => void
): () => void {
  let stopped = false

  const report = async (syncing: boolean, lastError = '') => {
    if (stopped) return
    onChange({
      online: navigator.onLine,
      queued: await queueDepth(),
      syncing,
      lastError,
      configured: Boolean(settings.apiUrl && settings.scannerKey),
    })
  }

  const tick = async () => {
    if (stopped) return
    await report(true)
    try {
      if (navigator.onLine) await flushNow(settings)
      await report(false)
    } catch (err) {
      await report(false, String(err))
    }
  }

  const interval = setInterval(tick, 15000)
  const onOnline = () => void tick()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', () => void report(false))
  void tick()

  return () => {
    stopped = true
    clearInterval(interval)
    window.removeEventListener('online', onOnline)
  }
}

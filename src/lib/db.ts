import { get, set } from 'idb-keyval'
import type { Contingent, ContingentReg, ContingentScan, Scan, Volunteer, Walkup } from './types'

// All device state lives in IndexedDB so it survives reloads and works with
// the network fully off. Keys: roster, outbox, walkups, checkins, plus the
// contingent equivalents: contingents, ctg-outbox, ctg-regs, ctg-arrivals.

export async function saveRoster(v: Volunteer[]) {
  await set('roster', v)
}

export async function getRoster(): Promise<Volunteer[]> {
  return ((await get('roster')) as Volunteer[] | undefined) ?? []
}

export async function getOutbox(): Promise<Scan[]> {
  return ((await get('outbox')) as Scan[] | undefined) ?? []
}

export async function queueScan(s: Scan) {
  const q = await getOutbox()
  q.push(s)
  await set('outbox', q)
}

export async function removeScans(ids: string[]) {
  const drop = new Set(ids)
  const q = (await getOutbox()).filter((s) => !drop.has(s.scan_id))
  await set('outbox', q)
}

export async function getWalkupQueue(): Promise<Walkup[]> {
  return ((await get('walkups')) as Walkup[] | undefined) ?? []
}

export async function queueWalkup(w: Walkup) {
  const q = await getWalkupQueue()
  q.push(w)
  await set('walkups', q)
}

export async function removeWalkups(ids: string[]) {
  const drop = new Set(ids)
  const q = (await getWalkupQueue()).filter((w) => !drop.has(w.walkup_id))
  await set('walkups', q)
}

/** Local check-in history: token -> first check-in time ISO (this device). */
export async function getCheckins(): Promise<Record<string, string>> {
  return ((await get('checkins')) as Record<string, string> | undefined) ?? {}
}

export async function markCheckedIn(token: string, iso: string) {
  const m = await getCheckins()
  if (!m[token]) {
    m[token] = iso
    await set('checkins', m)
  }
}

export async function saveContingents(c: Contingent[]) {
  await set('contingents', c)
}

export async function getContingents(): Promise<Contingent[]> {
  return ((await get('contingents')) as Contingent[] | undefined) ?? []
}

export async function getContingentOutbox(): Promise<ContingentScan[]> {
  return ((await get('ctg-outbox')) as ContingentScan[] | undefined) ?? []
}

export async function queueContingentScan(s: ContingentScan) {
  const q = await getContingentOutbox()
  q.push(s)
  await set('ctg-outbox', q)
}

export async function removeContingentScans(ids: string[]) {
  const drop = new Set(ids)
  const q = (await getContingentOutbox()).filter((s) => !drop.has(s.checkin_id))
  await set('ctg-outbox', q)
}

export async function getContingentRegQueue(): Promise<ContingentReg[]> {
  return ((await get('ctg-regs')) as ContingentReg[] | undefined) ?? []
}

export async function queueContingentReg(r: ContingentReg) {
  const q = await getContingentRegQueue()
  q.push(r)
  await set('ctg-regs', q)
}

export async function removeContingentRegs(ids: string[]) {
  const drop = new Set(ids)
  const q = (await getContingentRegQueue()).filter((r) => !drop.has(r.reg_id))
  await set('ctg-regs', q)
}

/** Local arrival history: cluster code -> first arrival time ISO (this device). */
export async function getContingentArrivals(): Promise<Record<string, string>> {
  return ((await get('ctg-arrivals')) as Record<string, string> | undefined) ?? {}
}

export async function markContingentArrived(code: string, iso: string) {
  const m = await getContingentArrivals()
  if (!m[code]) {
    m[code] = iso
    await set('ctg-arrivals', m)
  }
}

/** Ask the browser not to evict our storage (iOS 7-day cleanup). */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {})
}

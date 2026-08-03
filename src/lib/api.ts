import type { Contingent, ContingentReg, ContingentScan, Scan, Volunteer, Walkup } from './types'

// Apps Script CORS rule: POST as text/plain (a "simple request", no preflight,
// which Apps Script cannot answer) with a JSON string body. Never application/json.

interface RosterResponse {
  version: string
  count: number
  volunteers: Volunteer[]
  error?: string
}

interface CheckinResponse {
  accepted: string[]
  duplicates: string[]
  error?: string
}

export interface LookupResult {
  found: boolean
  message?: string
  volunteer?: Volunteer
  error?: string
}

async function post<T>(apiUrl: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as T & { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

export async function apiFetchRoster(apiUrl: string, key: string): Promise<RosterResponse> {
  const res = await fetch(
    `${apiUrl}?key=${encodeURIComponent(key)}&action=roster`
  )
  const json = (await res.json()) as RosterResponse
  if (json.error) throw new Error(json.error)
  return json
}

export function apiCheckin(apiUrl: string, key: string, scans: Scan[]) {
  return post<CheckinResponse>(apiUrl, { key, action: 'checkin', scans })
}

export function apiWalkup(apiUrl: string, key: string, walkups: Walkup[]) {
  return post<{ accepted: number }>(apiUrl, { key, action: 'walkup', walkups })
}

interface ContingentsResponse {
  version: string
  count: number
  contingents: Contingent[]
  error?: string
}

export async function apiFetchContingents(
  apiUrl: string,
  key: string
): Promise<ContingentsResponse> {
  const res = await fetch(
    `${apiUrl}?key=${encodeURIComponent(key)}&action=contingents`
  )
  const json = (await res.json()) as ContingentsResponse
  if (json.error) throw new Error(json.error)
  return json
}

export function apiContingentCheckin(
  apiUrl: string,
  key: string,
  checkins: ContingentScan[]
) {
  return post<CheckinResponse>(apiUrl, { key, action: 'contingent_checkin', checkins })
}

export function apiContingentReg(apiUrl: string, key: string, regs: ContingentReg[]) {
  return post<{ accepted: number }>(apiUrl, { key, action: 'contingent_register', regs })
}

export async function apiLookup(
  apiUrl: string,
  key: string,
  params: { q?: string; email?: string; last_name?: string; phone4?: string }
): Promise<LookupResult> {
  const q = new URLSearchParams({ key, action: 'lookup', ...params })
  const res = await fetch(`${apiUrl}?${q.toString()}`)
  const json = (await res.json()) as LookupResult
  if (json.error) throw new Error(json.error)
  return json
}

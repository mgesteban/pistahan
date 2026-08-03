export interface Volunteer {
  token: string
  first_name: string
  last_name: string
  shirt_size: string
  team: string
  post: string
  days: string
  shift_start: string
  shift_end: string
  notes: string
  is_minor: boolean
  assignments: string
}

export type Station = 'Parade' | 'Festival' | 'Pistahan' | 'HELP' | 'Contingent' | 'MC'

/** A parade contingent. `code` is the cluster code (e.g. "A5" = cluster A,
 *  position 5) — the MC's lookup key and the unique id everywhere. */
export interface Contingent {
  code: string
  number: string
  name: string
  contact_name: string
  contact_phone: string
  participants: string
  vehicles: string
  staging: string
  description: string
  fun_facts: string
  notes: string
}

export interface ContingentScan {
  checkin_id: string
  code: string
  timestamp_client: string
  operator: string
}

export interface ContingentReg {
  reg_id: string
  name: string
  contact_name: string
  contact_phone: string
  cluster: string
  vehicles: string
  notes: string
  added_by: string
}

export interface Scan {
  scan_id: string
  token: string
  timestamp_client: string
  station: Station
  method: 'qr' | 'search' | 'manual'
  operator: string
}

export interface Walkup {
  walkup_id: string
  first_name: string
  last_name: string
  phone: string
  shirt_size: string
  post: string
  added_by: string
}

export interface Settings {
  station: Station
  operator: string
  apiUrl: string
  scannerKey: string
  demo: boolean
  rosterVersion: string
  rosterCount: number
}

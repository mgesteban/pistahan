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

export type Station = 'Parade' | 'Festival' | 'Pistahan' | 'HELP'

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

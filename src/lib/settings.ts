import type { Settings } from './types'

const KEY = 'p33-settings'

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Settings) : null
  } catch {
    return null
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSettings() {
  localStorage.removeItem(KEY)
}

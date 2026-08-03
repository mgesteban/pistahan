import type { Contingent } from './types'

/** "A5" / "a-12" -> ["A", 12]. Unparseable codes sort after everything. */
export function parseCode(code: string): [string, number] {
  const m = /^([A-Za-z]+)\s*-?\s*(\d+)$/.exec(String(code).trim())
  if (!m) return ['ZZZ', Number.MAX_SAFE_INTEGER]
  return [m[1].toUpperCase(), Number(m[2])]
}

export function normCode(code: string) {
  return String(code).replace(/[\s-]/g, '').toUpperCase()
}

/** Sorted copy in parade order: cluster letter, then position number. */
export function paradeOrder(list: Contingent[]): Contingent[] {
  return [...list].sort((a, b) => {
    const [ca, na] = parseCode(a.code)
    const [cb, nb] = parseCode(b.code)
    return ca === cb ? na - nb : ca.localeCompare(cb)
  })
}

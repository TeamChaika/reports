// Deterministic number formatting (thousands grouped with a regular ASCII space).
//
// IMPORTANT: do NOT use Number.toLocaleString('ru') inside Client Components that
// are server-rendered. Node (Linux ICU) and browsers (esp. iOS Safari) group
// digits with different whitespace (U+202F / U+00A0 / U+0020), so the server HTML
// and the client's first render differ → fatal hydration error in production
// (React 19 / Next 15) → "Application error: a client-side exception".
//
// This formatter produces the same string everywhere.
export function fmtNum(n: number): string {
  const rounded = Math.round(Number(n) || 0)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded).toString()
  return sign + abs.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

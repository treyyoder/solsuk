export const fmtEF = (ef: number): string => `${ef.toFixed(2)} EF`
export const fmtMW = (mw: number): string => (mw >= 1000 ? `${(mw / 1000).toFixed(2)} GW` : `${mw.toFixed(1)} MW`)
export const fmtPct = (p: number, digits = 0): string => `${p.toFixed(digits)}%`
export const fmtGbps = (g: number): string => `${g.toFixed(1)} Gb/s`
export const fmtMs = (ms: number): string => `${ms.toFixed(1)} ms`

export function fmtSimClock(t: number): string {
  const s = Math.floor(t)
  const days = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `T+${days}d ${pad(h)}:${pad(m)}:${pad(sec)}`
}

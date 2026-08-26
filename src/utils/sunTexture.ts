/** Canvas-generated solar surface texture for the wordmark's "O" letter — cached after first render. */
let cached: string | null = null

export function sunGranulationDataUrl(size = 128): string {
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // hot, saturated fire palette — not a smooth pastel blend (that reads as
  // a moon), a punchy white-hot core collapsing fast into deep red-orange.
  // Dead-centered (no artistic offset) — an off-center hotspot reads as the
  // whole sun being off-center, not just its lighting.
  const base = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.02, size * 0.5, size * 0.5, size * 0.62)
  base.addColorStop(0, '#fffdf2')
  base.addColorStop(0.14, '#ffe27a')
  base.addColorStop(0.36, '#ffa733')
  base.addColorStop(0.65, '#ff6a1a')
  base.addColorStop(1, '#b8280a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // fine granulation speckle — small and numerous, not big dark craters
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 0.6 + Math.random() * 1.6
    const bright = Math.random() < 0.55
    ctx.fillStyle = bright
      ? `rgba(255, 240, 200, ${0.12 + Math.random() * 0.2})`
      : `rgba(150, 50, 15, ${0.08 + Math.random() * 0.14})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // a couple of bright active-region flares (soft white-hot patches, not dark spots)
  for (let i = 0; i < 3; i++) {
    const x = size * (0.25 + Math.random() * 0.5)
    const y = size * (0.25 + Math.random() * 0.5)
    const r = size * (0.05 + Math.random() * 0.07)
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r)
    spot.addColorStop(0, 'rgba(255, 253, 240, 0.85)')
    spot.addColorStop(0.5, 'rgba(255, 220, 140, 0.35)')
    spot.addColorStop(1, 'rgba(255, 220, 140, 0)')
    ctx.fillStyle = spot
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  cached = canvas.toDataURL('image/png')
  return cached
}

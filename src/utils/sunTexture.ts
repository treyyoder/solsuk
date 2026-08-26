/** Canvas-generated solar granulation texture for the wordmark's "O" letter — cached after first render. */
let cached: string | null = null

export function sunGranulationDataUrl(size = 96): string {
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const base = ctx.createRadialGradient(size * 0.4, size * 0.38, size * 0.04, size * 0.5, size * 0.5, size * 0.64)
  base.addColorStop(0, '#fff2c4')
  base.addColorStop(0.4, '#ffcf6b')
  base.addColorStop(0.75, '#ff8a2e')
  base.addColorStop(1, '#a8380c')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 3
    const bright = Math.random() < 0.5
    ctx.fillStyle = bright
      ? `rgba(255, 235, 190, ${0.15 + Math.random() * 0.25})`
      : `rgba(120, 40, 10, ${0.12 + Math.random() * 0.22})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  for (let i = 0; i < 3; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = size * (0.04 + Math.random() * 0.05)
    const spot = ctx.createRadialGradient(x, y, 0, x, y, r)
    spot.addColorStop(0, 'rgba(60, 15, 5, 0.55)')
    spot.addColorStop(1, 'rgba(60, 15, 5, 0)')
    ctx.fillStyle = spot
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  cached = canvas.toDataURL('image/png')
  return cached
}

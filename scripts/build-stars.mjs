/**
 * One-time authoring script: builds the real-sky datasets.
 *  - src/data/stars.json          — bright stars (mag ≤ 5.5) from the HYG database (CC-BY-SA 4.0)
 *  - src/data/constellations.json — western constellation line figures from d3-celestial (BSD-3)
 * RA/Dec → y-up unit vectors matching the app's world frame.
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const D2R = Math.PI / 180
/** RA (deg), Dec (deg) → y-up unit vector */
const toVec = (raDeg, decDeg) => {
  const ra = raDeg * D2R
  const dec = decDeg * D2R
  return [
    +(Math.cos(dec) * Math.cos(ra)).toFixed(4),
    +Math.sin(dec).toFixed(4),
    +(-Math.cos(dec) * Math.sin(ra)).toFixed(4),
  ]
}

// ---- stars from HYG ----
const HYG_CANDIDATES = [
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv',
  'https://raw.githubusercontent.com/astronexus/HYG-Database/master/hyg/CURRENT/hygdata_v41.csv',
]
let csv = null
for (const url of HYG_CANDIDATES) {
  process.stdout.write(`trying ${url} … `)
  const res = await fetch(url)
  if (res.ok) {
    csv = await res.text()
    console.log('ok')
    break
  }
  console.log(`HTTP ${res.status}`)
}
if (!csv) {
  console.error('Could not fetch HYG data — check https://github.com/astronexus/HYG-Database for the current CSV path.')
  process.exit(1)
}

const lines = csv.split('\n')
const header = lines[0].split(',').map((s) => s.replace(/"/g, '').trim())
const col = (name) => header.indexOf(name)
const iRa = col('ra') // hours
const iDec = col('dec')
const iMag = col('mag')
const iCi = col('ci')
const stars = []
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',')
  if (parts.length < header.length - 2) continue
  const mag = parseFloat(parts[iMag])
  if (!(mag <= 5.5)) continue
  const raH = parseFloat(parts[iRa])
  const dec = parseFloat(parts[iDec])
  if (Number.isNaN(raH) || Number.isNaN(dec)) continue
  if (mag < -20) continue // the Sun is in HYG; skip it
  const ci = parseFloat(parts[iCi])
  stars.push({ p: toVec(raH * 15, dec), m: +mag.toFixed(2), c: Number.isNaN(ci) ? 0.5 : +ci.toFixed(2) })
}
stars.sort((a, b) => a.m - b.m)
await writeFile(join(root, 'src', 'data', 'stars.json'), JSON.stringify(stars))
console.log(`stars.json: ${stars.length} stars`)

// ---- constellation lines from d3-celestial ----
const LINES_URL = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json'
const NAMES_URL = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json'
const linesRes = await fetch(LINES_URL)
if (!linesRes.ok) {
  console.error(`Could not fetch ${LINES_URL} (HTTP ${linesRes.status})`)
  process.exit(1)
}
const geo = await linesRes.json()
let names = {}
try {
  const nRes = await fetch(NAMES_URL)
  if (nRes.ok) {
    const nGeo = await nRes.json()
    for (const f of nGeo.features) names[f.id] = f.properties?.name ?? f.id
  }
} catch {
  /* names optional */
}

/** subdivide a great-circle segment so lines hug the celestial sphere */
function subdivide(a, b) {
  const va = a
  const vb = b
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
  const ang = Math.acos(dot)
  const steps = Math.max(1, Math.ceil(ang / (6 * D2R)))
  const pts = []
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    // slerp
    const sinA = Math.sin(ang)
    const w1 = sinA < 1e-6 ? 1 - t : Math.sin((1 - t) * ang) / sinA
    const w2 = sinA < 1e-6 ? t : Math.sin(t * ang) / sinA
    const v = [w1 * va[0] + w2 * vb[0], w1 * va[1] + w2 * vb[1], w1 * va[2] + w2 * vb[2]]
    const len = Math.hypot(...v)
    pts.push([+(v[0] / len).toFixed(4), +(v[1] / len).toFixed(4), +(v[2] / len).toFixed(4)])
  }
  return pts
}

const constellations = []
for (const f of geo.features) {
  const segs = []
  const coords = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
  for (const line of coords) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = toVec(line[i][0], line[i][1])
      const b = toVec(line[i + 1][0], line[i + 1][1])
      const pts = subdivide(a, b)
      for (let s = 0; s + 1 < pts.length; s++) segs.push([pts[s], pts[s + 1]])
    }
  }
  // centroid for the label
  const c = [0, 0, 0]
  for (const [a] of segs) {
    c[0] += a[0]
    c[1] += a[1]
    c[2] += a[2]
  }
  const cl = Math.hypot(...c) || 1
  constellations.push({
    id: f.id,
    name: names[f.id] ?? f.id,
    center: [+(c[0] / cl).toFixed(4), +(c[1] / cl).toFixed(4), +(c[2] / cl).toFixed(4)],
    segs,
  })
}
await writeFile(join(root, 'src', 'data', 'constellations.json'), JSON.stringify(constellations))
console.log(`constellations.json: ${constellations.length} constellations, ${constellations.reduce((n, c) => n + c.segs.length, 0)} segments`)

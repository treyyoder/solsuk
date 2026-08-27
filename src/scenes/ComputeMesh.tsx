import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFleet, getFleetByClass, satData } from '../store/simStore'

/**
 * GREEN relay links: ephemeral, sampled links running from the heavy
 * OUTER-shell platforms (standard/hyper/giga) down to inner-shell
 * facilities (pioneer/cluster/edge) — results being relayed toward Earth,
 * where the inner shell's downlink beams (GroundLinks, same green) carry
 * them the last hop to a city. Each link lives a few seconds, fades in/out
 * via vertex colors (additive: black = invisible), then re-rolls elsewhere.
 *
 * The PURPLE cooperation layer lives in NeighborWeb — a true
 * nearest-neighbor web, not a sampled churn.
 */

const MAX_RELAY = 200
/** candidate partners sampled per spawn — nearest wins */
const SAMPLES = 24
const SPAWNS_PER_FRAME = 3
const FADE = 0.7
/** relay hops only form between facilities in close proximity (~20° arc) */
const RELAY_MAX_DIST = 1.8

interface Link {
  a: number
  b: number
  age: number
  life: number
}

const RELAY_RGB = [0.22, 1.0, 0.56] // #39ff8e

function makeGeo(max: number) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 6), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 6), 3))
  geo.setDrawRange(0, 0)
  return geo
}

/** a live (position already computed, not at origin) facility index, or -1 */
function alive(j: number): boolean {
  const p = satData.positions
  return Math.hypot(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]) > 3.5
}

function nearestSample(a: number, lo: number, hi: number, maxDist: number): number {
  const p = satData.positions
  const ax = p[a * 3]
  const ay = p[a * 3 + 1]
  const az = p[a * 3 + 2]
  let best = -1
  let bestD = maxDist
  const range = hi - lo
  for (let s = 0; s < SAMPLES; s++) {
    const j = lo + Math.floor(Math.random() * range)
    if (j === a || !alive(j)) continue
    const d = Math.hypot(p[j * 3] - ax, p[j * 3 + 1] - ay, p[j * 3 + 2] - az)
    if (d > 1e-4 && d < bestD) {
      bestD = d
      best = j
    }
  }
  return best
}

function updateLayer(
  links: Link[],
  geo: THREE.BufferGeometry,
  rgb: number[],
  dt: number,
  n: number,
  /** dim the a-endpoint relative to b — reads as flow a → b */
  directional: boolean,
) {
  const pos = geo.attributes.position.array as Float32Array
  const col = geo.attributes.color.array as Float32Array
  const p = satData.positions
  for (let i = links.length - 1; i >= 0; i--) {
    const L = links[i]
    L.age += dt
    if (L.age >= L.life || L.a >= n || L.b >= n) {
      links[i] = links[links.length - 1]
      links.pop()
      continue
    }
    const f = Math.min(1, L.age / FADE, (L.life - L.age) / FADE)
    pos[i * 6] = p[L.a * 3]
    pos[i * 6 + 1] = p[L.a * 3 + 1]
    pos[i * 6 + 2] = p[L.a * 3 + 2]
    pos[i * 6 + 3] = p[L.b * 3]
    pos[i * 6 + 4] = p[L.b * 3 + 1]
    pos[i * 6 + 5] = p[L.b * 3 + 2]
    const fa = directional ? f * 0.25 : f
    col[i * 6] = rgb[0] * fa
    col[i * 6 + 1] = rgb[1] * fa
    col[i * 6 + 2] = rgb[2] * fa
    col[i * 6 + 3] = rgb[0] * f
    col[i * 6 + 4] = rgb[1] * f
    col[i * 6 + 5] = rgb[2] * f
  }
  geo.setDrawRange(0, links.length * 2)
  geo.attributes.position.needsUpdate = true
  geo.attributes.color.needsUpdate = true
}

export function ComputeMesh() {
  const relayGeo = useMemo(() => makeGeo(MAX_RELAY), [])
  const relay = useRef<Link[]>([])
  const lastVersion = useRef(-1)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const n = getFleet().length
    const fbc = getFleetByClass()
    const innerN = fbc.pioneer.length + fbc.cluster.length + fbc.edge.length

    // fleet reindexed (growth/scrub/config change) — cached indices now point
    // at different facilities, so hurry existing links to their fade-out
    if (satData.version !== lastVersion.current) {
      lastVersion.current = satData.version
      for (const L of relay.current) L.life = Math.min(L.life, L.age + FADE)
    }

    const outerN = n - innerN
    const relayTarget = outerN >= 1 && innerN >= 1 ? Math.min(MAX_RELAY, Math.max(1, Math.floor(outerN * 0.08))) : 0

    for (let s = 0; s < SPAWNS_PER_FRAME && relay.current.length < relayTarget; s++) {
      const a = innerN + Math.floor(Math.random() * outerN)
      if (!alive(a)) continue
      const b = nearestSample(a, 0, innerN, RELAY_MAX_DIST)
      if (b >= 0) relay.current.push({ a, b, age: 0, life: 3 + Math.random() * 7 })
    }

    updateLayer(relay.current, relayGeo, RELAY_RGB, dt, n, true)
  })

  return (
    /* green: outer platforms relaying results toward the Earth-facing shell.
       (The purple cooperation layer is the nearest-neighbor web — NeighborWeb.) */
    <lineSegments geometry={relayGeo} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.7} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  )
}

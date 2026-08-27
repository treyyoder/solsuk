import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFleet, satData } from '../store/simStore'
import { useSettingsStore } from '../store/settingsStore'

/**
 * The cooperating swarm, drawn as a TRUE nearest-neighbor web: every
 * facility keeps links to its closest in-range peers, so spatial clusters
 * read as connected webs rather than random flickers.
 *
 *  - Neighbor lists come from a uniform spatial-hash grid (cell = link
 *    range, so the 27-cell neighborhood covers every candidate) and are
 *    refreshed in staggered batches — when a CLOSER facility drifts in,
 *    the link re-targets to it on the node's next refresh.
 *  - Every frame each drawn link re-checks its actual distance: past
 *    range it fades hard and drops NOW, not at the next refresh. That
 *    same check self-heals stale indices after the fleet reindexes.
 *  - Nodes cycle in and out of the web on offset duty cycles, and the
 *    duty itself breathes slowly, so at any moment roughly 25-75% of the
 *    fleet is webbed, the coverage visibly ebbing and flowing.
 */

const RANGE = 1.6
const RANGE_SQ = RANGE * RANGE
/** hard cap on drawn links per node (the LINKS/DC setting scales within it) */
const MAX_LINKS = 4
const MAX_SEGS = 45000
/** nodes whose neighbor lists are recomputed per frame */
const REFRESH_PER_FRAME = 250
/** grid-scan bail-out per node — nearest-of-~200-local is visually exact */
const MAX_CAND = 220
/** seconds of one participation cycle per node */
const CYCLE = 14
/** distance from the window edge (in cycle fraction) over which links fade */
const EDGE = 0.06
const GRID_HALF = 8
const GRID_DIM = Math.ceil((GRID_HALF * 2) / RANGE) // 10
const GRID_CELLS = GRID_DIM * GRID_DIM * GRID_DIM

const PURPLE = [0.71, 0.3, 1.0] // #b44cff

const frac = (x: number) => x - Math.floor(x)
const cellCoord = (v: number) => Math.max(0, Math.min(GRID_DIM - 1, Math.floor((v + GRID_HALF) / RANGE)))

export function NeighborWeb() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SEGS * 6), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SEGS * 6), 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  const state = useRef({
    capacity: 0,
    neighbors: new Int32Array(0), // capacity × MAX_LINKS, -1 = empty slot
    cellOfSat: new Int32Array(0),
    gridEntries: new Int32Array(0),
    gridStarts: new Int32Array(GRID_CELLS + 1),
    gridCursor: new Int32Array(GRID_CELLS + 1),
    refreshCursor: 0,
    frame: 0,
  })

  useFrame(({ clock }) => {
    const s = state.current
    const n = getFleet().length
    const p = satData.positions
    if (n === 0) {
      geo.setDrawRange(0, 0)
      return
    }
    if (s.capacity < n) {
      s.capacity = Math.ceil(n * 1.3)
      s.neighbors = new Int32Array(s.capacity * MAX_LINKS).fill(-1)
      s.cellOfSat = new Int32Array(s.capacity)
      s.gridEntries = new Int32Array(s.capacity)
    }
    s.frame++

    // ---- spatial grid rebuild (counting sort, no allocations) every 15 frames
    if (s.frame % 15 === 1) {
      s.gridStarts.fill(0)
      for (let i = 0; i < n; i++) {
        const x = p[i * 3]
        const y = p[i * 3 + 1]
        const z = p[i * 3 + 2]
        if (x * x + y * y + z * z < 12) {
          s.cellOfSat[i] = -1 // not placed yet (pre-first-frame)
          continue
        }
        const c = (cellCoord(x) * GRID_DIM + cellCoord(y)) * GRID_DIM + cellCoord(z)
        s.cellOfSat[i] = c
        s.gridStarts[c + 1]++
      }
      for (let c = 0; c < GRID_CELLS; c++) s.gridStarts[c + 1] += s.gridStarts[c]
      s.gridCursor.set(s.gridStarts)
      for (let i = 0; i < n; i++) {
        const c = s.cellOfSat[i]
        if (c >= 0) s.gridEntries[s.gridCursor[c]++] = i
      }
    }

    // links per node: the LINKS/DC setting scales the web within the hard cap
    const K = useSettingsStore.getState().maxCrosslinks
    const linksPer = Math.max(1, Math.min(MAX_LINKS, Math.round((n > 16384 ? 2 : 3) * (K / 16))))

    // ---- staggered nearest-neighbor refresh
    const bIdx = new Int32Array(MAX_LINKS)
    const bDist = new Float64Array(MAX_LINKS)
    for (let r = 0; r < REFRESH_PER_FRAME; r++) {
      const i = (s.refreshCursor + r) % n
      const row = i * MAX_LINKS
      const c = s.cellOfSat[i]
      if (c < 0) {
        s.neighbors.fill(-1, row, row + MAX_LINKS)
        continue
      }
      const ax = p[i * 3]
      const ay = p[i * 3 + 1]
      const az = p[i * 3 + 2]
      const cx = Math.floor(c / (GRID_DIM * GRID_DIM))
      const cy = Math.floor(c / GRID_DIM) % GRID_DIM
      const cz = c % GRID_DIM
      let found = 0
      let seen = 0
      for (let dx = Math.max(0, cx - 1); dx <= Math.min(GRID_DIM - 1, cx + 1) && seen < MAX_CAND; dx++)
        for (let dy = Math.max(0, cy - 1); dy <= Math.min(GRID_DIM - 1, cy + 1) && seen < MAX_CAND; dy++)
          for (let dz = Math.max(0, cz - 1); dz <= Math.min(GRID_DIM - 1, cz + 1) && seen < MAX_CAND; dz++) {
            const cell = (dx * GRID_DIM + dy) * GRID_DIM + dz
            for (let e = s.gridStarts[cell]; e < s.gridStarts[cell + 1] && seen < MAX_CAND; e++) {
              const j = s.gridEntries[e]
              if (j === i || j >= n) continue
              seen++
              const ddx = p[j * 3] - ax
              const ddy = p[j * 3 + 1] - ay
              const ddz = p[j * 3 + 2] - az
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz
              if (d2 >= RANGE_SQ) continue
              if (found === linksPer && d2 >= bDist[found - 1]) continue
              let at = Math.min(found, linksPer - 1)
              while (at > 0 && bDist[at - 1] > d2) {
                bIdx[at] = bIdx[at - 1]
                bDist[at] = bDist[at - 1]
                at--
              }
              bIdx[at] = j
              bDist[at] = d2
              if (found < linksPer) found++
            }
          }
      for (let k = 0; k < MAX_LINKS; k++) s.neighbors[row + k] = k < found ? bIdx[k] : -1
    }
    s.refreshCursor = (s.refreshCursor + REFRESH_PER_FRAME) % n

    // ---- emit: participating nodes draw links to their cached neighbors
    // duty breathes 0.3..0.7 (~2 min period) → 25-75% of the fleet webbed
    const duty = 0.5 + 0.2 * Math.sin(clock.elapsedTime * 0.05)
    const t01 = clock.elapsedTime / CYCLE
    // additive links STACK — dim each one as the web grows so 30k facilities
    // read as a web, not a solid glow ring
    const brightness = Math.min(1, 9000 / Math.max(1, n * duty * linksPer))
    const pos = geo.attributes.position.array as Float32Array
    const col = geo.attributes.color.array as Float32Array
    let seg = 0
    for (let i = 0; i < n && seg < MAX_SEGS; i++) {
      const u = frac(t01 + i * 0.6180339887498949)
      if (u >= duty) continue // node is off-web this part of its cycle
      const aNode = Math.min(1, Math.min(u, duty - u) / EDGE)
      const row = i * MAX_LINKS
      const ax = p[i * 3]
      const ay = p[i * 3 + 1]
      const az = p[i * 3 + 2]
      for (let k = 0; k < MAX_LINKS && seg < MAX_SEGS; k++) {
        const j = s.neighbors[row + k]
        if (j < 0 || j >= n) continue
        const bx = p[j * 3]
        const by = p[j * 3 + 1]
        const bz = p[j * 3 + 2]
        const ddx = bx - ax
        const ddy = by - ay
        const ddz = bz - az
        const d2 = ddx * ddx + ddy * ddy + ddz * ddz
        if (d2 >= RANGE_SQ) continue // drifted out of range — drop NOW
        // fade the link out as it approaches max range
        const d = Math.sqrt(d2)
        const a = aNode * Math.min(1, (RANGE - d) / 0.2) * 0.38 * brightness
        const o = seg * 6
        pos[o] = ax
        pos[o + 1] = ay
        pos[o + 2] = az
        pos[o + 3] = bx
        pos[o + 4] = by
        pos[o + 5] = bz
        col[o] = PURPLE[0] * a
        col[o + 1] = PURPLE[1] * a
        col[o + 2] = PURPLE[2] * a
        col[o + 3] = PURPLE[0] * a
        col[o + 4] = PURPLE[1] * a
        col[o + 5] = PURPLE[2] * a
        seg++
      }
    }
    geo.setDrawRange(0, seg * 2)
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })

  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={1} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  )
}

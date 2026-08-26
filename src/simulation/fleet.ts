import { SHELLS } from './constants'
import type { SatelliteConfig } from './types'
import { mulberry32 } from '../utils/random'
import { GROUND_STATIONS } from './groundStations'

const CALLSIGNS = [
  'Helios', 'Aurora', 'Zenith', 'Vanta', 'Kestrel', 'Umbra', 'Corona', 'Nadir',
  'Bastion', 'Vector', 'Cinder', 'Halcyon', 'Meridian', 'Pallas', 'Quasar', 'Rigel',
]

/** Deterministic 48-satellite constellation (same fleet every load). */
export function generateFleet(): SatelliteConfig[] {
  const rng = mulberry32(0x501f)
  const fleet: SatelliteConfig[] = []
  let n = 0
  for (const shell of SHELLS) {
    for (let i = 0; i < shell.count; i++) {
      n++
      const id = `SAT-${String(n).padStart(2, '0')}`
      const callsign = `${CALLSIGNS[(n - 1) % CALLSIGNS.length]}-${String.fromCharCode(65 + shell.id)}${Math.floor((n - 1) / CALLSIGNS.length) + 1}`
      fleet.push({
        id,
        name: callsign,
        shell: shell.id,
        // two orbital planes per shell, evenly phased within each
        phase: ((i % (shell.count / 2)) / (shell.count / 2)) * Math.PI * 2 + shell.id * 0.5,
        raanOffset: i < shell.count / 2 ? 0 : Math.PI / 2,
        gpuPods: 12 + Math.floor(rng() * 37),
        peakExaflops: +(0.4 + rng() * 2.2).toFixed(2),
        panelAreaM2: Math.round(1800 + rng() * 2400),
        batteryMWh: +(2 + rng() * 6).toFixed(1),
        groundStationId: GROUND_STATIONS[Math.floor(rng() * GROUND_STATIONS.length)].id,
      })
    }
  }
  return fleet
}

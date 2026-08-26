import type { MoonBaseConfig, MoonBaseStats } from './types'

export const MOON_BASES: MoonBaseConfig[] = [
  { id: 'shackleton', name: 'Shackleton Rim Complex', latDeg: -89.3, lonDeg: 0, founded: 2039 },
  { id: 'tranquility', name: 'Tranquility Heritage Station', latDeg: 0.7, lonDeg: 23.4, founded: 2043 },
  { id: 'tycho', name: 'Tycho Deep Observatory', latDeg: -43.3, lonDeg: -11.2, founded: 2047 },
  { id: 'mare-frigoris', name: 'Frigoris Foundry', latDeg: 56.0, lonDeg: 1.4, founded: 2051 },
  { id: 'farside', name: 'Farside Listening Post', latDeg: 4.5, lonDeg: 177.6, founded: 2054 },
]

export const INITIAL_BASE_STATS: Record<string, MoonBaseStats> = {
  shackleton: {
    inhabitants: 412,
    oxygenPct: 99.2,
    powerMW: 84,
    nukesArmed: 0,
    experiments: [
      { name: 'Polar ice electrolysis scale-up', progressPct: 78 },
      { name: 'Low-g myocyte cultivation', progressPct: 41 },
    ],
  },
  tranquility: {
    inhabitants: 96,
    oxygenPct: 98.6,
    powerMW: 22,
    nukesArmed: 0,
    experiments: [{ name: 'Regolith sintered habitat vaulting', progressPct: 63 }],
  },
  tycho: {
    inhabitants: 154,
    oxygenPct: 99.5,
    powerMW: 47,
    nukesArmed: 2,
    experiments: [
      { name: 'Neutrino telescope calibration', progressPct: 88 },
      { name: 'Cryogenic quantum memory farm', progressPct: 29 },
    ],
  },
  'mare-frigoris': {
    inhabitants: 238,
    oxygenPct: 97.8,
    powerMW: 131,
    nukesArmed: 1,
    experiments: [
      { name: 'He-3 extraction pilot line', progressPct: 52 },
      { name: 'Mass-driver launch cadence trial', progressPct: 17 },
    ],
  },
  farside: {
    inhabitants: 31,
    oxygenPct: 99.0,
    powerMW: 12,
    nukesArmed: 4,
    experiments: [
      { name: 'Radio-quiet SETI deep survey', progressPct: 95 },
      { name: 'Autonomous swarm excavation', progressPct: 36 },
    ],
  },
}

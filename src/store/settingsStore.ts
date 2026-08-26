import { create } from 'zustand'

export type Quality = 'low' | 'medium' | 'high' | 'ultra'

export interface QualityPreset {
  dpr: [number, number]
  /** stars brighter than this magnitude are shown */
  starMag: number
  clouds: boolean
  bloomIntensity: number
  earthSegments: number
  bigTextures: boolean
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  low: { dpr: [0.75, 1], starMag: 4.0, clouds: false, bloomIntensity: 0.55, earthSegments: 48, bigTextures: false },
  medium: { dpr: [1, 1.25], starMag: 4.6, clouds: true, bloomIntensity: 0.75, earthSegments: 64, bigTextures: false },
  high: { dpr: [1, 1.75], starMag: 5.1, clouds: true, bloomIntensity: 0.95, earthSegments: 96, bigTextures: true },
  ultra: { dpr: [1, 2], starMag: 5.5, clouds: true, bloomIntensity: 1.15, earthSegments: 128, bigTextures: true },
}

interface SettingsState {
  quality: Quality
  orbits: boolean
  constellationLines: boolean
  constellationLabels: boolean
  labels: boolean
  autoRotate: boolean
  leftOpen: boolean
  rightOpen: boolean
  set: (patch: Partial<SettingsState>) => void
  toggle: (key: keyof SettingsState) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  quality: 'high',
  orbits: true,
  constellationLines: true,
  constellationLabels: false,
  labels: true,
  autoRotate: false,
  leftOpen: true,
  rightOpen: true,
  set: (patch) => set(patch),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
}))

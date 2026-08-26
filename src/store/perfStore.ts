import { create } from 'zustand'

interface PerfState {
  fps: number
  setFps: (f: number) => void
}

export const usePerfStore = create<PerfState>((set) => ({
  fps: 60,
  setFps: (fps) => set({ fps }),
}))

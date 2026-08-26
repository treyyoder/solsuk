import { create } from 'zustand'
import type { FocusTarget } from '../simulation/types'

interface FocusState {
  focus: FocusTarget
  landing: boolean
  hoveredSat: string | null
  setFocus: (f: FocusTarget) => void
  escToParent: () => void
  dismissLanding: () => void
  showLanding: () => void
  setHoveredSat: (id: string | null) => void
}

/** dev/test hooks: ?enter=1 skips the landing; ?focus=sat:SAT-07 | moon | moon:tycho | sun | earth */
function initialFromUrl(): { focus: FocusTarget; landing: boolean } {
  const params = new URLSearchParams(window.location.search)
  const f = params.get('focus')
  let focus: FocusTarget = { kind: 'overview' }
  if (f) {
    if (f.startsWith('sat:')) focus = { kind: 'satellite', id: f.slice(4).toUpperCase() }
    else if (f.startsWith('moon:')) focus = { kind: 'moon', baseId: f.slice(5) }
    else if (f === 'moon') focus = { kind: 'moon' }
    else if (f === 'sun') focus = { kind: 'sun' }
    else if (f === 'earth') focus = { kind: 'earth' }
  }
  return { focus, landing: !params.has('enter') && !f }
}

export const useFocusStore = create<FocusState>((set, get) => ({
  ...initialFromUrl(),
  hoveredSat: null,
  setFocus: (focus) => set({ focus }),
  escToParent: () => {
    const { focus } = get()
    if (focus.kind === 'moon' && focus.baseId) set({ focus: { kind: 'moon' } })
    else if (focus.kind !== 'overview') set({ focus: { kind: 'overview' } })
  },
  dismissLanding: () => set({ landing: false }),
  showLanding: () => set({ landing: true, focus: { kind: 'overview' } }),
  setHoveredSat: (hoveredSat) => set({ hoveredSat }),
}))

export function breadcrumb(focus: FocusTarget): { label: string; target: FocusTarget }[] {
  const crumbs: { label: string; target: FocusTarget }[] = [{ label: 'SOL SYSTEM', target: { kind: 'overview' } }]
  switch (focus.kind) {
    case 'earth':
      crumbs.push({ label: 'EARTH NET', target: { kind: 'earth' } })
      break
    case 'satellite':
      crumbs.push({ label: 'EARTH NET', target: { kind: 'earth' } })
      crumbs.push({ label: focus.id, target: focus })
      break
    case 'moon':
      crumbs.push({ label: 'LUNA', target: { kind: 'moon' } })
      if (focus.baseId) crumbs.push({ label: focus.baseId.toUpperCase(), target: focus })
      break
    case 'sun':
      crumbs.push({ label: 'SOL', target: { kind: 'sun' } })
      break
  }
  return crumbs
}

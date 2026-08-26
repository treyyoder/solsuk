import { FLEET, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { useSettingsStore } from '../store/settingsStore'
import { SHELLS } from '../simulation/constants'
import { Section, ToggleRow } from './ui'

const SHELL_LABEL = ['LEO-A 53°', 'POLAR 97°', 'MEO 30°']

export function FleetList() {
  const stats = useSimStore((s) => s.stats)
  const focus = useFocusStore((s) => s.focus)
  const setFocus = useFocusStore((s) => s.setFocus)
  const settings = useSettingsStore()

  const selectedId = focus.kind === 'satellite' ? focus.id : null

  return (
    <div className="glass pointer-events-auto flex h-full w-56 flex-col overflow-y-auto rounded-xl p-3">
      <Section title="Orbital fleet">
        <div className="flex flex-col gap-2.5">
          {SHELLS.map((shell) => (
            <div key={shell.id}>
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-fg-dim">{SHELL_LABEL[shell.id]}</div>
              <div className="flex flex-col">
                {FLEET.filter((s) => s.shell === shell.id).map((cfg) => {
                  const st = stats[cfg.id]
                  return (
                    <button
                      key={cfg.id}
                      onClick={() => setFocus({ kind: 'satellite', id: cfg.id })}
                      className={`flex items-center gap-2 rounded px-1.5 py-[3px] text-left transition-colors hover:bg-white/5 ${
                        selectedId === cfg.id ? 'bg-orbit/15' : ''
                      }`}
                    >
                      <span className={`mono w-14 shrink-0 text-[10px] ${selectedId === cfg.id ? 'text-orbit' : 'text-fg-dim'}`}>
                        {cfg.id}
                      </span>
                      <div className="h-1 flex-1 rounded bg-black/40">
                        <div
                          className="h-full rounded bg-orbit/70"
                          style={{ width: `${(st?.utilization ?? 0) * 100}%` }}
                        />
                      </div>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${st?.eclipsed ? 'bg-fg-dim/50' : 'bg-sol shadow-[0_0_5px_rgba(255,180,84,0.8)]'}`}
                        title={st?.eclipsed ? 'in eclipse' : 'sunlit'}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Display">
        <ToggleRow label="Orbit rings" value={settings.orbits} onChange={() => settings.toggle('orbits')} />
        <ToggleRow label="Constellations" value={settings.constellationLines} onChange={() => settings.toggle('constellationLines')} />
        <ToggleRow label="Auto-rotate" value={settings.autoRotate} onChange={() => settings.toggle('autoRotate')} />
      </Section>
    </div>
  )
}

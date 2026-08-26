import { satConfigOf, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { MOON_BASES } from '../simulation/moonBases'
import { GROUND_STATIONS } from '../simulation/groundStations'
import { fmtEF, fmtGbps, fmtMs, fmtMW, fmtPct } from '../utils/format'
import { Badge, Bar, Section, StatRow } from './ui'

function SatellitePanel({ id }: { id: string }) {
  const cfg = satConfigOf(id)
  const st = useSimStore((s) => s.stats[id])
  if (!st || !cfg) return null
  const station = GROUND_STATIONS.find((g) => g.id === cfg.groundStationId)!

  return (
    <>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="orbit-text text-sm font-semibold">{cfg.id}</span>
        <Badge tone={st.eclipsed ? 'dim' : 'sol'}>{st.eclipsed ? 'ECLIPSE' : 'SUNLIT'}</Badge>
      </div>
      <div className="mb-3 text-[11px] text-fg-dim">
        “{cfg.name}” · sun-riding orbit · {cfg.radius.toFixed(2)}R · plane tilt{' '}
        {Math.round((cfg.tilt * 180) / Math.PI)}° off the sun line
      </div>

      <Section title="Compute">
        <div className="glass-bright mb-2 rounded-lg p-2.5">
          <div className="mono text-xl text-orbit">{fmtEF(st.effectiveExaflops)}</div>
          <div className="hud-label">effective throughput</div>
        </div>
        <StatRow label="Utilization" value={fmtPct(st.utilization * 100, 1)} accent="orbit" />
        <Bar value={st.utilization} />
        <StatRow label="Peak capacity" value={fmtEF(cfg.peakExaflops)} />
        <StatRow label="GPU pods" value={`${cfg.gpuPods}`} />
        <StatRow label="Active jobs" value={`${st.activeJobs}`} />
        <StatRow label="Radiator temp" value={`${st.tempC.toFixed(1)} °C`} accent={st.tempC > 48 ? 'warn' : undefined} />
      </Section>

      <Section title="Solar">
        <div className="glass-bright mb-2 rounded-lg p-2.5">
          <div className="mono text-xl text-sol">{fmtMW(st.solarMW)}</div>
          <div className="hud-label">array output · {fmtPct(st.illumination * 100)} illuminated</div>
        </div>
        <StatRow label="Panel area" value={`${cfg.panelAreaM2.toLocaleString()} m²`} />
        <StatRow label="Battery" value={`${fmtPct(st.batteryPct, 1)} ${st.charging ? '▲ charging' : '▼ draining'}`} accent={st.batteryPct < 20 ? 'alert' : 'sol'} />
        <Bar value={st.batteryPct / 100} color="var(--color-sol)" warnBelow={20} />
        <StatRow label="Capacity" value={`${cfg.batteryMWh} MWh`} />
      </Section>

      <Section title="Transmission">
        {st.crosslinks.map((l) => (
          <StatRow key={l.to} label={`⟷ ${l.to} optical`} value={fmtGbps(l.gbps)} accent="ion" />
        ))}
        <StatRow label={station.name.split(' (')[0]} value={st.groundVisible ? 'VISIBLE' : 'OCCLUDED'} accent={st.groundVisible ? 'orbit' : undefined} />
        {st.groundVisible && (
          <>
            <StatRow label="Downlink" value={fmtGbps(st.downlinkGbps)} accent="orbit" />
            <StatRow label="Latency" value={fmtMs(st.latencyMs)} />
          </>
        )}
      </Section>
    </>
  )
}

function MoonPanel({ baseId }: { baseId?: string }) {
  const moon = useSimStore((s) => s.moon)
  const setFocus = useFocusStore((s) => s.setFocus)

  return (
    <>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="orbit-text text-sm font-semibold">LUNA</span>
        <span className="mono text-[10px] text-fg-dim">{moon.totalInhabitants} inhabitants</span>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-fg-dim">
        Five permanent installations. Click a surface marker or a card to inspect a base.
      </p>
      {MOON_BASES.map((base) => {
        const st = moon.bases[base.id]
        const selected = baseId === base.id
        return (
          <button
            key={base.id}
            onClick={() => setFocus({ kind: 'moon', baseId: base.id })}
            className={`mb-2 w-full rounded-lg border p-2.5 text-left transition-colors ${
              selected ? 'border-ion/50 bg-ion/5' : 'border-edge bg-black/20 hover:border-fg-dim/40'
            }`}
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className={`text-[11px] font-semibold ${selected ? 'text-ion' : 'text-fg'}`}>{base.name}</span>
              <span className="mono text-[9px] text-fg-dim">est. {base.founded}</span>
            </div>
            <StatRow label="Inhabitants" value={`${st.inhabitants}`} />
            <StatRow label="O₂ saturation" value={fmtPct(st.oxygenPct, 1)} accent={st.oxygenPct < 95 ? 'alert' : 'ion'} />
            <Bar value={(st.oxygenPct - 90) / 10} color="var(--color-ion)" warnBelow={50} />
            <StatRow label="Power" value={fmtMW(st.powerMW)} />
            <StatRow label="Nuclear weapons armed" value={String(st.nukesArmed).padStart(2, '0')} accent={st.nukesArmed > 0 ? 'warn' : undefined} />
            {st.experiments.map((e) => (
              <div key={e.name} className="mt-1">
                <div className="flex justify-between text-[10px] text-fg-dim">
                  <span className="truncate pr-2">{e.name}</span>
                  <span className="mono">{fmtPct(e.progressPct)}</span>
                </div>
                <Bar value={e.progressPct / 100} color="var(--color-orbit)" />
              </div>
            ))}
          </button>
        )
      })}
    </>
  )
}

function SunPanel() {
  const agg = useSimStore((s) => s.aggregates)
  return (
    <>
      <div className="sol-text mb-1 text-sm font-semibold">SOL</div>
      <p className="mb-3 text-[11px] leading-relaxed text-fg-dim">
        G2V main-sequence star. Powers every panel in the net — 3.8 × 10²⁶ W of fusion output, of which the fleet
        harvests a vanishingly small, civilization-sized sliver.
      </p>
      <StatRow label="Photosphere" value="5,772 K" accent="sol" />
      <StatRow label="Fleet capture (live)" value={`${(agg.totalSolarGW * 1000).toFixed(1)} MW`} accent="sol" />
      <StatRow label="Status" value="ALWAYS ON · BURNING" accent="warn" />
    </>
  )
}

function OverviewPanel() {
  const agg = useSimStore((s) => s.aggregates)
  const satCount = useSimStore((s) => s.satCount)
  return (
    <>
      <div className="hud-label mb-2">Net overview</div>
      <div className="glass-bright mb-3 rounded-lg p-2.5">
        <div className="mono text-xl text-orbit">{agg.totalEffectiveEF.toFixed(1)} EF</div>
        <div className="hud-label">aggregate effective compute</div>
      </div>
      <StatRow label="Solar harvest" value={`${agg.totalSolarGW.toFixed(2)} GW`} accent="sol" />
      <StatRow label="Satellites in eclipse" value={`${agg.inEclipse} / ${satCount}`} />
      <StatRow label="Mean utilization" value={fmtPct(agg.meanUtilization * 100, 1)} accent="orbit" />
      <Bar value={agg.meanUtilization} />
      <p className="mt-4 text-[10px] leading-relaxed text-fg-dim">
        Click a satellite to board it — or the Moon, the Earth, even the Sun. Drag to rotate your vantage point, scroll
        to travel. Esc steps back out.
      </p>
    </>
  )
}

export function RightInspector() {
  const focus = useFocusStore((s) => s.focus)
  return (
    <div className="glass pointer-events-auto flex h-full w-72 flex-col overflow-y-auto rounded-xl p-4">
      <div className="fade-up" key={JSON.stringify(focus)}>
        {focus.kind === 'satellite' ? (
          <SatellitePanel id={focus.id} />
        ) : focus.kind === 'moon' ? (
          <MoonPanel baseId={focus.baseId} />
        ) : focus.kind === 'sun' ? (
          <SunPanel />
        ) : (
          <OverviewPanel />
        )}
      </div>
    </div>
  )
}

import { satConfigOf, useSimStore } from '../store/simStore'
import { useFocusStore } from '../store/focusStore'
import { MOON_BASES } from '../simulation/moonBases'
import { activeCityCount, GROUND_STATIONS, MAX_CITIES } from '../simulation/groundStations'
import {
  CLASS_META,
  fabricTbpsForPower,
  fmtAreaM2,
  fmtBandwidthGbps,
  fmtCount,
  fmtFlopsEF,
  fmtMassTons,
  fmtPowerMW,
  radiatorAreaM2,
  solarAreaM2,
} from '../simulation/epochModel'
import { fmtGbps, fmtMs, fmtMW, fmtPct } from '../utils/format'
import { Badge, Bar, Section, StatRow } from './ui'

function SatellitePanel({ id }: { id: string }) {
  const cfg = satConfigOf(id)
  const st = useSimStore((s) => s.focusedStats)
  const epoch = useSimStore((s) => s.epoch)
  const config = useSimStore((s) => s.config)
  if (!cfg) return <div className="text-[11px] text-fg-dim">Facility decommissioned at this point in the timeline.</div>
  const meta = CLASS_META[cfg.cls]
  const station = GROUND_STATIONS.find((g) => g.id === cfg.groundStationId)!
  const computeEF = (cfg.powerMW * 1000 * epoch.computeEffTFperKW) / 1e6

  return (
    <>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="orbit-text text-sm font-semibold">{cfg.id}</span>
        <Badge tone={cfg.cls === 'giga' ? 'sol' : cfg.cls === 'hyper' ? 'orbit' : 'ion'}>{meta.short}</Badge>
      </div>
      <div className="mb-2 text-[11px] text-fg-dim">
        “{cfg.name}” · {meta.label} · commissioned {cfg.commissionYear.toFixed(0)}
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-fg-dim/80">{meta.purpose}</p>

      <Section title="Compute">
        <div className="glass-bright mb-2 rounded-lg p-2.5">
          <div className="mono text-xl text-orbit">{fmtFlopsEF(st ? st.effectiveExaflops : computeEF)}</div>
          <div className="hud-label">FP16 AI compute {st ? '· live' : '· rated'}</div>
        </div>
        {st && (
          <>
            <StatRow label="Utilization" value={fmtPct(st.utilization * 100, 1)} accent="orbit" />
            <Bar value={st.utilization} />
            <StatRow label="Active jobs" value={`${st.activeJobs}`} />
          </>
        )}
        <StatRow label="Rated capacity" value={fmtFlopsEF(computeEF)} />
        <StatRow label="GPU equivalents" value={fmtCount((computeEF * 1e6) / config.gpuEquivTFLOPS)} />
        <StatRow label="Internal fabric" value={fmtBandwidthGbps(fabricTbpsForPower(cfg.powerMW, epoch.year, config) * 1000)} accent="ion" />
      </Section>

      <Section title="Power & Thermal">
        <div className="glass-bright mb-2 rounded-lg p-2.5">
          <div className="mono text-xl text-sol">{fmtPowerMW(cfg.powerMW)}</div>
          <div className="hud-label">electrical draw {st ? `· ${fmtPct(st.illumination * 100)} illuminated` : ''}</div>
        </div>
        <StatRow label="Solar array" value={fmtAreaM2(solarAreaM2(cfg.powerMW, epoch.year, config))} accent="sol" />
        <StatRow label="Radiators" value={fmtAreaM2(radiatorAreaM2(cfg.powerMW, config))} accent="warn" />
        {st && (
          <>
            <StatRow label="Array output" value={fmtMW(st.solarMW)} />
            <StatRow
              label="Battery"
              value={`${fmtPct(st.batteryPct, 1)} ${st.charging ? '▲ charging' : '▼ draining'}`}
              accent={st.batteryPct < 20 ? 'alert' : 'sol'}
            />
            <Bar value={st.batteryPct / 100} color="var(--color-sol)" warnBelow={20} />
          </>
        )}
      </Section>

      <Section title="Transmission">
        {st?.crosslinks.map((l) => (
          <StatRow key={l.to} label={`⟷ ${l.to} optical`} value={fmtGbps(l.gbps)} accent="ion" />
        ))}
        <StatRow label={station.name} value={st?.groundVisible ? 'VISIBLE' : 'OCCLUDED'} accent={st?.groundVisible ? 'orbit' : undefined} />
        {st?.groundVisible && (
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
  const epoch = useSimStore((s) => s.epoch)
  return (
    <>
      <div className="sol-text mb-1 text-sm font-semibold">SOL</div>
      <p className="mb-3 text-[11px] leading-relaxed text-fg-dim">
        G2V main-sequence star. Powers every panel in the net — 3.8 × 10²⁶ W of fusion output, of which the fleet
        harvests a vanishingly small, civilization-sized sliver.
      </p>
      <StatRow label="Photosphere" value="5,772 K" accent="sol" />
      <StatRow label="Fleet capture (live)" value={fmtPowerMW(epoch.totalPowerMW)} accent="sol" />
      <StatRow label="Status" value="ALWAYS ON · BURNING" accent="warn" />
    </>
  )
}

/** The simulation dashboard — the spec's live-statistics readout. */
function DashboardPanel() {
  const epoch = useSimStore((s) => s.epoch)
  return (
    <>
      <div className="hud-label mb-2">Constellation dashboard</div>
      <div className="glass-bright mb-3 rounded-lg p-2.5">
        <div className="mono text-xl text-orbit">{fmtFlopsEF(epoch.totalComputeEF)}</div>
        <div className="hud-label">total FP16 AI compute</div>
      </div>
      <StatRow label="Year" value={epoch.year.toFixed(1)} accent="orbit" />
      <StatRow label="Orbital data centers" value={fmtCount(epoch.totalCount)} accent="orbit" />
      <StatRow label="Total electrical power" value={fmtPowerMW(epoch.totalPowerMW)} accent="sol" />
      <StatRow label="Average power / DC" value={fmtPowerMW(epoch.avgPowerMW)} />
      <StatRow label="Largest data center" value={fmtPowerMW(epoch.largestPowerMW)} accent="sol" />
      <StatRow label="Largest DC compute" value={fmtFlopsEF(epoch.largestComputeEF)} />
      <StatRow label="Compute efficiency" value={`${epoch.computeEffTFperKW.toFixed(0)} TF/kW`} />
      <StatRow label="Solar cell efficiency" value={fmtPct(epoch.solarEffPct, 1)} />
      <StatRow label="Solar collection area" value={fmtAreaM2(epoch.totalSolarAreaKm2 * 1e6)} accent="sol" />
      <StatRow label="Radiator area" value={fmtAreaM2(epoch.totalRadiatorAreaKm2 * 1e6)} accent="warn" />
      <StatRow label="GPU equivalents" value={fmtCount(epoch.gpuEquivalents)} />
      <StatRow label="Inter-satellite bandwidth" value={fmtBandwidthGbps(epoch.interSatGbps)} accent="ion" />
      <StatRow label="Earth-orbit bandwidth" value={fmtBandwidthGbps(epoch.earthLinkGbps)} accent="ion" />
      <StatRow label="Cities served" value={`${activeCityCount(epoch.year)} / ${MAX_CITIES}`} accent="orbit" />
      <StatRow label="Infrastructure mass" value={fmtMassTons(epoch.totalMassTons)} />

      <div className="mt-3 border-t border-edge pt-2">
        <div className="hud-label mb-1.5">Fleet by class</div>
        {(Object.keys(CLASS_META) as (keyof typeof CLASS_META)[]).map((cls) => {
          const n = epoch.counts[cls]
          if (n === 0) return null
          const meta = CLASS_META[cls]
          return (
            <div key={cls} className="flex items-baseline justify-between py-0.5 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                <span className="text-fg-dim">{meta.label}</span>
              </span>
              <span className="mono text-fg">{fmtCount(n)}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-fg-dim">
        Scrub the timeline below to travel 2026 → 2084. Click any facility to board it — or the Moon, the Earth, even
        the Sun. Esc steps back out.
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
          <DashboardPanel />
        )}
      </div>
    </div>
  )
}

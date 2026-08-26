import { useSimStore } from '../store/simStore'
import { fmtPct } from '../utils/format'

export function BottomBar() {
  const agg = useSimStore((s) => s.aggregates)
  const moon = useSimStore((s) => s.moon)
  return (
    <div className="glass pointer-events-auto flex h-9 items-center justify-center gap-6 rounded-xl px-5">
      <span className="mono text-[11px]">
        <span className="text-orbit">{agg.totalEffectiveEF.toFixed(1)} EF</span>
        <span className="text-fg-dim"> net compute</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-sol">{agg.totalSolarGW.toFixed(2)} GW</span>
        <span className="text-fg-dim"> solar</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-fg">{agg.inEclipse}/48</span>
        <span className="text-fg-dim"> in eclipse</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-orbit">{fmtPct(agg.meanUtilization * 100)}</span>
        <span className="text-fg-dim"> util</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-ion">{moon.totalInhabitants}</span>
        <span className="text-fg-dim"> on Luna</span>
      </span>
    </div>
  )
}

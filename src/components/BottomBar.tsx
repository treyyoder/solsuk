import { useSimStore } from '../store/simStore'
import { fmtCount, fmtFlopsEF, fmtPowerMW } from '../simulation/epochModel'
import { activeCityCount, MAX_CITIES } from '../simulation/groundStations'

export function BottomBar() {
  const epoch = useSimStore((s) => s.epoch)
  const moon = useSimStore((s) => s.moon)
  const year = useSimStore((s) => s.year)
  const cities = activeCityCount(year)
  return (
    <div className="glass pointer-events-auto flex h-9 items-center justify-center gap-6 rounded-xl px-5">
      <span className="mono text-[11px]">
        <span className="text-orbit">{fmtCount(epoch.totalCount)}</span>
        <span className="text-fg-dim"> data centers</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-orbit">{fmtFlopsEF(epoch.totalComputeEF)}</span>
        <span className="text-fg-dim"> net compute</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-sol">{fmtPowerMW(epoch.totalPowerMW)}</span>
        <span className="text-fg-dim"> solar</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-sol">{fmtPowerMW(epoch.largestPowerMW)}</span>
        <span className="text-fg-dim"> largest DC</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-orbit">{cities}</span>
        <span className="text-fg-dim">/{MAX_CITIES} cities served</span>
      </span>
      <span className="text-edge">·</span>
      <span className="mono text-[11px]">
        <span className="text-ion">{moon.totalInhabitants}</span>
        <span className="text-fg-dim"> on Luna</span>
      </span>
    </div>
  )
}

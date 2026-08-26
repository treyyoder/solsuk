import { useFocusStore } from '../store/focusStore'

export function LandingOverlay() {
  const dismissLanding = useFocusStore((s) => s.dismissLanding)
  const setFocus = useFocusStore((s) => s.setFocus)

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-void/55 via-transparent to-void/80">
      <div className="fade-up flex flex-col items-center px-6 text-center" style={{ animationDelay: '200ms' }}>
        <div className="hud-label mb-4 tracking-[0.5em] text-ion">ORBITAL COMPUTE ERA · 2061</div>
        <h1 className="title-glow font-display text-6xl font-bold tracking-[0.16em] md:text-7xl">SOLSUK</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-dim">
          The heavy thinking moved off-world. Forty-eight solar data centers ride the net above Earth, the Moon keeps
          its own counsel, and the Sun pays for all of it.
        </p>
        <button
          onClick={() => {
            dismissLanding()
            setFocus({ kind: 'overview' })
          }}
          className="btn-ghost glass-bright mt-10 rounded-lg px-8 py-3.5 text-xs tracking-[0.25em] text-orbit"
        >
          ENTER ORBIT
        </button>
      </div>
    </div>
  )
}

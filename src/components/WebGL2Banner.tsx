import { useState } from 'react'
import { looksLikeTorBrowser } from '../utils/webgl'

/** Shown in place of the 3D viewport when WebGL2 is unavailable. */
export function WebGL2Banner({ onRecheck, errorDetail }: { onRecheck: () => boolean; errorDetail?: string }) {
  const [copied, setCopied] = useState(false)
  const [rechecked, setRechecked] = useState(false)
  const tor = looksLikeTorBrowser()

  const copyPref = async () => {
    try {
      await navigator.clipboard.writeText('webgl.enable-webgl2')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      /* pref name is printed right there */
    }
  }

  const recheck = () => {
    if (!onRecheck()) {
      setRechecked(true)
      window.setTimeout(() => setRechecked(false), 3500)
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-void p-6">
      <div className="glass-bright fade-up max-w-xl rounded-2xl p-8">
        <div className="hud-label mb-3 text-warn">3D VIEWPORT UNAVAILABLE</div>
        <h2 className="orbit-text mb-3 font-display text-xl font-semibold">
          The orbital view requires WebGL2{tor ? ', which Tor Browser disables for fingerprinting protection' : ''}
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-fg">
          Your browser did not provide a WebGL2 context, so the Earth, fleet, Moon and Sun cannot render.
        </p>
        {errorDetail && (
          <div className="mono mb-4 rounded-lg border border-warn/30 bg-black/40 p-3 text-[11px] leading-relaxed text-warn/90">
            The 3D renderer started but then failed: {errorDetail}
          </div>
        )}
        <div className="mb-4 rounded-lg border border-edge bg-black/30 p-4 text-[13px] leading-relaxed text-fg-dim">
          <div className="mb-2 font-semibold text-fg">To enable it anyway (this browser only):</div>
          <ol className="ml-4 list-decimal space-y-1">
            {tor && (
              <li>
                Set the shield icon&apos;s security level to <span className="text-orbit">Standard</span>.
              </li>
            )}
            <li>
              Open <span className="mono text-ion">about:config</span> in a new tab.
            </li>
            <li>
              Search for{' '}
              <button
                onClick={copyPref}
                className="mono rounded border border-orbit/40 bg-orbit/10 px-1.5 py-0.5 text-orbit transition-colors hover:bg-orbit/20"
              >
                webgl.enable-webgl2 {copied ? '✓ copied' : '⧉'}
              </button>{' '}
              and toggle it to <span className="mono text-orbit">true</span>.
            </li>
            <li>Come back and hit re-check.</li>
          </ol>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={recheck} className="btn-ghost rounded-lg px-5 py-2.5 text-xs tracking-[0.15em] text-orbit">
            ↻ RE-CHECK &amp; LAUNCH
          </button>
          {rechecked && <span className="text-[11px] text-warn">Still no WebGL2 — flip the pref, then try again (or reload).</span>}
        </div>
      </div>
    </div>
  )
}

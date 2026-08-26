/** Lightweight on-screen diagnostics, enabled with `?diag=1`.
 * Captures window errors, unhandled rejections, console.error calls, and
 * renderer lifecycle marks so hardened browsers (Tor Browser) can be debugged
 * without opening devtools. */

export const diagEnabled = (): boolean => new URLSearchParams(window.location.search).has('diag')

type Listener = (lines: string[]) => void

const lines: string[] = []
const listeners = new Set<Listener>()
let installed = false

export function diagLog(msg: string) {
  if (!diagEnabled()) return
  const stamp = (performance.now() / 1000).toFixed(1)
  lines.push(`[${stamp}s] ${msg}`)
  if (lines.length > 30) lines.shift()
  listeners.forEach((l) => l([...lines]))
  // dev-only out-of-band sink so diagnostics survive whatever paints over the page
  if (import.meta.env.DEV) {
    try {
      void fetch('http://127.0.0.1:5178/log', { method: 'POST', body: `[${stamp}s] ${msg}`, mode: 'cors' }).catch(() => {})
    } catch {
      /* sink unavailable */
    }
  }
}

export function diagSubscribe(l: Listener): () => void {
  listeners.add(l)
  l([...lines])
  return () => listeners.delete(l)
}

export function installDiag() {
  if (installed || !diagEnabled()) return
  installed = true
  window.addEventListener('error', (e) => diagLog(`window.onerror: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`))
  window.addEventListener('unhandledrejection', (e) => diagLog(`unhandledrejection: ${String(e.reason).slice(0, 200)}`))
  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    diagLog(`console.error: ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ').slice(0, 240)}`)
    origError(...args)
  }
  const origWarn = console.warn.bind(console)
  console.warn = (...args: unknown[]) => {
    const text = args.map(String).join(' ')
    if (/webgl|three|shader|framebuffer|texture/i.test(text)) diagLog(`console.warn: ${text.slice(0, 240)}`)
    origWarn(...args)
  }

  // context probe summary
  try {
    const c = document.createElement('canvas')
    const gl2 = c.getContext('webgl2')
    if (gl2) {
      const exts = gl2.getSupportedExtensions() ?? []
      diagLog(`webgl2: OK · ${exts.length} extensions · floatRT=${exts.includes('EXT_color_buffer_float') || exts.includes('EXT_color_buffer_half_float')}`)
      diagLog(`GL_VERSION: ${gl2.getParameter(gl2.VERSION)} · RENDERER: ${gl2.getParameter(gl2.RENDERER)}`)
      diagLog(`MAX_TEXTURE_SIZE: ${gl2.getParameter(gl2.MAX_TEXTURE_SIZE)} · MAX_VERTEX_ATTRIBS: ${gl2.getParameter(gl2.MAX_VERTEX_ATTRIBS)}`)
    } else {
      diagLog('webgl2: getContext returned null')
      const gl1 = c.getContext('webgl')
      diagLog(`webgl1 fallback probe: ${gl1 ? 'available (but three r185 cannot use it)' : 'also null'}`)
    }
  } catch (e) {
    diagLog(`webgl probe threw: ${String(e).slice(0, 200)}`)
  }

  void import('./webgl').then(({ webglCaps }) => {
    const caps = webglCaps(true)
    diagLog(
      `caps: webgl2=${caps.webgl2} floatRT(functional)=${caps.floatRT} exts=${caps.extensionCount} maxTex=${caps.maxTextureSize}`,
    )
  })

  diagLog('diag v3 · outlines + dpr override active')

  // visual forensics: outline key layers so screenshots reveal geometry
  const style = document.createElement('style')
  style.textContent = `
    canvas { outline: 4px solid magenta !important; }
    body { outline: 4px solid lime !important; }
    #root > div { outline: 2px dashed cyan !important; }
  `
  document.head.appendChild(style)

  // DOM forensics: what is actually painting in the viewport?
  let ticks = 0
  const describe = (el: Element | null) =>
    el ? `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === 'string' ? el.className : '').split(' ').slice(0, 3).join('.').slice(0, 60)}` : 'null'
  const timer = window.setInterval(() => {
    ticks++
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const r = canvas.getBoundingClientRect()
      const cs = getComputedStyle(canvas)
      diagLog(
        `canvas rect=${r.left | 0},${r.top | 0} ${r.width | 0}x${r.height | 0} · buffer=${canvas.width}x${canvas.height} · style=${cs.width}/${cs.height} pos=${cs.position} z=${cs.zIndex}`,
      )
    } else {
      diagLog('no <canvas> in DOM')
    }
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    let el = document.elementFromPoint(cx, cy)
    diagLog(`elementFromPoint(center)=${describe(el)} · (20,100)=${describe(document.elementFromPoint(20, 100))}`)
    for (let d = 0; el && d < 4; d++, el = el.parentElement) {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      diagLog(`  ↳[${d}] ${describe(el)} · z=${cs.zIndex} pos=${cs.position} rect=${r.left | 0},${r.top | 0} ${r.width | 0}x${r.height | 0} bg=${cs.backgroundColor}`)
    }
    diagLog(`window=${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}`)
    if (ticks >= 4) window.clearInterval(timer)
  }, 2500)
}

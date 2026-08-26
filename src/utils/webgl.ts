/** WebGL capability probes. three.js r163+ renders exclusively through WebGL2,
 * so a null context means the 3D viewport cannot work at all (Tor Browser
 * ships with `webgl.enable-webgl2` forced off; Safer/Safest security levels
 * block WebGL entirely).
 *
 * Even with WebGL2 on, Tor Browser keeps `webgl.disable-extensions=true` —
 * and float/half-float render targets are still *extensions* in WebGL2
 * (EXT_color_buffer_float / EXT_color_buffer_half_float). The bloom
 * post-processing chain renders into half-float framebuffers, so without
 * them the composer's framebuffer is incomplete and every frame comes out
 * black. We probe once and run without post-processing in that case. */

export interface WebGLCaps {
  webgl2: boolean
  /** float/half-float render targets PROVEN to work → post-processing (bloom) can run */
  floatRT: boolean
  extensionCount: number
  maxTextureSize: number
}

const NO_CAPS: WebGLCaps = { webgl2: false, floatRT: false, extensionCount: 0, maxTextureSize: 0 }

let cached: WebGLCaps | null = null

/**
 * Fingerprinting-resistant browsers (Tor Browser) SPOOF getSupportedExtensions
 * with a standard-looking list, so asking is worthless — the only trustworthy
 * check is doing: allocate a half-float texture, attach it to a framebuffer,
 * and see whether the framebuffer is actually complete.
 */
function probeFloatRT(gl: WebGL2RenderingContext): boolean {
  try {
    // getExtension is required to *activate* the render-to-float capability
    const extHF = gl.getExtension('EXT_color_buffer_half_float')
    const extF = gl.getExtension('EXT_color_buffer_float')
    if (!extHF && !extF) return false
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 4, 4, 0, gl.RGBA, gl.HALF_FLOAT, null)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    // and prove a clear actually lands (some hardened paths fail silently later)
    let ok = complete
    if (complete) {
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      ok = gl.getError() === gl.NO_ERROR
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fb)
    gl.deleteTexture(tex)
    return ok
  } catch {
    return false
  }
}

export function webglCaps(force = false): WebGLCaps {
  if (cached && !force) return cached
  const params = new URLSearchParams(window.location.search)
  // `?no3d=1` forces the unsupported banner; `?nofx=1` forces reduced-effects mode (both for testing)
  if (params.has('no3d')) return (cached = { ...NO_CAPS })
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return (cached = { ...NO_CAPS })
    const exts = gl.getSupportedExtensions() ?? []
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    const floatRT = !params.has('nofx') && probeFloatRT(gl)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return (cached = { webgl2: true, floatRT, extensionCount: exts.length, maxTextureSize })
  } catch {
    return (cached = { ...NO_CAPS })
  }
}

/**
 * Cap the render DPR so the drawing buffer (and any same-sized post-processing
 * target) stays within MAX_TEXTURE_SIZE. Irrelevant on normal browsers
 * (16384), decisive under resist-fingerprinting's spoofed 2048.
 */
export function clampDprToTextureLimit(dpr: [number, number]): [number, number] {
  const caps = webglCaps()
  if (!caps.webgl2 || caps.maxTextureSize <= 0) return dpr
  const largestDim = Math.max(window.innerWidth, window.innerHeight, 1)
  const cap = Math.max(0.4, caps.maxTextureSize / largestDim)
  return [Math.min(dpr[0], cap), Math.min(dpr[1], cap)]
}

export function supportsWebGL2(): boolean {
  return webglCaps(true).webgl2
}

/** Heuristic only — used to tailor the banner copy, never for feature gating. */
export function looksLikeTorBrowser(): boolean {
  return window.location.hostname.endsWith('.onion')
}

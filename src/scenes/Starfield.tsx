import { useMemo } from 'react'
import * as THREE from 'three'
import starsRaw from '../data/stars.json'
import { STAR_RADIUS } from '../simulation/constants'
import { bvToRGB } from '../utils/astro'
import { QUALITY_PRESETS, useSettingsStore } from '../store/settingsStore'

interface StarRow {
  p: [number, number, number]
  m: number
  c: number
}

const STARS = starsRaw as StarRow[]

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vColor, a);
  }
`

/** Real sky: HYG bright stars on a distant sphere. One draw call. */
export function Starfield() {
  const quality = useSettingsStore((s) => s.quality)
  const magCutoff = QUALITY_PRESETS[quality].starMag

  const { geometry, material } = useMemo(() => {
    const rows = STARS.filter((s) => s.m <= magCutoff)
    const pos = new Float32Array(rows.length * 3)
    const size = new Float32Array(rows.length)
    const color = new Float32Array(rows.length * 3)
    rows.forEach((s, i) => {
      pos[i * 3] = s.p[0] * STAR_RADIUS
      pos[i * 3 + 1] = s.p[1] * STAR_RADIUS
      pos[i * 3 + 2] = s.p[2] * STAR_RADIUS
      // brighter star → bigger point; mag -1.5 (Sirius) ≈ 7px, mag 5.5 ≈ 1.2px
      size[i] = Math.max(1.1, 5.2 * Math.pow(10, -0.13 * s.m))
      const [r, g, b] = bvToRGB(s.c)
      const brightness = Math.min(1, 0.45 + Math.pow(10, -0.18 * s.m) * 0.8)
      color[i * 3] = r * brightness
      color[i * 3 + 1] = g * brightness
      color[i * 3 + 2] = b * brightness
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry: geo, material: mat }
  }, [magCutoff])

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

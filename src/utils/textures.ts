import * as THREE from 'three'
import { webglCaps } from './webgl'
import { QUALITY_PRESETS, useSettingsStore } from '../store/settingsStore'

/**
 * Pick the texture file BEFORE loading — never rely on three's auto-downscale
 * (slow, memory-spiking, and ugly on hardened browsers with a 2048 clamp).
 */
export function textureUrl(base: string, has8k: boolean): string {
  const caps = webglCaps()
  const preset = QUALITY_PRESETS[useSettingsStore.getState().quality]
  const want8k = has8k && preset.bigTextures && caps.maxTextureSize >= 8192
  return `/textures/${base}_${want8k ? '8k' : '2k'}.jpg`
}

export function configureColorMap(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(8, webglCaps().maxTextureSize >= 8192 ? 8 : 4)
  return tex
}

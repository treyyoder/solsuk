export const ATMO_VERT = /* glsl */ `
  varying vec3 vPosW;
  void main() {
    vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
  }
`

/**
 * Edge-free atmospheric limb glow. Instead of a fresnel rim on a shell (which
 * peaks at the shell's own silhouette and cuts off there — the "soap bubble"),
 * brightness is a function of the view ray's IMPACT PARAMETER b: its closest
 * approach to the planet center. Density falls off exponentially with height
 * (b − R): a tight bright band hugging the limb plus a broad faint halo, both
 * dissipating to nothing well inside the shell geometry — so no visible edge.
 */
export const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uColor;
  uniform float uSurfaceR;
  varying vec3 vPosW;
  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vPosW - ro);
    // closest approach of the view ray to the planet center (origin)
    float tMin = max(-dot(ro, rd), 0.0);
    vec3 pMin = ro + rd * tMin;
    float b = length(pMin);
    float h = max(b - uSurfaceR, 0.0);

    // two-scale exponential falloff: dense band + thin outer haze
    float density = exp(-h / 0.055) + 0.32 * exp(-h / 0.22);
    density = min(density, 1.3);

    // over the planet's disc the surface shader carries the rim — keep only a
    // soft spill that grows toward the limb
    float limb = smoothstep(uSurfaceR * 0.70, uSurfaceR * 0.995, b);

    // day side bright, fading through the terminator, faint airglow at night
    vec3 nMin = normalize(pMin);
    float lit = clamp(dot(nMin, uSunDir) * 0.7 + 0.42, 0.05, 1.0);

    // whiter right at the horizon, deeper blue as it thins out
    vec3 col = mix(uColor, vec3(0.85, 0.93, 1.0), clamp(density * 0.55, 0.0, 0.75));

    float a = density * limb * lit;
    gl_FragColor = vec4(col * a * 1.55, a);
  }
`

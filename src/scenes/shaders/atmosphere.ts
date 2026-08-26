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

    // two-scale exponential falloff: dense band + a stronger blue outer haze
    float density = exp(-h / 0.05) + 0.5 * exp(-h / 0.24);
    density = min(density, 1.3);

    // over the planet's disc the surface shader carries the rim — keep only a
    // soft spill that grows toward the limb
    float limb = smoothstep(uSurfaceR * 0.70, uSurfaceR * 0.995, b);

    // day side bright, fading through the terminator, faint airglow at night
    vec3 nMin = normalize(pMin);
    float lit = clamp(dot(nMin, uSunDir) * 0.7 + 0.42, 0.05, 1.0);

    // blue gradient with altitude: translucent earth-blue at the horizon —
    // no white-hot core — deepening into indigo as the air thins into space;
    // transitions sit where the density is still bright enough to show them
    vec3 cHorizon = vec3(0.42, 0.68, 1.0);
    vec3 cDeep = vec3(0.05, 0.13, 0.45);
    vec3 col = mix(cHorizon, uColor, smoothstep(0.008, 0.055, h));
    col = mix(col, cDeep, smoothstep(0.12, 0.34, h));

    // kept below the bloom threshold so the horizon stays a transparent blue
    // instead of blowing out to white
    float a = density * limb * lit;
    gl_FragColor = vec4(col * a * 1.05, a * 0.85);
  }
`

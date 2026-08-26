export const SUN_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const SUN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uBoost;
  varying vec3 vNormal;
  varying vec3 vPos;

  // cheap 3D value noise + fbm — granulation churn
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = normalize(vPos);
    float granules = fbm(p * 6.0 + vec3(uTime * 0.05, uTime * 0.03, 0.0));
    float cells = fbm(p * 18.0 - vec3(0.0, uTime * 0.08, uTime * 0.04));
    float surface = granules * 0.7 + cells * 0.3;

    // limb darkening
    float limb = pow(max(vNormal.z, 0.0), 0.55);

    vec3 core = vec3(1.0, 0.86, 0.55);
    vec3 hot = vec3(1.0, 0.98, 0.9);
    vec3 cool = vec3(0.95, 0.45, 0.12);
    vec3 color = mix(cool, mix(core, hot, surface), 0.45 + surface * 0.55);
    color *= (0.55 + limb * 0.75);
    gl_FragColor = vec4(color * uBoost, 1.0);
  }
`

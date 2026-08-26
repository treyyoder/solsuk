export const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
  }
`

export const EARTH_FRAG = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecMap;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPosW);
    float ndl = dot(n, uSunDir);
    float dayNight = smoothstep(-0.12, 0.18, ndl);

    vec3 day = texture2D(uDayMap, vUv).rgb;
    vec3 night = texture2D(uNightMap, vUv).rgb;
    float oceanMask = texture2D(uSpecMap, vUv).r;

    // city lights glow warm; suppress them fully on the day side
    vec3 nightLit = night * vec3(1.15, 0.95, 0.72) * 1.6;

    // day shading: wrap diffuse a touch so the terminator isn't pitch-hard
    float diffuse = clamp(ndl * 0.9 + 0.1, 0.0, 1.0);
    vec3 dayLit = day * diffuse;

    // ocean specular glint
    vec3 halfDir = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 48.0) * oceanMask * dayNight;
    dayLit += vec3(1.0, 0.95, 0.85) * spec * 0.55;

    // faint blue atmospheric rim on the lit limb
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.6) * dayNight;
    dayLit += vec3(0.28, 0.5, 0.9) * rim * 0.35;

    vec3 color = mix(nightLit, dayLit, dayNight);
    gl_FragColor = vec4(color, 1.0);
  }
`

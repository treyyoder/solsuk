export const ATMO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
  }
`

export const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uColor;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vPosW);
    // rendered on the BackSide: rim glow strongest at the limb
    float rim = pow(1.0 - abs(dot(viewDir, n)), 2.8);
    // brighter on the sunlit side, faint blue wrap on the night side
    float lit = clamp(dot(n, uSunDir) * 0.6 + 0.45, 0.06, 1.0);
    gl_FragColor = vec4(uColor * rim * lit * 1.6, rim * lit);
  }
`

# SOLSUK — Orbital Compute Net

A cinematic simulation of the orbital compute era: forty-eight solar-powered AI data centers
netted around a photoreal Earth, the Sun burning in the distance, and an inhabited Moon below —
all against the real night sky.

## What it does

- **Photoreal Earth** — NASA-derived day/night/cloud imagery with a custom terminator shader
  (city lights fade in across the twilight band), ocean specular, and an atmospheric rim.
- **48-satellite fleet** in three orbital shells (53° LEO, 97° polar, 30° MEO), each a spherical
  hub with sun-tracking solar-panel arms, rendered as instanced meshes with live eclipse tinting.
  Click any satellite (or its row in the fleet list) to chase it and inspect **compute**
  (effective exaFLOPS, utilization, GPU pods, jobs), **solar** (array MW, illumination, battery),
  and **transmission** (optical crosslinks, ground-station visibility, downlink, latency) — all
  ticking from a 10 Hz simulation with real shadow-cylinder eclipse math.
- **The Sun** — an fbm-granulation shader sphere with corona sprites; it drives the scene's key
  light, every satellite's solar output, and Earth's terminator.
- **The Moon** — real albedo imagery, correct phase, tidally locked, with five clickable bases
  reporting inhabitants, O₂ saturation, running experiments, power, and armed warhead counts.
- **The real sky** — 2,865 stars (HYG database, mag ≤ 5.5, tinted by B–V color index) and all
  88 IAU constellation figures as great-circle arcs.
- Free orbit/pan/zoom POV with follow-cam on moving targets, breadcrumb navigation, Esc to step
  out, quality presets, and graceful degradation on hardened browsers (WebGL2 banner, functional
  float-RT probing, DPR clamped to the reported texture limit).

Dev/test hooks: `?enter=1` (skip landing), `?focus=sat:SAT-07 | moon | moon:tycho | sun | earth`,
`?diag=1` (on-screen diagnostics), `?no3d=1` / `?nofx=1` / `?dpr=N`.

## Stack

React 19 · TypeScript · Vite · Three.js · React Three Fiber · drei · postprocessing · Zustand ·
Tailwind CSS 4. Simulation logic (`src/simulation/`) is pure and renderer-agnostic; positions run
per-frame outside React while stats flow through a 10 Hz zustand snapshot.

## Develop

```bash
npm install
npm run dev        # http://localhost:5179
npm run build
```

Assets are committed; regenerate with `node scripts/fetch-assets.mjs` and
`node scripts/build-stars.mjs` if sources update.

## Asset licenses & attribution

- Earth/Moon textures: [Solar System Scope](https://www.solarsystemscope.com/textures/) — CC-BY-4.0
- Earth specular map: [three.js examples](https://github.com/mrdoob/three.js) — MIT
- Star catalog: [HYG Database](https://github.com/astronexus/HYG-Database) — CC-BY-SA-4.0
- Constellation figures: [d3-celestial](https://github.com/ofrohn/d3-celestial) — BSD-3-Clause

All simulation figures (compute, solar, lunar bases, armaments) are fictional.

## Deploy

Multi-stage `Dockerfile` (node build → nginx). Push to `master` → GitHub webhook → Jenkins builds
`registry.treyyoder.com/solsuk` → Portainer Git-stack webhook redeploys (port 8103).

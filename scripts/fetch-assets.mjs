/**
 * One-time authoring script: downloads the planet textures into public/textures/.
 * Outputs are COMMITTED — builds never touch the network.
 * Licenses: Solar System Scope textures CC-BY-4.0; three.js example texture MIT;
 * NASA SVS CGI Moon Kit public domain. Attribution in README.md.
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (f) => join(root, 'public', 'textures', f)

const SSS = 'https://www.solarsystemscope.com/textures/download'
const MANIFEST = [
  { url: `${SSS}/2k_earth_daymap.jpg`, dest: 'earth_day_2k.jpg' },
  { url: `${SSS}/8k_earth_daymap.jpg`, dest: 'earth_day_8k.jpg' },
  { url: `${SSS}/2k_earth_nightmap.jpg`, dest: 'earth_night_2k.jpg' },
  { url: `${SSS}/8k_earth_nightmap.jpg`, dest: 'earth_night_8k.jpg' },
  { url: `${SSS}/2k_earth_clouds.jpg`, dest: 'earth_clouds_2k.jpg' },
  { url: `${SSS}/2k_moon.jpg`, dest: 'moon_2k.jpg' },
  { url: `${SSS}/8k_moon.jpg`, dest: 'moon_8k.jpg' },
  {
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg',
    dest: 'earth_specular_2k.jpg',
  },
]

await mkdir(join(root, 'public', 'textures'), { recursive: true })

let total = 0
for (const { url, dest } of MANIFEST) {
  const target = out(dest)
  try {
    await access(target)
    console.log(`skip     ${dest} (exists)`)
    continue
  } catch {
    /* not downloaded yet */
  }
  process.stdout.write(`fetching ${dest} … `)
  const res = await fetch(url, { headers: { 'User-Agent': 'solsuk-asset-fetch' } })
  if (!res.ok) {
    console.error(`\nFAILED ${url} → HTTP ${res.status}. Grab it manually from https://www.solarsystemscope.com/textures/`)
    process.exitCode = 1
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(target, buf)
  total += buf.length
  console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`)
}
console.log(`done — ${(total / 1024 / 1024).toFixed(1)} MB downloaded this run`)

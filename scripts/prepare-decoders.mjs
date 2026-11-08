import { cp, mkdir } from 'node:fs/promises'

const source = new URL('../node_modules/three/examples/jsm/libs/', import.meta.url)
const target = new URL('../public/decoders/', import.meta.url)
await mkdir(target, { recursive: true })
await Promise.all([
  cp(new URL('draco/gltf/', source), new URL('draco/', target), { recursive: true }),
  cp(new URL('basis/', source), new URL('basis/', target), { recursive: true }),
])

import * as T from 'three'
import type { SceneKind, XYZ } from '../content'

const paint = () => new T.MeshPhysicalMaterial({
  color: '#39567b', metalness: 0.76, roughness: 0.23, clearcoat: 1, clearcoatRoughness: 0.055, flatShading: false,
})
const steel = (color = '#b9c8d6', roughness = 0.34) =>
  new T.MeshStandardMaterial({ color, metalness: 0.8, roughness })
const matte = (color: string) => new T.MeshStandardMaterial({ color, roughness: 0.73 })

function group(parent: T.Object3D, name: string, position: XYZ = [0, 0, 0]) {
  const object = new T.Group()
  object.name = name
  object.position.set(...position)
  parent.add(object)
  return object
}

function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, position: XYZ = [0, 0, 0]) {
  const object = new T.Mesh(geometry, material)
  object.position.set(...position)
  parent.add(object)
  return object
}

function box(parent: T.Object3D, material: T.Material, size: XYZ, position: XYZ = [0, 0, 0]) {
  return mesh(parent, new T.BoxGeometry(...size), material, position)
}

function cylinder(parent: T.Object3D, material: T.Material, radius: number, length: number, position: XYZ, axis = 'y', segments = 32) {
  const object = mesh(parent, new T.CylinderGeometry(radius, radius, length, segments), material, position)
  if (axis === 'x') object.rotation.z = Math.PI / 2
  if (axis === 'z') object.rotation.x = Math.PI / 2
  return object
}

function torus(parent: T.Object3D, material: T.Material, radius: number, tube: number, position: XYZ) {
  return mesh(parent, new T.TorusGeometry(radius, tube, 10, 52), material, position)
}

function surface(rows: number, columns: number, point: (u: number, v: number) => XYZ) {
  const positions: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      positions.push(...point(row / rows, column / columns))
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column
        const b = a + columns + 1
        indices.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

type Profile = [x: number, top: number, width: number, bottom: number]

function profileAt(profiles: Profile[], t: number): Profile {
  const progress = t * (profiles.length - 1)
  const i = Math.min(Math.floor(progress), profiles.length - 2)
  const local = progress - i
  return profiles[i].map((value, j) => T.MathUtils.lerp(value, profiles[i + 1][j], local)) as Profile
}

function loft(parent: T.Object3D, material: T.Material, profiles: Profile[], curvature = 0.10) {
  return mesh(parent, surface((profiles.length - 1) * 6, 24, (u, v) => {
    const [x, top, width, bottom] = profileAt(profiles, u)
    const angle = (v - 0.5) * Math.PI * 2
    const crown = Math.cos(angle)
    const z = width * Math.sin(angle)
    const y = crown >= 0 ? top - curvature * (1 - crown) : T.MathUtils.lerp(top - curvature, bottom, -crown)
    return [x, y, z]
  }), material)
}

function ellipsoid(parent: T.Object3D, material: T.Material, dimensions: XYZ, position: XYZ) {
  const object = mesh(parent, new T.SphereGeometry(1, 22, 12), material, position)
  object.scale.set(...dimensions)
  return object
}

function rim(parent: T.Object3D, rubber: T.Material, metal: T.Material, dark: T.Material, scale: number) {
  const wheel = group(parent, 'alloy_and_tire')
  wheel.scale.setScalar(scale)
  const tire = torus(wheel, rubber, 0.292, 0.074, [0, 0, 0])
  tire.scale.z = 1.55
  for (const side of [-1, 1]) {
    torus(wheel, metal, 0.253, 0.014, [0, 0, side * 0.087])
    cylinder(wheel, dark, 0.238, 0.014, [0, 0, side * 0.027], 'z')
    cylinder(wheel, metal, 0.061, 0.09, [0, 0, side * 0.043], 'z', 24)
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5
      const spoke = box(wheel, metal, [0.205, 0.022, 0.03],
        [Math.cos(angle) * 0.151, Math.sin(angle) * 0.151, side * 0.073])
      spoke.rotation.z = angle + (i % 2 ? -0.16 : 0.16)
    }
  }
  return wheel
}

export function makeCar() {
  const car = new T.Group()
  car.name = 'RR_Coupe'
  const shell = paint()
  shell.side = T.DoubleSide
  const trim = matte('#273948')
  const rubber = matte('#222b33')
  const metal = steel()
  const frame = steel('#71899c', 0.48)
  const window = new T.MeshPhysicalMaterial({
    color: '#273d50', metalness: 0.5, roughness: 0.17, clearcoat: 0.9, side: T.DoubleSide,
  })
  const lamp = new T.MeshPhysicalMaterial({
    color: '#e4f4ff', metalness: 0.34, roughness: 0.16, emissive: '#86b5da', emissiveIntensity: 0.38,
  })
  const red = new T.MeshPhysicalMaterial({ color: '#ae4e5e', metalness: 0.38, roughness: 0.22 })
  const floor = group(car, 'chassis')
  box(floor, frame, [3.95, 0.075, 1.37], [0.01, 0.32, 0])
  for (const side of [-1, 1]) {
    box(floor, frame, [3.78, 0.12, 0.095], [0.02, 0.38, side * 0.55])
    box(floor, trim, [1.89, 0.105, 0.09], [0.07, 0.30, side * 0.83])
    for (const x of [-1.39, 1.36]) {
      const wheel = rim(floor, rubber, metal, trim, 1)
      wheel.position.set(x, 0.372, side * 0.83)
      cylinder(floor, frame, 0.043, 1.65, [x, 0.37, 0], 'z', 12)
    }
    const seat = group(floor, 'seat', [0.3, 0.42, side * 0.29])
    box(seat, trim, [0.52, 0.1, 0.4], [0, 0.03, 0])
    const backrest = box(seat, trim, [0.095, 0.46, 0.39], [0.22, 0.26, 0])
    backrest.rotation.z = -0.15
  }
  box(floor, trim, [0.22, 0.15, 1.35], [-0.58, 0.68, 0])
  box(floor, frame, [0.14, 0.09, 1.44], [1.91, 0.49, 0])

  const hood = group(car, 'hood', [-0.65, 0.79, 0])
  loft(hood, shell, [[-1.57, -0.20, 0.69, -0.27], [-1.42, -0.12, 0.73, -0.22],
    [-1.1, -0.06, 0.74, -0.15], [-0.6, -0.015, 0.73, -0.11], [-0.06, 0.01, 0.75, -0.08]], 0.09)
  const trunk = group(car, 'rear_spoiler', [1.48, 0.75, 0])
  loft(trunk, shell, [[-0.24, 0.11, 0.73, -0.04], [0.16, 0.06, 0.78, -0.09], [0.49, 0, 0.81, -0.13],
    [0.66, -0.09, 0.77, -0.19]], 0.08)

  const bumper = group(car, 'bumper_front', [-2.02, 0.38, 0])
  loft(bumper, shell, [[-0.26, 0.13, 0.63, -0.1], [-0.19, 0.22, 0.79, -0.14],
    [0, 0.24, 0.88, -0.15], [0.27, 0.22, 0.89, -0.12]], 0.12)
  ellipsoid(bumper, trim, [0.038, 0.098, 0.46], [-0.263, 0.005, 0])
  for (const side of [-1, 1]) ellipsoid(bumper, trim, [0.035, 0.058, 0.115], [-0.22, 0.006, side * 0.61])
  const rear = group(car, 'bumper_rear', [1.99, 0.40, 0])
  loft(rear, shell, [[-0.17, 0.22, 0.92, -0.12], [0.03, 0.23, 0.90, -0.15],
    [0.21, 0.20, 0.81, -0.12], [0.24, 0.16, 0.69, -0.11]], 0.1)
  ellipsoid(rear, red, [0.035, 0.026, 0.69], [0.21, 0.158, 0])

  const glass = group(car, 'glass', [0.23, 0.75, 0])
  loft(glass, window, [[-0.94, 0.04, 0.72, 0], [-0.59, 0.33, 0.67, 0],
    [-0.26, 0.53, 0.59, 0], [0.16, 0.56, 0.57, 0], [0.47, 0.46, 0.60, 0],
    [0.8, 0.24, 0.66, 0], [1.19, 0.06, 0.72, 0]], 0.16)
  const roof = group(car, 'roof', [0.22, 1.22, 0])
  loft(roof, shell, [[-0.29, 0.049, 0.50, 0.005], [-0.15, 0.092, 0.47, 0.04], [0.15, 0.105, 0.47, 0.06],
    [0.4, 0.06, 0.52, 0.01], [0.53, -0.02, 0.54, -0.05]], 0.08)
  for (const side of [-1, 1]) {
    const left = side === 1 ? 'L' : 'R'
    const door = group(car, 'door_F' + left, [0.045, 0.56, side * 0.79])
    mesh(door, surface(16, 8, (u, v) => {
      const bulge = Math.sin(Math.PI * u)
      return [-0.84 + u * 1.72, -0.24 + v * (0.48 + 0.022 * bulge),
        side * (0.012 + 0.09 * Math.sin(v * Math.PI) * (0.5 + 0.5 * bulge) + u * 0.028)]
    }), shell)
    ellipsoid(door, trim, [0.087, 0.013, 0.01], [0.42, 0.162, side * 0.077])
    const mirror = group(car, 'mirror_' + left, [-0.49, 0.84, side * 0.91])
    ellipsoid(mirror, trim, [0.084, 0.027, 0.15], [0, -0.019, 0])
    ellipsoid(mirror, shell, [0.125, 0.057, 0.10], [0.02, 0.02, side * 0.13])
    for (const end of [-1, 1]) {
      const x = end < 0 ? -1.39 : 1.36
      const fender = group(car, 'fender_' + (end < 0 ? 'F' : 'R') + left, [x, 0.37, side * 0.81])
      mesh(fender, surface(32, 10, (u, v) => {
        const along = (u - 0.5) * 1.16
        const arch = Math.abs(along) < 0.388 ? Math.sqrt(0.388 ** 2 - along ** 2) : -0.07
        const top = 0.40 + 0.045 * Math.sin(Math.PI * u) + (end === 1 ? 0.025 : -0.045)
        return [along, T.MathUtils.lerp(arch, top, v),
          side * (0.125 * Math.sin(Math.PI * u) * Math.sin(v * Math.PI * 0.79) - 0.09 * v ** 3)]
      }), shell)
    }
    const light = group(car, 'headlight_' + left, [-1.86, 0.654, side * 0.72])
    const bezel = ellipsoid(light, trim, [0.236, 0.048, 0.137], [0, 0, 0])
    const lens = ellipsoid(light, lamp, [0.216, 0.033, 0.12], [0, 0.022, 0])
    bezel.rotation.z = lens.rotation.z = 0.26
    ellipsoid(light, metal, [0.104, 0.025, 0.075], [0.022, 0.038, 0])
  }
  return car
}

export function makeEngine() {
  const root = new T.Group()
  root.name = 'RR_FlatSixDiagram'
  const alloy = steel('#9ba8b1', 0.44)
  const polished = steel('#b7bec4', 0.30)
  const graphite = matte('#31373e')
  const cover = steel('#8c4d3b', 0.38)
  const crankcase = group(root, 'crankcase', [0, 0.38, 0.58])
  box(crankcase, alloy, [0.61, 0.59, 1.16])
  box(crankcase, graphite, [0.52, 0.15, 1.1], [0, -0.28, 0])
  cylinder(crankcase, polished, 0.06, 1.32, [0, 0.04, 0], 'z')

  const intake = group(root, 'intake_manifold', [0, 0.87, 0.51])
  box(intake, cover, [0.50, 0.12, 0.94])
  const exhaust = group(root, 'exhaust', [0, 0.21, -0.14])
  for (const side of [-1, 1]) {
    const bank = group(root, side > 0 ? 'bank_left' : 'bank_right', [0.47 * side, 0.42, 0.58])
    box(bank, alloy, [0.34, 0.49, 1.15])
    box(bank, cover, [0.06, 0.39, 1.04], [0.20 * side, 0, 0])
    for (const z of [-0.35, 0, 0.35]) {
      cylinder(bank, polished, 0.14, 0.34, [0, 0.05, z], 'x')
      const pipe = new T.CatmullRomCurve3([
        new T.Vector3(0.16 * side, 0, z),
        new T.Vector3(0.37 * side, 0, z),
        new T.Vector3(0.49 * side, -0.20, z),
      ])
      mesh(intake, new T.TubeGeometry(pipe, 12, 0.038, 8, false), polished)
      const runner = new T.CatmullRomCurve3([
        new T.Vector3(0.45 * side, 0.12, 0.72 + z),
        new T.Vector3(0.68 * side, 0.03, 0.58 + z),
        new T.Vector3(0.69 * side, 0, 0.33),
        new T.Vector3(0.50 * side, 0, -0.54),
      ])
      mesh(exhaust, new T.TubeGeometry(runner, 18, 0.032, 8, false), polished)
    }
    cylinder(exhaust, graphite, 0.105, 0.46, [0.48 * side, 0, -0.68], 'z')
  }

  const drive = group(root, 'accessory_drive', [0, 0.42, 1.22])
  box(drive, graphite, [0.66, 0.45, 0.11])
  for (const [x, y, radius] of [[0, -0.09, 0.13], [0.21, 0.05, 0.07], [-0.21, 0.05, 0.07]]) {
    cylinder(drive, polished, radius, 0.06, [x, y, 0.075], 'z', 24)
  }

  const transmission = group(root, 'transmission', [0, 0.40, -0.46])
  cylinder(transmission, alloy, 0.33, 0.32, [0, 0, 0.29], 'z')
  cylinder(transmission, graphite, 0.24, 0.64, [0, 0, -0.12], 'z')
  cylinder(transmission, polished, 0.09, 0.23, [0, 0, -0.53], 'z')
  return root
}

export function makeBrake() {
  const root = new T.Group()
  root.name = 'RR_Brake'
  const satin = steel('#b5c7d6')
  const bright = steel('#dae3ea', 0.24)
  const dark = matte('#273b4a')
  const rubber = matte('#29323b')
  const blue = new T.MeshPhysicalMaterial({ color: '#5c82ad', metalness: 0.67, roughness: 0.24, clearcoat: 0.6 })
  const wheel = group(root, 'wheel', [0, 0.70, 0.21])
  rim(wheel, rubber, satin, dark, 1.89)

  const rotor = group(root, 'rotor', [0, 0.70, 0.02])
  const disc = new T.Shape()
  disc.absarc(0, 0, 0.48, 0, Math.PI * 2, false)
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 3; j++) {
      const a = i * Math.PI / 8 + j * 0.08
      const r = 0.34 + j * 0.044
      const hole = new T.Path()
      hole.absarc(r * Math.cos(a), r * Math.sin(a), 0.014, 0, Math.PI * 2, true)
      disc.holes.push(hole)
    }
  }
  mesh(rotor, new T.ExtrudeGeometry(disc, { depth: 0.054, bevelEnabled: false, curveSegments: 24 }), bright)
  torus(rotor, satin, 0.475, 0.011, [0, 0, 0.055])
  cylinder(rotor, dark, 0.22, 0.11, [0, 0, 0.045], 'z')
  cylinder(rotor, satin, 0.089, 0.14, [0, 0, 0.064], 'z')
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5
    cylinder(rotor, bright, 0.023, 0.028, [Math.cos(a) * 0.145, Math.sin(a) * 0.145, 0.11], 'z', 6)
  }
  const caliper = group(root, 'caliper', [0.40, 0.89, 0.03])
  const caliperShell = ellipsoid(caliper, blue, [0.115, 0.25, 0.142], [0, 0, 0])
  caliperShell.rotation.z = -0.45
  box(caliper, blue, [0.152, 0.24, 0.24], [0.011, -0.026, 0])
  for (const y of [-0.083, 0.081]) cylinder(caliper, bright, 0.025, 0.032, [0.015, y, 0.132], 'z', 6)

  const damper = group(root, 'damper', [0.13, 1.19, -0.35])
  damper.rotation.z = -0.21
  cylinder(damper, dark, 0.104, 0.76, [0, -0.17, 0])
  cylinder(damper, bright, 0.058, 0.64, [0, 0.30, 0])
  for (const y of [-0.35, 0.5]) cylinder(damper, satin, 0.175, 0.043, [0, y, 0])
  const spring = group(root, 'spring', [0.13, 1.19, -0.35])
  spring.rotation.z = -0.21
  const helix = new T.CatmullRomCurve3(Array.from({ length: 121 }, (_, i) => {
    const t = i / 120
    const angle = t * Math.PI * 12
    return new T.Vector3(Math.cos(angle) * 0.15, t * 0.80 - 0.32, Math.sin(angle) * 0.15)
  }))
  mesh(spring, new T.TubeGeometry(helix, 144, 0.028, 9, false), blue)
  return root
}

export const procedural: Record<SceneKind, () => T.Group> = {
  body: makeCar, engine: makeEngine, brake: makeBrake,
}


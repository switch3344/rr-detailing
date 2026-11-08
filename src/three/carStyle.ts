import * as T from 'three'
import config from './car-config.json'

type Finish = { name: string; color: string; metalness: number; roughness: number; clearcoat?: number;
  clearcoatRoughness?: number; sheen?: number; anisotropy?: number; envMapIntensity?: number;
  emissive?: string; emissiveIntensity?: number; normalScale?: number; textureRepeat?: number }
const finishes = Object.values(config.materials) as Finish[]
const textures = new Map<number, T.DataTexture>()
function grain(repeat: number) {
  if (textures.has(repeat)) return textures.get(repeat)!
  const size = config.detail.textureSize
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    const q = Math.cos(x * 269.5 + y * 183.3) * 23713.123
    pixels.set([128 + (n - Math.floor(n) - .5) * 255 * config.detail.normalAmplitude,
      128 + (q - Math.floor(q) - .5) * 255 * config.detail.normalAmplitude, 255, 255], (y * size + x) * 4)
  }
  const texture = new T.DataTexture(pixels, size, size)
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.repeat.setScalar(repeat)
  texture.minFilter = T.LinearMipmapLinearFilter
  texture.magFilter = T.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  textures.set(repeat, texture)
  return texture
}

export function styleCar(scene: T.Group, gl: T.WebGLRenderer, lowCost = false) {
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  scene.traverse(object => {
    if (!(object instanceof T.Mesh)) return
    for (const material of [object.material].flat()) {
      if (!(material instanceof T.MeshStandardMaterial)) continue
      const finish: Finish | undefined = material.name === 'RR Roof Paint' ? config.materials.paint : finishes.find(value => value.name === material.name)
      if (finish) {
        material.color.set(finish.color)
        material.metalness = finish.metalness
        material.roughness = finish.roughness
        material.envMapIntensity = finish.envMapIntensity ?? 1
        if (finish.emissive) material.emissive.set(finish.emissive)
        material.emissiveIntensity = finish.emissiveIntensity ?? 0
        if (material instanceof T.MeshPhysicalMaterial) {
          material.clearcoat = finish.clearcoat ?? 0
          material.clearcoatRoughness = finish.clearcoatRoughness ?? 0
          material.sheen = finish.sheen ?? 0
          material.sheenColor.set(finish.color)
          material.anisotropy = finish.anisotropy ?? 0
          if (finish.name === config.materials.paint.name) {
            material.clearcoatNormalMap = grain(finish.textureRepeat!)
            material.clearcoatNormalScale.setScalar(finish.normalScale!)
          }
        }
        if (finish.textureRepeat && finish.name !== config.materials.paint.name) {
          material.normalMap = grain(finish.textureRepeat)
          material.normalScale.setScalar(finish.normalScale!)
        }
      }
      const optical = material.name === config.materials.glass.name || material.name === config.materials.lens.name
      if (optical && material instanceof T.MeshPhysicalMaterial) {
        const lens = material.name === config.materials.lens.name
        material.color.set(lens ? config.materials.lens.color : config.materials.glass.color)
        material.transmission = lens ? config.materials.lens.transmission : config.glass.transmission
        material.ior = config.glass.ior
        material.thickness = lens ? config.materials.lens.thickness : config.glass.thickness
        material.attenuationColor.set(config.glass.attenuationColor)
        material.attenuationDistance = config.glass.attenuationDistance
        material.specularIntensity = config.glass.specularIntensity
        material.envMapIntensity = lens ? config.materials.lens.envMapIntensity : config.glass.envMapIntensity
        material.opacity = 1
        material.transparent = false
        material.depthWrite = false
        material.side = T.DoubleSide
        material.userData.rrKeepOpaque = true
        object.renderOrder = lens ? config.glass.renderOrder - 1 : config.glass.renderOrder
        if(lowCost) {
          material.transmission=0
          material.transparent=true
          material.opacity=config.glass.lowCostOpacity
          material.roughness=config.glass.lowCostRoughness
          material.envMapIntensity=config.glass.lowCostReflection
          material.forceSinglePass=true
        }
      }
      if (material.name === 'RR Optional Tint') {
        object.visible = config.glass.tintAmount > 0
        object.renderOrder = config.glass.renderOrder + 1
        material.transparent = true
        material.opacity = config.glass.tintAmount * config.glass.tintMaxOpacity
        material.depthWrite = false
        material.side = T.DoubleSide
      }
      if (material.name.startsWith('RR Interior')) material.userData.rrKeepOpaque = true
      for (const value of Object.values(material)) if (value instanceof T.Texture) value.anisotropy = anisotropy
      material.needsUpdate = true
    }
  })
}

export function poseWheels(scene: T.Group) {
  for (const name of ['Steering_front_L', 'Steering_front_R']) {
    const joint = scene.getObjectByName(name)
    if (joint) joint.rotation.y = T.MathUtils.degToRad(config.pose.steerAngle)
  }
  for (const corner of ['front_L','front_R','rear_L','rear_R']) {
    const spin = scene.getObjectByName('Wheel_Spin_' + corner)
    if (spin) spin.rotation.z = T.MathUtils.degToRad(config.pose.wheelSpin)
  }
}

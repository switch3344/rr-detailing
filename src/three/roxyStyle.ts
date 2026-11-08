import * as T from 'three'

/** Preserve the supplied Roxy atlas, metallic maps and authored normals. */
export function styleRoxy(model:T.Group,gl:T.WebGLRenderer) {
  const anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy())
  model.traverse(object=>{
    if(!(object instanceof T.Mesh))return
    const window=/^Glass-(Glass_|RearWindows)/.test(object.name)
    if(window)object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone()
    for(const material of [object.material].flat()){
      if(!(material instanceof T.MeshStandardMaterial))continue
      material.flatShading=false
      material.envMapIntensity=material.name==='Body'?.85:.6
      if(['Body','Chassis','Interior'].includes(material.name)){
        material.transparent=false;material.opacity=1;material.alphaTest=.12;material.depthWrite=true
      }
      if(material.name==='Interior')material.userData.rrKeepOpaque=true
      if(window){
        material.transparent=true;material.opacity=.9;material.depthWrite=false;material.side=T.DoubleSide
        material.metalness=0;material.roughness=.075;material.envMapIntensity=.35
        material.userData.rrKeepOpaque=true;object.renderOrder=20
        if(material instanceof T.MeshPhysicalMaterial){material.transmission=0;material.clearcoat=.15;material.specularIntensity=.3}
      }
      for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=anisotropy
      material.needsUpdate=true
    }
  })
}

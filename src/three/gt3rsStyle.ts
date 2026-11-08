import * as T from 'three'

/** The supplied GTA export stores dirt/utility maps in albedo slots.
 * Keep its geometry, proper colour/normal maps, and restore physical materials. */
export function styleGT3RS(model:T.Group,gl:T.WebGLRenderer) {
  const finishes=new Map<string,T.Material>()
  const anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy())
  model.traverse(object=>{
    if(!(object instanceof T.Mesh))return
    const sourceNode=String(object.userData.sourceNode||object.name)
    const paintNode=/RS_(bodyshell|bumper_f|door_|extra_)/.test(object.name)
    const apply=(source:T.Material)=>{
      if(!(source instanceof T.MeshStandardMaterial))return source
      const glass=/^(glass|glasswindows)|_percent_alpha/i.test(source.name)&&!source.name.includes('label')
      const tire=source.name.startsWith('mic_black')
      const interior=/seat_|steeringwheel/.test(sourceNode)||/interior_|alcantara|leather|fabric/i.test(source.name)
      const black=/^(black|dinghyblack)|carbon/i.test(source.name)
      const caliper=/hub_/.test(sourceNode)&&/SECONDARY/.test(source.name)
      const exhaust=object.userData.role==='exhaust'
      const paint=!interior&&!black&&!glass&&!tire&&(/^vehicle_generic_smallspecmap \[(PRIMARY|SECONDARY)\]/.test(source.name)||paintNode&&/^Material\./.test(source.name))
      const key=source.uuid+':'+[glass,tire,interior,caliper,paint,exhaust].join(',')
      if(finishes.has(key))return finishes.get(key)!
      let material:T.MeshStandardMaterial=source.clone()
      if(paint&&!(material instanceof T.MeshPhysicalMaterial)){
        const physical=new T.MeshPhysicalMaterial()
        T.MeshStandardMaterial.prototype.copy.call(physical,material);material=physical
      }
      const utility=material.map&&/vehicle_genericmud_car|blank_normal|flat[_-]nm|_nrml|_nrm|_normal/i.test(material.map.name)
      if(utility)material.map=null
      material.flatShading=false;material.envMapIntensity=.7
      material.transparent=glass;material.opacity=glass?.18:1;material.depthWrite=!glass
      material.alphaTest=!glass&&/label|opac|badge|grill|stitch|logo/i.test(source.name)?.10:0
      if(black){material.color.set('#171c22');material.metalness=.15;material.roughness=.48}
      if(paint){material.color.set('#65717c');material.metalness=.65;material.roughness=.28}
      if(caliper){material.color.set('#cda521');material.metalness=.2;material.roughness=.3}
      if(interior){material.color.set('#353b43');material.metalness=0;material.roughness=.8;material.userData.rrKeepOpaque=true}
      if(/chrome|metal037/.test(source.name)){material.color.set('#a3aab3');material.metalness=.9;material.roughness=.3}
      if(glass){material.map=null;material.color.set('#ecf1f5');material.metalness=0;material.roughness=.075;material.envMapIntensity=.3;material.side=T.DoubleSide;material.userData.rrKeepOpaque=true}
      if(tire){material.color.set('#171b20');material.metalness=0;material.roughness=.83;material.envMapIntensity=.25}
      if(exhaust){material.map=null;material.color.set(black?'#292f36':'#727c89');material.metalness=.85;material.roughness=.3;material.envMapIntensity=.9}
      if(material instanceof T.MeshPhysicalMaterial&&paint){material.clearcoat=.85;material.clearcoatRoughness=.06}
      for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=anisotropy
      material.needsUpdate=true;finishes.set(key,material);return material
    }
    object.material=Array.isArray(object.material)?object.material.map(apply):apply(object.material)
  })
}

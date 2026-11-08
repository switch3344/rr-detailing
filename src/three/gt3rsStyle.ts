import * as T from 'three'
import config from './car.config'
import manifest from './car.manifest.json'
const patterns=Object.fromEntries(Object.entries(manifest.patterns).map(([key,value])=>[key,new RegExp(value,'i')]))
let twill:T.DataTexture|undefined
function carbonNormal(){
 if(twill)return twill
 const size=64,data=new Uint8Array(size*size*4)
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const direction=(Math.floor(x/8)+Math.floor(y/8))%4<2?1:-1;data.set([128+direction*10,128-direction*10,255,255],(y*size+x)*4)}
 twill=new T.DataTexture(data,size,size);twill.wrapS=twill.wrapT=T.RepeatWrapping;twill.repeat.setScalar(config.materials.carbon.repeat);twill.generateMipmaps=true;twill.minFilter=T.LinearMipmapLinearFilter;twill.needsUpdate=true;return twill
}
export function styleGT3RS(model:T.Group,gl:T.WebGLRenderer){
 const finishes=new Map<string,T.MeshStandardMaterial>(),anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy())
 model.updateWorldMatrix(true,true)
 model.traverse(object=>{
  if(!(object instanceof T.Mesh))return
  const source=String(object.userData.sourceNode||object.name.replace(/^RS_/,''))
  if(manifest.hiddenGlassInner.includes(source)){object.visible=false;object.userData.rrServiceLayer=true}
  const bounds=new T.Box3().setFromObject(object)
  const withinCabin=bounds.min.x>-.95&&bounds.max.x<1.6&&bounds.min.y>.3&&bounds.max.y<1.4&&bounds.min.z>-.85&&bounds.max.z<.85
  const wing=/^extra_2/.test(source)
  const apply=(original:T.Material)=>{
   if(!(original instanceof T.MeshStandardMaterial))return original
   const name=original.name
   const tire=patterns.tire.test(name),rim=patterns.rimNode.test(source)&&patterns.rimMaterial.test(name)
   const lens=/headlight|taillight|brakelight|extralight|REAR_HOUSING|DRRDL|reversinglight/i.test(source)&&(/glass|percent_alpha|iced|light_diff/.test(name))
   const glass=!lens&&/^(glass|glasswindows)|_percent_alpha/i.test(name)&&!/label/.test(name)
   const carbon=!rim&&!tire&&(/carbon/i.test(name+' '+original.map?.name)||wing&&!/badge|chrome|black\.002/.test(name))
   const interior=!glass&&!lens&&!carbon&&(patterns.interiorMaterial.test(name+' '+original.map?.name)||/seat_|steeringwheel/.test(source)||/^chassis/.test(source)&&/^Material\.(002|035)$/.test(name)||withinCabin&&/^chassis/.test(source)&&!/badge|stitch|rpm|screen|chrome/.test(name))
   const stitching=/stitch|opac/i.test(name+' '+original.map?.name)
   const paint=!interior&&!carbon&&!glass&&!lens&&!tire&&!rim&&patterns.paintNode.test(source)&&patterns.paintMaterial.test(name)
   const caliper=/hub_/.test(source)&&/SECONDARY|calliperzone/i.test(name)
   const led=/extralight|DRRDL/.test(source)&&/light_diff|white/.test(name)
   const key=original.uuid+JSON.stringify([tire,rim,lens,glass,carbon,interior,paint,caliper,led,object.userData.role])
   if(finishes.has(key))return finishes.get(key)!
   let m:T.MeshStandardMaterial=original.clone()
   if((paint||glass||carbon||caliper||rim||lens)&&!(m instanceof T.MeshPhysicalMaterial)){const next=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(next,m);m=next}
   if(m.map&&patterns.utilityTexture.test(m.map.name))m.map=null
   if(m.normalMap&&/blank_normal|flat[_-]nm/i.test(m.normalMap.name))m.normalMap=null
   m.flatShading=false;m.transparent=false;m.opacity=1;m.depthWrite=true;m.polygonOffset=false;m.envMapIntensity=.65
   m.alphaTest=/label|opac|badge|stitch|logo/i.test(name+' '+original.map?.name)?.1:0
   if(stitching&&original.map){m.alphaMap=original.map;m.map=null;m.alphaTest=.45;m.color.set('#737d89');m.roughness=.9}
   if(/^(black|dinghyblack)/i.test(name)){m.color.set('#171c22');m.metalness=.1;m.roughness=.6}
   if(paint){const p=config.materials.paint;m.map=null;m.normalMap=null;m.color.set(p.color);m.metalness=p.metalness;m.roughness=p.roughness;m.envMapIntensity=p.envMapIntensity;const physical=m as T.MeshPhysicalMaterial;physical.clearcoat=p.clearcoat;physical.clearcoatRoughness=p.clearcoatRoughness;m.userData.rrRole='paint'}
   if(interior){const p=config.materials.leather;m.map=null;m.color.set(p.color);m.metalness=0;m.roughness=p.roughness;m.envMapIntensity=p.envMapIntensity;m.normalScale.setScalar(.12);m.emissive.set('#000');m.emissiveMap=null;m.emissiveIntensity=0;m.userData.rrKeepOpaque=true;m.userData.rrRole='interior'}
   if(glass||lens){const p=config.materials.glass;const physical=m as T.MeshPhysicalMaterial;m.map=null;m.normalMap=null;m.color.set(lens?'#edf4ff':p.color);m.roughness=p.roughness;m.metalness=0;m.transparent=true;m.opacity=lens?.10:p.opacity;m.depthWrite=false;m.side=T.FrontSide;m.envMapIntensity=p.envMapIntensity;physical.ior=p.ior;physical.transmission=0;physical.specularIntensity=.5;m.userData.rrKeepOpaque=true;m.userData.rrRole=glass?'glass':'lens'}
   if(tire){const p=config.materials.rubber;m.color.set(p.color);m.metalness=0;m.roughness=p.roughness;m.envMapIntensity=p.envMapIntensity}
   if(rim){const p=config.materials.rim;m.map=null;m.color.set(p.color);m.metalness=p.metalness;m.roughness=p.roughness;m.envMapIntensity=p.envMapIntensity;(m as T.MeshPhysicalMaterial).anisotropy=p.anisotropy}
   if(caliper){const p=config.materials.caliper;m.color.set(p.color);m.metalness=.2;m.roughness=p.roughness;(m as T.MeshPhysicalMaterial).clearcoat=p.clearcoat}
   if(carbon){const p=config.materials.carbon;m.map=null;m.color.set(p.color);m.metalness=p.metalness;m.roughness=p.roughness;m.normalMap=carbonNormal();m.normalScale.setScalar(p.normalScale);const physical=m as T.MeshPhysicalMaterial;physical.clearcoat=p.clearcoat;physical.clearcoatRoughness=p.clearcoatRoughness;physical.anisotropy=.2}
   if(led){m.emissive.set('#dce9fb');m.emissiveIntensity=.7}
   if(object.userData.role==='exhaust'){m.map=null;m.color.set('#727c89');m.metalness=.85;m.roughness=.3}
   for(const value of Object.values(m))if(value instanceof T.Texture)value.anisotropy=anisotropy
   m.needsUpdate=true;finishes.set(key,m);return m
  }
  object.material=Array.isArray(object.material)?object.material.map(apply):apply(object.material)
 })
}

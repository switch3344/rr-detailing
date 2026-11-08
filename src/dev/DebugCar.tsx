import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as T from 'three'
import { ModelAsset, modelPath } from '../three/ExplodableModel'
import { StudioLight, StudioFloor } from '../three/SceneCanvas'
import { makeCar } from '../three/models'
import { content } from '../content'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const query=new URLSearchParams(location.search)
const views:Record<string,{eye:[number,number,number];target:[number,number,number];span:number}>={
 hero:{eye:[-6.8,2.45,9.8],target:[0,.65,0],span:3.6},profile:{eye:[0,1.1,9],target:[0,.72,0],span:3.4},
 top:{eye:[0,10,.001],target:[0,0,0],span:5.8},wing:{eye:[-2,1.65,3.6],target:[-1.35,.7,.8],span:1.35},
 wheel:{eye:[-2.4,.9,3.8],target:[-1.4,.38,.9],span:1.1},glass:{eye:[-3,1.9,3],target:[-.1,1,0],span:1.8},
 spoiler:{eye:[4,2.5,3],target:[1.75,1.1,0],span:1.8},
}
declare global {interface Window {__carQA?:Record<string,unknown>}}

function Inspect({model}:{model:T.Group}){
 const {camera,size,gl,scene}=useThree()
 const mode=query.get('mode')||'beauty',solo=query.get('solo')||''
 const report=useMemo(()=>{
  const nodes:unknown[]=[],materials:unknown[]=[],textures=new Set<T.Texture>(),signatures=new Map<string,string>(),duplicates:unknown[]=[]
  let triangles=0,opposed=0,degenerate=0
  model.updateWorldMatrix(true,true)
  model.traverse(o=>{
   if(!(o instanceof T.Mesh))return
   const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,idx=g.index
   const faces=(idx?.count??p.count)/3;triangles+=faces
   const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),face=new T.Vector3(),v=new T.Vector3()
   for(let i=0;i<faces;i++){
    const ii=[0,1,2].map(k=>idx?idx.getX(i*3+k):i*3+k)
    a.fromBufferAttribute(p,ii[0]);b.fromBufferAttribute(p,ii[1]);c.fromBufferAttribute(p,ii[2]);face.crossVectors(b.sub(a),c.sub(a))
    if(face.lengthSq()<1e-16){degenerate++;continue}
    if(n){v.set(0,0,0);for(const j of ii)v.add(new T.Vector3().fromBufferAttribute(n,j));if(face.normalize().dot(v.normalize())<-.2)opposed++}
   }
   const signature=Array.from(o.matrixWorld.elements).join(',')+':'+p.count+':'+g.uuid
   if(signatures.has(signature))duplicates.push([signatures.get(signature),o.name]);else signatures.set(signature,o.name)
   nodes.push({name:o.name,parent:o.parent?.name,triangles:faces,position:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray()})
   for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial){
    const physical=m as T.MeshPhysicalMaterial
    materials.push({node:o.name,name:m.name,color:m.color.getHexString(),roughness:m.roughness,metalness:m.metalness,clearcoat:physical.clearcoat,clearcoatRoughness:physical.clearcoatRoughness,opacity:m.opacity,transmission:physical.transmission,normal:m.normalMap?.name,normalScale:m.normalScale.toArray(),normalRepeat:m.normalMap?.repeat.toArray(),flat:m.flatShading,polygonOffset:m.polygonOffset,depthWrite:m.depthWrite,map:m.map?.name})
    for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value)
   }
  })
  return {triangles,nodes,materials,duplicates,opposed,degenerate,textures:[...textures].map(t=>({name:t.name,colorSpace:t.colorSpace,repeat:t.repeat.toArray(),anisotropy:t.anisotropy,mipmaps:t.generateMipmaps}))}
 },[model])
 useEffect(()=>{
  const view=views[query.get('view')||'hero']||views.hero
  camera.position.set(...view.eye);camera.lookAt(...view.target)
  if(camera instanceof T.OrthographicCamera){camera.zoom=Math.min(size.width/(view.span*1.5),size.height/view.span);camera.updateProjectionMatrix()}
  const saved=new Map<T.Mesh,T.Material|T.Material[]>();const made:T.Material[]=[]
  model.traverse(o=>{if(!(o instanceof T.Mesh))return
   if(solo&&!o.name.includes(solo)&&!o.parent?.name.includes(solo))o.visible=false
   if(mode==='normals'||mode==='wireframe'){saved.set(o,o.material);const material=mode==='normals'?new T.MeshNormalMaterial({side:T.DoubleSide}):new T.MeshBasicMaterial({color:'#9ab5d3',wireframe:true});made.push(material);o.material=material}
   if(query.get('experiment')==='noNormal')for(const m of [o.material].flat())if(m instanceof T.MeshStandardMaterial){m.normalMap=null;m.needsUpdate=true}
   if(query.get('experiment')==='creased'&&/bodyshell|bumper|door_|extra_/.test(o.name))o.geometry=toCreasedNormals(o.geometry.clone(),35*Math.PI/180)
  })
  if(query.get('experiment')==='noEnv')scene.environmentIntensity=0
  window.__carQA={...report,view:query.get('view')||'hero',ready:true,gl:gl.capabilities.maxTextures}
  return()=>{for(const [o,m]of saved)o.material=m;made.forEach(m=>m.dispose())}
 },[model,camera,size,gl,scene,report,mode,solo])
 useFrame(()=>{if(query.has('groups'))model.traverse(o=>{if(o.type==='Group')o.userData.qaGroup=true})})
 return <primitive object={model}/>
}
export default function DebugCar(){
 const src=modelPath(query.get('quality')==='mobile'?content.hero.model:content.hero.detailModel)
 return <div style={{height:'100vh',background:'#0b0d10'}}>
  {!query.has('shot')&&<div style={{position:'absolute',zIndex:5,background:'#171c23',padding:12,fontSize:14}}>
   <label>Камера <select value={query.get('view')||'hero'} onChange={e=>{query.set('view',e.target.value);location.search=query.toString()}}>{Object.keys(views).map(v=><option key={v}>{v}</option>)}</select></label>
   <label> Вид <select value={query.get('mode')||'beauty'} onChange={e=>{query.set('mode',e.target.value);location.search=query.toString()}}>{['beauty','normals','wireframe'].map(v=><option key={v}>{v}</option>)}</select></label>
   <form><input name="solo" placeholder="solo: имя узла" defaultValue={query.get('solo')||''}/><button>Показать</button></form>
   <details><summary>Таблица узлов</summary><pre id="node-table" style={{maxHeight:'45vh',overflow:'auto'}} onClick={e=>{e.currentTarget.textContent=JSON.stringify(window.__carQA?.nodes,null,2)}}>Нажмите, чтобы прочитать таблицу</pre></details>
  </div>}
  <Canvas orthographic dpr={1} camera={{near:.01,far:100}} gl={{preserveDrawingBuffer:true,antialias:true,alpha:false}} onCreated={({gl})=>{gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.04}}>
   <Suspense fallback={null}><StudioLight compact={false} car/><ModelAsset src={src} fallback={makeCar}>{model=><Inspect model={model}/>}</ModelAsset><StudioFloor/></Suspense>
  </Canvas>
 </div>
}

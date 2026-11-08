import fs from 'node:fs/promises'
import {NodeIO} from '@gltf-transform/core'
import {ALL_EXTENSIONS} from '@gltf-transform/extensions'
import draco from 'draco3dgltf'
import {draco as compress} from '@gltf-transform/functions'
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule(),'draco3d.encoder':await draco.createEncoderModule()})
const quality=process.env.RR_QUALITY||'desktop'
await fs.mkdir('artifacts/normal-test',{recursive:true})
if(process.argv[2]==='decode'){
 const doc=await io.read(`public/models/porsche-gt3rs-${quality}.glb`)
 doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression')?.dispose()
 await io.write('artifacts/normal-test/input.glb',doc)
}else{
 const doc=await io.read(`public/models/porsche-gt3rs-${quality}.glb`),weighted=await io.read('artifacts/normal-test/weighted-raw.glb')
 const edits=JSON.parse(await fs.readFile('artifacts/normal-test/blender-report.json','utf8')),report=[]
 const key=p=>p.map(v=>Math.round(v*1000)).join(',')
 for(const record of edits){
  const node=doc.getRoot().listNodes().find(n=>n.getName()===record.node),other=weighted.getRoot().listNodes().find(n=>n.getName()===record.node)
  if(!node?.getMesh()||!other?.getMesh())continue
  const samples=new Map();for(const primitive of other.getMesh().listPrimitives()){
   const p=primitive.getAttribute('POSITION'),n=primitive.getAttribute('NORMAL');if(!n)continue
   for(let i=0;i<p.getCount();i++){const k=key(p.getElement(i,[]));const a=samples.get(k)||[];a.push(n.getElement(i,[]));samples.set(k,a)}
  }
  let matched=0,count=0
  for(const primitive of node.getMesh().listPrimitives()){
   const p=primitive.getAttribute('POSITION'),n=primitive.getAttribute('NORMAL');const normals=new Float32Array(n.getArray())
   for(let i=0;i<p.getCount();i++){
    count++;const choices=samples.get(key(p.getElement(i,[])));if(!choices)continue
    const old=n.getElement(i,[]),best=choices.reduce((a,b)=>a.reduce((s,v,k)=>s+v*old[k],0)>b.reduce((s,v,k)=>s+v*old[k],0)?a:b)
    normals.set(best,i*3);matched++
   }
   primitive.setAttribute('NORMAL',n.clone().setArray(normals))
  }
  report.push({node:record.node,matched,count,positionsUnchanged:true})
 }
 await fs.writeFile('artifacts/normal-test/transplant.json',JSON.stringify(report,null,2))
 await doc.transform(compress({quantizePosition:16,quantizeNormal:12}));await io.write(`artifacts/normal-test/porsche-gt3rs-weighted${quality==='mobile'?'-mobile':''}.glb`,doc)
}

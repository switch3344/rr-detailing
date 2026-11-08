import assert from 'node:assert/strict'
import fs from 'node:fs'
const car=['chassis','body_shell','rear_spoiler','door_FL','door_FR','glass','headlights','wheel_front_L','wheel_front_R','wheel_rear_L','wheel_rear_R','Steering_front_L','Steering_front_R']
const engine=['intake_manifold','bank_left','bank_right','crankcase','air_pipes','hoses','accessories','auxiliary_module']
const assets=[['porsche-gt3rs-desktop',car,500000],['porsche-gt3rs-mobile',car,120000],['lamborghini-v12-desktop',engine,50000],['lamborghini-v12-mobile',engine,30000],['gt3rs-wheels',['rim','barrel'],20000],['gt3rs-brakes',['rotor','caliper'],10000],['gt3rs-tyres',['tire'],5000],['gt3rs-exhaust',['tip_left','tip_right'],5000]]
const results=[]
for(const [name,required,budget] of assets){
 const bytes=fs.readFileSync(`public/models/${name}.glb`)
 assert.equal(bytes.toString('ascii',0,4),'glTF')
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)))
 const hasMesh=i=>gltf.nodes[i].mesh!==undefined||(gltf.nodes[i].children??[]).some(hasMesh)
 for(const key of required){const index=gltf.nodes.findIndex(n=>n.name===key);assert(index>=0,`${name}: missing ${key}`);assert(hasMesh(index),`${name}: empty ${key}`)}
 assert(!gltf.nodes.some(n=>/Icosphere|\.col$/.test(n.name??'')),`${name}: helper geometry remains`)
 const primitives=gltf.meshes.flatMap(m=>m.primitives)
 const triangles=primitives.reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0)
 assert(triangles<=budget,`${name}: triangle budget exceeded`)
 assert(bytes.length<8_000_000,`${name}: download budget exceeded`)
 assert(primitives.every(p=>p.attributes.NORMAL!==undefined),`${name}: missing normals`)
 results.push({name,triangles,bytes:bytes.length,nodes:gltf.nodes.length})
}
fs.mkdirSync('artifacts/gt3rs',{recursive:true})
fs.writeFileSync('artifacts/gt3rs/asset-check.json',JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results,null,2))

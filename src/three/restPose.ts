import * as T from 'three'
type TRS={object:T.Object3D;position:T.Vector3;quaternion:T.Quaternion;scale:T.Vector3}
const rests=new WeakMap<T.Object3D,TRS[]>()
export function rememberRest(model:T.Object3D){const nodes:TRS[]=[];model.traverse(object=>nodes.push({object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()}));rests.set(model,nodes)}
export function restoreRest(model:T.Object3D){for(const r of rests.get(model)??[]){r.object.position.copy(r.position);r.object.quaternion.copy(r.quaternion);r.object.scale.copy(r.scale);r.object.updateMatrix()}model.updateWorldMatrix(true,true)}
export function restError(model:T.Object3D){let maximum=0;for(const r of rests.get(model)??[])maximum=Math.max(maximum,r.object.position.distanceTo(r.position),1-Math.abs(r.object.quaternion.dot(r.quaternion)),r.object.scale.distanceTo(r.scale));return maximum}

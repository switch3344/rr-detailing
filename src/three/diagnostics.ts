type SceneStats = { mounts: number; unmounts: number; frames: number; ready: boolean; active: boolean; triangles: number; minNear?: number; visibleShowroomModels?:number; maxShowroomModels?:number }
type Audit = { contextsCreated: number; lost: number; restored: number; scenes: Record<string,SceneStats>; events: {type:string;scene:string;time:number}[] }
declare global { interface Window { __rrAudit: Audit } }
export const renderAudit: Audit = window.__rrAudit ??= {contextsCreated:0,lost:0,restored:0,scenes:{},events:[]}
export function sceneStats(name: string) {
  return renderAudit.scenes[name] ??= {mounts:0,unmounts:0,frames:0,ready:false,active:false,triangles:0}
}
export function auditEvent(type: string, scene: string) {
  renderAudit.events.push({type,scene,time:Math.round(performance.now())})
  if (renderAudit.events.length>300) renderAudit.events.shift()
  if(type==='contextlost'||type==='contextrestored') console.info('RR WebGL',type,scene)
}

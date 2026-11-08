import {chromium} from 'playwright-core'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
await fs.mkdir('artifacts/verification',{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']})
const root=process.env.RR_QA_URL||'http://127.0.0.1:5190/'
let server
if(!process.env.RR_QA_URL){server=await createServer({server:{port:5190,strictPort:true,host:'127.0.0.1'}});await server.listen()}
const results=[]
if(process.env.RR_PERF_ONLY){try{results.push(...JSON.parse(await fs.readFile('artifacts/verification/results.json','utf8')).filter(r=>r.test!=='30-scrolls'))}catch{}}
async function fresh(width=1280){const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});const page=await context.newPage();return {context,page}}
try{
 if(!process.env.RR_PERF_ONLY){
  const {context,page}=await fresh();const errors=[];page.on('pageerror',e=>errors.push(e.message));const requests=[];page.on('request',r=>requests.push({url:r.url(),at:Date.now()}))
  await page.goto(root);await page.waitForFunction(()=>window.__rrBoot?.finished,{},{timeout:60000})
  const boot=await page.evaluate(()=>window.__rrBoot);const glb=requests.filter(r=>r.url.includes('.glb'));assert.equal(glb.filter(r=>r.url.endsWith('porsche-gt3rs-desktop.glb')).length,1,'duplicate hero request')
  assert.equal(errors.length,0);await page.screenshot({path:'artifacts/verification/hero.png'})
  results.push({test:'cold-start',boot,errors,glb})
  await page.locator('#scene-body .stage-toggle').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.__rrModels?.body_shell?.userData.explodeProgress===0)
  const snapshot=()=>{const data=[];window.__rrModels.body_shell.traverse(o=>data.push([o.name,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()]));return data}
  const before=await page.evaluate(snapshot)
  for(let i=0;i<20;i++){
   await page.locator('#scene-body .stage-toggle').click();await page.waitForFunction(()=>window.__rrModels.body_shell.userData.explodeProgress===1)
   await page.locator('#scene-body .stage-toggle').click();await page.waitForFunction(()=>window.__rrModels.body_shell.userData.explodeProgress===0)
  }
  assert.deepEqual(await page.evaluate(snapshot),before);results.push({test:'20-explode-reassemble',identical:true,nodes:before.length})
  await context.close()
  for(const condition of ['fast3g','failed-model']){
   const {context,page}=await fresh();const session=await context.newCDPSession(page)
   if(condition==='fast3g')await session.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:750e3/8,connectionType:'cellular3g'})
   else await page.route('**/models/porsche-gt3rs-desktop.glb',route=>route.abort())
   await page.goto(root,{waitUntil:'domcontentloaded'});const samples=[]
   await page.waitForFunction(()=>!!window.__rrBoot,{},{timeout:90000})
   for(let i=0;i<100;i++){
    const value=await page.evaluate(()=>({time:performance.now(),...window.__rrBoot}));samples.push({time:value.time,progress:value.progress,released:value.released,buffered:value.buffered,timedOut:value.timedOut,error:value.error})
    if(value.finished)break;await page.waitForTimeout(250)
   }
   for(let i=1;i<samples.length;i++)assert(samples[i].progress>=samples[i-1].progress,'progress decreased')
   assert(samples.at(-1).released,'loader never released')
   await page.screenshot({path:`artifacts/verification/${condition}.png`});results.push({test:condition,samples})
   await context.close()
  }
 }
 if(process.env.RR_SCROLL!=='0')for(const width of [1280,1920,390]){
  const {context,page}=await fresh(width);const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4})
  await page.goto(root);await page.waitForFunction(()=>window.__rrBoot?.finished,{},{timeout:90000})
  for(const section of ['#scene-body','#scene-engine','#scene-brake']){await page.locator(section).scrollIntoViewIfNeeded();await page.waitForTimeout(1200)}
  await page.getByRole('tab',{name:'Выхлоп',exact:true}).click();await page.waitForTimeout(500)
  const before=await page.evaluate(()=>({audit:structuredClone(window.__rrAudit),downloads:performance.getEntriesByType('resource').filter(e=>e.name.includes('.glb')).length}))
  const frames=await page.evaluate(async()=>{
   document.documentElement.style.scrollBehavior='auto';let missing=0;const deltas=[];let last=performance.now()
   const sample=()=>{const now=performance.now();if(now-last<100)deltas.push(now-last);last=now;for(const host of document.querySelectorAll('[data-scene]')){const rect=host.getBoundingClientRect();if(rect.top<innerHeight*.8&&rect.bottom>innerHeight*.2&&host.dataset.ready!=='true')missing++}}
   for(let cycle=0;cycle<30;cycle++)for(const id of ['top','scene-body','scene-engine','scene-brake','scene-engine','scene-body','top']){
    document.getElementById(id).scrollIntoView({behavior:'instant'});for(let n=0;n<4;n++)await new Promise(resolve=>requestAnimationFrame(()=>{sample();resolve()}))
   }
   deltas.sort((a,b)=>a-b);return {missing,samples:deltas.length,medianFps:1000/deltas[Math.floor(deltas.length/2)],p95Ms:deltas[Math.floor(deltas.length*.95)]}
  })
  const after=await page.evaluate(()=>({audit:structuredClone(window.__rrAudit),downloads:performance.getEntriesByType('resource').filter(e=>e.name.includes('.glb')).length,selected:document.querySelector('[role=tab][aria-selected=true]')?.textContent}))
  assert.equal(after.audit.contextsCreated,4);assert.equal(after.audit.lost,0);assert.equal(after.downloads,before.downloads);assert.equal(after.selected,'Выхлоп');assert.equal(after.audit.scenes.brake.maxShowroomModels,1);assert.equal(frames.missing,0);assert.equal(errors.length,0)
  results.push({test:'30-scrolls',width,cpuSlowdown:4,frames,before,after,errors});await fs.writeFile('artifacts/verification/results.json',JSON.stringify(results,null,2));await context.close()
 }
}finally{await fs.writeFile('artifacts/verification/results.json',JSON.stringify(results,null,2));await browser.close();await server?.close()}
console.log(results.map(r=>({test:r.test,width:r.width,frames:r.frames,openedAt:r.boot?.openedAt})))

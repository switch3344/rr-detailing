import {preview} from 'vite'
import {chromium} from 'playwright-core'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const server=await preview({preview:{host:'127.0.0.1',port:5194,strictPort:true}})
const browser=await chromium.launch({channel:'msedge',headless:true})
const results=[]
try{
 for(const [condition,width]of [['normal',1280],['warm',1280],['mobile',390],['fast3g',1280],['failed',1280],['invalid',1280]]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'}),page=await context.newPage();const cdp=await context.newCDPSession(page)
  if(condition==='fast3g')await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6e6/8,uploadThroughput:750e3/8,connectionType:'cellular3g'})
  if(condition==='failed')await page.route('**/models/porsche-gt3rs-desktop.glb',r=>r.abort())
  if(condition==='invalid')await page.route('**/models/porsche-gt3rs-desktop.glb',r=>r.fulfill({body:'invalid glb',contentType:'model/gltf-binary'}))
  await page.goto('http://127.0.0.1:5194/',{waitUntil:'domcontentloaded'});if(condition==='warm'){await page.waitForSelector('.rr-revealed');await page.reload()}
  const samples=[]
  for(let i=0;i<240;i++){
   const value=await page.evaluate(()=>({time:performance.now(),percent:document.querySelector('.preloader-percent')?.textContent,open:document.documentElement.classList.contains('rr-revealed'),ready:document.querySelector('[data-scene=hero]')?.getAttribute('data-ready')}));samples.push(value)
   if(value.open)break;await page.waitForTimeout(100)
  }
  assert(samples.at(-1).open,'production loader stuck');if(condition==='fast3g')assert(samples.at(-1).time<13300,'timeout exceeded')
  if(['normal','mobile','warm'].includes(condition)){
   await page.waitForSelector('[data-scene=hero][data-ready=true]',{timeout:60000})
   const fps=await page.evaluate(async()=>{document.documentElement.style.scrollBehavior='auto';const before=window.__rrAudit.scenes.hero.frames;const start=performance.now();for(let i=0;i<180;i++){window.scrollTo(0,(1-Math.cos(i*.025))*190);await new Promise(resolve=>requestAnimationFrame(resolve))}return {renderedFps:(window.__rrAudit.scenes.hero.frames-before)*1000/(performance.now()-start),duration:performance.now()-start}})
   results.push({condition,width,samples,fps})
  }else results.push({condition,width,samples})
  await page.screenshot({path:`artifacts/verification/production-${condition}.png`});await context.close()
 }
}finally{await fs.writeFile('artifacts/verification/production.json',JSON.stringify(results,null,2));await browser.close();server.httpServer.close()}
console.log(results.map(r=>({condition:r.condition,opened:r.samples.at(-1),fps:r.fps})))

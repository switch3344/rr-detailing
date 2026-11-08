import {chromium} from 'playwright-core'
import {createServer} from 'vite'
import fs from 'node:fs/promises'
const phase=process.env.RR_PHASE||'after'
const out=`artifacts/${phase}`;await fs.mkdir(out,{recursive:true})
const server=await createServer({server:{port:5188,strictPort:true,host:'127.0.0.1'}});await server.listen()
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-timer-throttling']})
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1})
 const shots=process.env.RR_VIEWS?.split(',')||['hero','profile','top','wing','wheel','glass','spoiler','normals','wireframe','rest','noNormal','noEnv','mobile']
 for(const name of shots){
  const mode=['normals','wireframe'].includes(name)?name:'beauty'
  const experiment=['rest','noNormal','noEnv','creased'].includes(name)?name:''
  await page.setViewportSize(name==='mobile'?{width:390,height:844}:{width:1280,height:800})
  await page.goto(`http://127.0.0.1:5188/debug/car?shot=1&view=${['normals','wireframe','rest','noNormal','noEnv','mobile','creased'].includes(name)?'hero':name}&mode=${mode}&experiment=${experiment}&quality=${name==='mobile'?'mobile':'desktop'}`)
  await page.waitForFunction(()=>window.__carQA?.ready,{},{timeout:60000});await page.waitForTimeout(800)
  await page.screenshot({path:`${out}/${name}.png`})
  if(name==='hero')await fs.writeFile(`${out}/inspection.json`,JSON.stringify(await page.evaluate(()=>window.__carQA),null,2))
  console.log(phase,name)
 }
}finally{await browser.close();await server.close()}

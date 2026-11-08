import {preview} from 'vite'
import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
const servers=[]
const run=(args)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['.qa-tools/node_modules/lighthouse/cli/index.js',...args],{windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,CHROME_PATH:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}});let errors='';child.stderr.on('data',d=>{errors+=d});child.on('exit',code=>code===0?resolve():reject(new Error(errors.slice(-1500))))})
try{
 for(const [name,root,port]of [['before','.qa-baseline',5193],['after','.',5194]]){
  const server=await preview({root,preview:{host:'127.0.0.1',port,strictPort:true}});servers.push(server)
  await run([`http://127.0.0.1:${port}/`,'--only-categories=performance,accessibility,best-practices,seo','--preset=desktop','--throttling-method=provided','--chrome-flags=--headless=new --no-first-run','--output=json','--output=html',`--output-path=artifacts/verification/lighthouse-${name}`,'--quiet'])
  const report=JSON.parse(await fs.readFile(`artifacts/verification/lighthouse-${name}.report.json`,'utf8'))
  console.log(name,{scores:Object.fromEntries(Object.entries(report.categories).map(([k,v])=>[k,v.score])),lcp:report.audits['largest-contentful-paint'].numericValue,tbt:report.audits['total-blocking-time'].numericValue,cls:report.audits['cumulative-layout-shift'].numericValue})
 }
}finally{for(const server of servers)server.httpServer.close()}

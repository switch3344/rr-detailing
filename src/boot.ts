import {Cache} from 'three'
import {useSyncExternalStore} from 'react'
import {content} from './content'
import {sceneConfig} from './three/scene.config'
type Boot={progress:number;buffered:boolean;released:boolean;finished:boolean;timedOut:boolean;error:boolean;start:number;openedAt?:number;resources:{url:string;bytes:number;ms:number}[]}
let state:Boot={progress:0,buffered:false,released:false,finished:false,timedOut:false,error:false,start:performance.now(),resources:[]}
const listeners=new Set<()=>void>()
const update=(patch:Partial<Boot>)=>{state={...state,...patch};listeners.forEach(fn=>fn())}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn)}
export const useBoot=()=>useSyncExternalStore(subscribe,()=>state)
let started=false,modelReady=false,fontsReady=false,imagesReady=false,loaded=0,total=1,timer:ReturnType<typeof setTimeout>
Cache.enabled=true
function progress(){update({progress:Math.max(state.progress,Math.min(.99,loaded/total)*.78+(fontsReady?.08:0)+(imagesReady?.04:0)+(modelReady?.10:0))});if(modelReady&&fontsReady&&imagesReady)open()}
function open(){if(state.released)return;const remaining=sceneConfig.loader.minimumMs-(performance.now()-state.start);if(remaining>0){setTimeout(open,remaining);return}clearTimeout(timer);performance.mark('rr:first-meaningful');update({released:true,progress:modelReady&&fontsReady&&imagesReady?1:state.progress,openedAt:performance.now()-state.start});document.documentElement.classList.add('rr-revealed');document.documentElement.classList.remove('rr-loading');setTimeout(()=>{update({finished:true});if(document.activeElement===document.body){document.body.tabIndex=-1;document.body.focus({preventScroll:true})}},matchMedia('(prefers-reduced-motion:reduce)').matches?180:sceneConfig.loader.exitMs)}
export function heroFrameReady(){modelReady=true;progress()}
export function heroLoadFailed(){update({error:true});window.dispatchEvent(new Event('rr:hero-load-failed'));open()}
export function startBoot(compact:boolean){
 if(started)return;started=true;state.start=0;document.documentElement.classList.add('rr-loading')
 timer=setTimeout(()=>{update({timedOut:true});open()},Math.max(0,sceneConfig.loader.timeoutMs-performance.now()))
 const url=import.meta.env.BASE_URL+'models/'+(compact?content.hero.model:content.hero.detailModel)
 const start=performance.now()
 fetch(url).then(async response=>{
  if(!response.ok)throw new Error(`HTTP ${response.status}`)
  total=Number(response.headers.get('Content-Length'))||(compact?sceneConfig.loader.mobileBytes:sceneConfig.loader.desktopBytes)
  const reader=response.body?.getReader();const chunks:Uint8Array[]=[]
  if(reader){for(;;){const result=await reader.read();if(result.done)break;chunks.push(result.value);loaded+=result.value.length;total=Math.max(total,loaded);progress()}}
  else {const value=new Uint8Array(await response.arrayBuffer());chunks.push(value);loaded=value.length}
  const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  // FileLoader resolves against document.baseURI. Cache the complete ArrayBuffer,
  // then let GLTFLoader decode textures once; no second GLB request is made.
  Cache.add(`file:${url}`,bytes.buffer);Cache.add(`file:${new URL(url,document.baseURI).href}`,bytes.buffer);Cache.add(url,bytes.buffer);loaded=total
  const resource={url,bytes:bytes.byteLength,ms:performance.now()-start};update({buffered:true,resources:[...state.resources,resource]});progress()
  if(import.meta.env.DEV)console.info('RR critical resource',resource)
 }).catch(error=>{console.warn('RR hero load failed',error);update({error:true});open()})
 const fontStart=performance.now()
 Promise.all([document.fonts.load('500 16px "Unbounded Variable"','RR Доводим'),document.fonts.load('400 16px "Onest Variable"','Studio Полировка')]).then(()=>document.fonts.ready).then(()=>{fontsReady=true;const entries=performance.getEntriesByType('resource').filter(e=>e.name.includes('.woff2')) as PerformanceResourceTiming[];update({resources:[...state.resources,...entries.map(e=>({url:e.name,bytes:e.decodedBodySize,ms:e.duration}))]});if(import.meta.env.DEV)console.info('RR critical fonts',performance.now()-fontStart,entries.map(e=>({url:e.name,bytes:e.decodedBodySize,ms:e.duration})));progress()}).catch(()=>{fontsReady=true;progress()})
 Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('.hero img')).map(img=>img.decode().catch(()=>{}))).then(()=>{imagesReady=true;progress()})
}
if(import.meta.env.DEV)Object.defineProperty(window,'__rrBoot',{get:()=>state})

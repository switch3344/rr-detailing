import {useEffect,useRef,useState} from 'react'
import {LogoRR} from './ui'
import {useBoot} from '../boot'
export function Preloader(){
 const state=useBoot(),target=useRef(0),[display,setDisplay]=useState(0)
 target.current=state.progress*100
 useEffect(()=>{let frame=0,value=0,last=performance.now();const tick=(now:number)=>{value=Math.min(target.current,value+(target.current-value)*(1-Math.exp(-(now-last)/110)));last=now;if(target.current===100&&value>99.5)value=100;setDisplay(value);if(value<100)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[])
 if(state.finished)return null
 return <div className={'preloader'+(state.released?' preloader-exit':'')} role="status" aria-label="Загрузка RR Studio">
  <div className="preloader-inner"><div className="preloader-brand"><LogoRR/><span>RR STUDIO</span></div>
   <span className="preloader-percent" aria-hidden="true">{Math.floor(display)}<small>%</small></span>
   <div className="preloader-track" aria-hidden="true"><i style={{transform:`scaleX(${display/100})`}}/></div>
   <span className="sr-only" aria-live="polite">Загружено {Math.floor(display/10)*10}%</span>
  </div>
 </div>
}

import { lazy,Suspense,useEffect,useRef,useState } from 'react'
import { content } from '../content'
import type { StageKind } from '../three/SceneCanvas'
import visual from '../three/car.config'
const SceneCanvas=lazy(()=>import('../three/SceneCanvas'))

export function TuningScene({nearby,reduced,compact}:{nearby:StageKind[];reduced:boolean;compact:boolean}) {
  const section=useRef<HTMLElement>(null)
  const tabs=useRef<(HTMLButtonElement|null)[]>([])
  const [index,setIndex]=useState(0)
  const [visited,setVisited]=useState(false)
  const [ready,setReady]=useState(false)
  const [unavailable,setUnavailable]=useState(false)
  const [step,setStep]=useState(-1)
  const requested=useRef(0)
  const [phase,setPhase]=useState<'idle'|'out'|'in'>('idle')
  useEffect(()=>{if(nearby.includes('brake'))setVisited(true)},[nearby])
  useEffect(()=>{
    if(phase==='idle')return
    const timer=setTimeout(()=>{
      if(phase==='out'){setIndex(requested.current);setStep(-1);setPhase('in')}
      else setPhase(requested.current===index?'idle':'out')
    },reduced?0:visual.site.tuning.transitionMs/2)
    return()=>clearTimeout(timer)
  },[phase,index,reduced])
  const item=content.tuning.items[index]
  const select=(next:number)=>{requested.current=next;setStep(-1);setPhase(next===index?'in':'out')}
  return <article ref={section} className="service-scene tuning-showroom" id="scene-brake" aria-label={content.tuning.title} data-phase={phase}
    style={{'--showroom-transition':`${visual.site.tuning.transitionMs}ms`,'--object-fade':`${reduced?0:visual.site.tuning.transitionMs/2}ms`} as React.CSSProperties}>
    <div className="shell scene-layout tuning-sticky">
      <div className="scene-intro" role="tabpanel" id="tuning-panel" aria-labelledby={'tuning-tab-'+index}>
        <h2>{content.tuning.title}</h2><div className="showroom-copy" key={index}><h3>{item.title}</h3><p>{item.text}</p></div>
      </div>
      <div className="model-stage">
        <div className="model-art showroom-art" data-stage="brake" aria-label={item.title}>
          {visited&&!unavailable&&<div className={'stage-canvas'+(ready?' stage-canvas-ready':'')}>
            <Suspense fallback={null}><SceneCanvas kind="brake" tuningIndex={index} step={step} onStep={setStep}
              reduced={reduced} compact={compact} onReady={setReady} onUnavailable={setUnavailable} /></Suspense>
          </div>}
        </div>
        <div className="showroom-tabs" role="tablist" aria-label={content.tuning.tabsLabel}>
          {content.tuning.items.map((entry,i)=><button key={entry.title} ref={node=>{tabs.current[i]=node}}
            role="tab" id={'tuning-tab-'+i} aria-controls="tuning-panel" aria-selected={index===i} tabIndex={index===i?0:-1}
            onClick={()=>select(i)} onKeyDown={event=>{
              const next=event.key==='ArrowRight'?(i+1)%4:event.key==='ArrowLeft'?(i+3)%4:event.key==='Home'?0:event.key==='End'?3:-1
              if(next>=0){event.preventDefault();select(next);tabs.current[next]?.focus()}
            }}>{entry.title}</button>)}
        </div>
        <div className="stage-controls"><button type="button" className="button button-secondary" aria-pressed={step>0}
          onClick={()=>setStep(value=>value>0?-1:1)}>{step>0?content.services.stage.collapse:content.services.stage.expand}</button>
          {!compact&&<span className="stage-hint">{content.tuning.hint}</span>}</div>
      </div>
      <div className="scene-details showroom-copy" key={'details-'+index}><dl className="scene-features">
        {item.features.map(feature=><div key={feature.title}><dt>{feature.title}</dt><dd>{feature.text}</dd></div>)}
      </dl></div>
    </div>
  </article>
}

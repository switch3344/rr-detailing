import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { brakeParts, bodyParts, content, engineParts } from '../content'
import type { Part, Scene, SceneKind } from '../content'
import type { StageKind } from '../three/SceneCanvas'
import { ModelDiagram } from './ModelDiagram'
import { Icon } from './ui'
import {useBoot,heroFrameReady} from '../boot'
import {sceneConfig} from '../three/scene.config'

const loadScene = () => import('../three/SceneCanvas')
const SceneCanvas = lazy(loadScene)

export function useNearbyStages(released=true) {
  const [nearby, setNearby] = useState<StageKind[]>([])
  const primed=useRef(new Set<StageKind>())
  useEffect(() => {
    const stages = Array.from(document.querySelectorAll<HTMLElement>('[data-stage]'))
    let frame = 0
    function update() {
      frame = 0
      const height = window.innerHeight
      const lead = Math.min(200,height*.2)
      const next = stages.flatMap(stage => {
        const { top, bottom } = stage.getBoundingClientRect()
        const kind=stage.dataset.stage as StageKind
        if(released&&kind!=='hero'&&top<height*(1+sceneConfig.proximity.screens)&&!primed.current.has(kind)){
          primed.current.add(kind)
          loadScene().then(module=>module.preloadStage(kind,matchMedia('(max-width:760px), (hover:none), (pointer:coarse)').matches))
        }
        return (released||stage.dataset.stage==='hero')&&top < height + lead && bottom > -lead * 0.65 ? [stage.dataset.stage as StageKind] : []
      })
      setNearby(previous => previous.length === next.length && previous.every((stage, i) => stage === next[i])
        ? previous : next)
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update) }
    const observer = new ResizeObserver(schedule)
    stages.forEach(stage => observer.observe(stage))
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [released])
  return nearby
}

type Display = { nearby: StageKind[]; reduced: boolean; compact: boolean }
function useVisited(current: boolean) {
  const [visited,setVisited] = useState(current)
  useEffect(() => { if(current)setVisited(true) },[current])
  return visited || current
}

export function HeroVisual({ nearby, reduced, compact, progress }:
  Display & { progress: MutableRefObject<number> }) {
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const boot=useBoot()
  useEffect(()=>{const failed=()=>setUnavailable(true);window.addEventListener('rr:hero-load-failed',failed);return()=>window.removeEventListener('rr:hero-load-failed',failed)},[])
  const visited = useVisited(nearby.includes('hero'))
  return <div className="hero-visual" data-stage="hero" role="img" aria-label={content.hero.carAlt}>
    {(unavailable||!ready&&boot.released) && <ModelDiagram kind="hero" expanded={false} />}
    {(unavailable||boot.error)&&boot.released&&<button className="model-retry" onClick={()=>location.reload()}>Повторить загрузку 3D</button>}
    {visited && boot.buffered && !unavailable && <div className={'stage-canvas' + (ready ? ' stage-canvas-ready' : '')}>
      <Suspense fallback={null}>
        <SceneCanvas kind="hero" reduced={reduced} compact={compact} onReady={value=>{setReady(value);if(value)heroFrameReady()}}
          onUnavailable={setUnavailable} heroProgress={progress} />
      </Suspense>
    </div>}
  </div>
}

const allParts = { body: bodyParts, engine: engineParts, brake: brakeParts }

export function ServiceScene({ scene, nearby, reduced, compact }: Display & { scene: Scene }) {
  const kind = scene.id as SceneKind
  const isEngine = kind === 'engine'
  const hasNote = isEngine || kind === 'brake'
  const [step, setStep] = useState(-1)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<Part | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const leader = useRef<SVGPathElement>(null)
  const current = nearby.includes(kind) && !unavailable
  const visited = useVisited(current)
  const copy = content.services.stage
  const toggle = step > 0 ? copy.collapse : isEngine ? copy.separate : copy.expand
  function advance() {
    setSelected(null)
    setStep(value => value > 0 ? -1 : 1)
  }

  return <article className={'service-scene service-scene-' + kind} id={'scene-' + scene.id}>
    <div className="shell scene-layout">
      <div className="scene-intro"><h3>{scene.title}</h3><p>{scene.text}</p></div>
      <div className="model-stage">
        <div className="model-art" data-stage={kind} aria-label={scene.title}>
          {(unavailable||visited&&!ready) && <ModelDiagram kind={kind} expanded={step > 0} />}
          {visited && !unavailable && <div className={'stage-canvas' + (ready ? ' stage-canvas-ready' : '')}>
            <Suspense fallback={null}>
              <SceneCanvas kind={kind} step={step} onStep={setStep} onPart={setSelected} leader={leader}
                compact={compact} reduced={reduced} onReady={setReady} onUnavailable={setUnavailable} />
            </Suspense>
          </div>}
          {hasNote && <svg className="part-leader" aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none"
            visibility={selected && current ? 'visible' : 'hidden'}>
            <marker id={'part-dot-' + kind} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5">
              <circle cx="3" cy="3" r="2.5" fill="#a9c5ee" stroke="none" />
            </marker>
            <path ref={leader} vectorEffect="non-scaling-stroke" markerStart={'url(#part-dot-' + kind + ')'} />
          </svg>}
        </div>
        {hasNote && <div className="part-note" role="status">
          {selected && current ? <><b>{selected.label}</b><span>{selected.description}</span></> : ready && step > 0 ? copy.select : null}
        </div>}
        <div className="stage-controls">
          <button className="button button-secondary stage-toggle" type="button" onClick={advance}
            aria-label={toggle + ' — ' + scene.title} aria-pressed={step > 0}>
            <Icon name={toggle === copy.collapse ? 'collapse' : 'expand'} size={18} />{toggle}
          </button>
          {!compact && ready && step <= 0 && <span className="stage-hint">{scene.hint}</span>}
        </div>
        {'caption' in scene && <p className="stage-caption">{scene.caption}</p>}
      </div>
      <div className="scene-details">
        <dl className="scene-features">
          {scene.features.map(feature => <div key={feature.title} id={'id' in feature?feature.id:undefined}>
            <dt>{feature.title}</dt><dd>{feature.text}</dd>
          </div>)}
        </dl>
        {step > 0 && <details className="parts-index">
          <summary>{copy.parts}</summary>
          <ul>{allParts[kind].filter(part => part.label).filter((part, index, items) =>
            items.findIndex(other => other.label === part.label) === index).map(part =>
            <li key={part.nodeName}><b>{part.label}</b> {part.description}</li>)}</ul>
        </details>}
      </div>
    </div>
  </article>
}

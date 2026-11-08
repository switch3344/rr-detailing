import carManifest from './car.manifest.json'
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, useGLTF } from '@react-three/drei'
import * as T from 'three'
import { bodyParts, brakeParts, engineParts, content, tuningParts } from '../content'
import type { Part, SceneKind, XYZ } from '../content'
import { ExplodableModel, ModelAsset, modelPath, RenderBoundary, useModelSpring } from './ExplodableModel'
import type { Trigger } from './ExplodableModel'
import { makeCar, makeEngine, makeBrake } from './models'
import carConfig from './car.config'
import { auditEvent, renderAudit, sceneStats } from './diagnostics'
import {useBoot} from '../boot'

export type StageKind = SceneKind | 'hero'
export type SceneCanvasProps = {
  kind: StageKind
  step?: number
  reduced: boolean
  compact: boolean
  trigger?: Trigger
  onStep?: (step: number) => void
  onPart?: (part: Part | null) => void
  leader?: RefObject<SVGPathElement | null>
  onReady: (ready: boolean) => void
  onUnavailable: (unavailable: boolean) => void
  heroProgress?: MutableRefObject<number>
  tuningIndex?: number
}

const carSource = (compact: boolean) => modelPath(compact ? content.hero.model : content.hero.detailModel)
export function preloadStage(kind:StageKind,compact:boolean){
  const files=kind==='engine'?[compact?content.services.scenes[1].mobileModel:content.services.scenes[1].model]:kind==='brake'?content.tuning.items.map(item=>item.model):[]
  for(const file of files)if(file)useGLTF.preload(modelPath(file),import.meta.env.BASE_URL+'decoders/draco/')
}
const aim: Record<StageKind, { eye: XYZ; target: XYZ; span: number; minWidth: number }> = {
  hero: { eye: [-5.5, 2.02, 8.5], target: [0, 0.55, 0], span: 2.63, minWidth: 4.72 },
  body: carConfig.presentation as {eye:XYZ;target:XYZ;span:number;minWidth:number},
  engine: { eye: [-6.6, 5.2, 5.2], target: [0, 0.56, 0], span: 2.5, minWidth: 3.7 },
  brake: { eye: [2.6, 2.6, 8.2], target: [0, 0.94, 0], span: 2.95, minWidth: 3.3 },
}

function Camera({ kind, ready }: { kind: StageKind; ready: boolean }) {
  const { camera, size, invalidate, gl, scene } = useThree()
  useLayoutEffect(() => {
    if (kind === 'hero' || kind === 'body') camera.layers.enable(1)
    if (kind === 'hero' && (camera instanceof T.PerspectiveCamera || camera instanceof T.OrthographicCamera)) {
      const cfg = carConfig.camera
      const mobile = window.innerWidth <= 760
      const rect = gl.domElement.getBoundingClientRect()
      const target = new T.Vector3(...carConfig.presentation.target as XYZ)
      const outward = new T.Vector3(...carConfig.presentation.eye as XYZ).sub(target).normalize()
      const right = new T.Vector3().crossVectors(camera.up, outward).normalize()
      const up = new T.Vector3().crossVectors(outward, right)
      const tanY = Math.tan(T.MathUtils.degToRad(cfg.fov / 2))
      const frameWidth = window.innerWidth * (mobile ? cfg.mobileWidthFraction : cfg.widthFraction)
      const tanX = tanY * size.width / size.height * Math.min(1, frameWidth / size.width)
      const vertical = tanY * cfg.heightFraction
      let distance = 0
      const points: T.Vector3[] = []
      const car = scene.getObjectByName('RRHeroCar')
      if (car && ready) {
        car.updateWorldMatrix(true,true)
        const inverse = car.matrixWorld.clone().invert()
        car.traverse(object => {
          if (!(object instanceof T.Mesh) || !object.visible) return
          const matrix = inverse.clone().multiply(object.matrixWorld)
          const vertices = object.geometry.getAttribute('position')
          for (let i = 0; i < vertices.count; i += 8) points.push(new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(matrix))
        })
      }
      if (!points.length) for (const x of [-cfg.length/2,cfg.length/2]) for (const y of [0,cfg.height])
        for (const z of [-cfg.width/2,cfg.width/2]) points.push(new T.Vector3(x,y,z))
      if(camera instanceof T.OrthographicCamera){
        let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
        for(const p of [0,1])for(const vertex of points){
          const point=vertex.clone().applyAxisAngle(new T.Vector3(0,1,0),T.MathUtils.degToRad(carConfig.pose.carYaw+carConfig.pose.scrollYaw*p))
          point.x+=T.MathUtils.lerp(carConfig.pose.startX,carConfig.pose.endX,p);point.sub(target)
          const x=point.dot(right),y=point.dot(up);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)
        }
        const hero=gl.domElement.closest('.hero')?.getBoundingClientRect()
        const headline=gl.domElement.closest('.hero')?.querySelector('h1')?.getBoundingClientRect()
        const top=hero?Math.max((headline?.bottom??hero.top)+24,hero.top+hero.height*(mobile?.36:.4)):rect.top
        const bottom=hero?hero.bottom-40:rect.bottom
        const centerY=(top+bottom)/2-rect.top
        const centerX=window.innerWidth*(mobile?cfg.mobileCenterX:cfg.centerX)-rect.left
        camera.zoom=Math.min(frameWidth/(maxX-minX),(bottom-top)/(maxY-minY))/(mobile?cfg.mobilePadding:cfg.padding)
        camera.position.copy(target).addScaledVector(outward,12);camera.lookAt(target)
        camera.setViewOffset(size.width,size.height,size.width/2-centerX+(minX+maxX)*camera.zoom/2,size.height/2-centerY-(minY+maxY)*camera.zoom/2,size.width,size.height)
        camera.updateProjectionMatrix();sceneStats(kind).minNear=12-cfg.length-camera.near;invalidate();return
      }
      for (const p of [0, 1]) for (const vertex of points) {
          const point = vertex.clone().applyAxisAngle(new T.Vector3(0,1,0),
            T.MathUtils.degToRad(carConfig.pose.carYaw + carConfig.pose.scrollYaw * p))
          point.x += T.MathUtils.lerp(carConfig.pose.startX,carConfig.pose.endX,p)
          point.sub(target)
          const depth = point.dot(outward)
          distance = Math.max(distance, Math.abs(point.dot(right))/tanX+depth, Math.abs(point.dot(up))/vertical+depth)
        }
      distance *= mobile ? cfg.mobilePadding : cfg.padding
      camera.fov = cfg.fov
      camera.position.copy(target).addScaledVector(outward,distance)
      camera.lookAt(target)
      const centerX = window.innerWidth * (mobile ? cfg.mobileCenterX : cfg.centerX) - rect.left
      const hero = gl.domElement.closest('.hero')?.getBoundingClientRect()
      const centerY = hero ? hero.top + hero.height * (mobile ? cfg.mobileCenterY : cfg.centerY) - rect.top
        : size.height * (mobile ? cfg.mobileCenterY : cfg.centerY)
      camera.setViewOffset(size.width,size.height,size.width/2-centerX,size.height/2-centerY,size.width,size.height)
      camera.updateProjectionMatrix()
      sceneStats(kind).minNear = distance - Math.max(...points.map(point => point.clone().sub(target).dot(outward))) - camera.near
      invalidate()
      return
    }
    if (!(camera instanceof T.OrthographicCamera)) return
    const { eye, target, span, minWidth } = aim[kind]
    camera.position.set(...eye)
    camera.lookAt(...target)
    const framingWidth = kind === 'hero' && size.width < 600 ? 5.3 : minWidth
    camera.zoom = Math.min(size.height / span, size.width / framingWidth)
    camera.userData.rrBaseZoom = camera.zoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size, kind, invalidate, gl, scene, ready])
  return null
}

function TransmissionBackdrop() {
  const mesh = useRef<T.Mesh>(null)
  const camera = useThree(state => state.camera)
  const material = useMemo(() => new T.ShaderMaterial({
    uniforms: { capture: { value: 0 }, ink: { value: new T.Color('#0b0d10') } },
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float capture; uniform vec3 ink; void main(){if(capture<.5) discard; gl_FragColor=vec4(ink,1.);}',
    depthWrite: false,
  }), [])
  useLayoutEffect(() => { mesh.current?.layers.set(1) }, [])
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    if (!mesh.current) return
    // Three clears an alpha canvas's transmission buffer to white. Supply ink only
    // to offscreen captures; the beauty pass discards it and retains the CSS backdrop.
    mesh.current.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new T.Vector3()),30)
    mesh.current.quaternion.copy(camera.quaternion)
  }, -1)
  return <mesh ref={mesh} material={material} renderOrder={-100} frustumCulled={false}
    onBeforeRender={renderer => { material.uniforms.capture.value = renderer.getRenderTarget() ? 1 : 0; material.uniformsNeedUpdate = true }}>
    <planeGeometry args={[100,100]} />
  </mesh>
}

export function StudioLight({ compact, car }: { compact: boolean; car: boolean }) {
  if (car) return <>
    <ambientLight intensity={carConfig.lighting.ambient} />
    <directionalLight position={[-3,5,4]} intensity={carConfig.lighting.key} color="#f1f3f6" />
    <directionalLight position={[4,2.4,-4]} intensity={carConfig.lighting.rim} color="#d4e2f1" />
    <Environment resolution={compact ? carConfig.lighting.mobileResolution : carConfig.lighting.resolution}
      frames={1} environmentIntensity={carConfig.lighting.environmentIntensity}>
      <color attach="background" args={[carConfig.lighting.background]} />
      {carConfig.lighting.strips.map((strip,index) => <Lightformer key={index} form="rect" intensity={strip.intensity}
        color={strip.color} position={strip.position as XYZ} scale={strip.scale as XYZ} target={[0,.5,0]} />)}
    </Environment>
  </>
  return <>
    <ambientLight intensity={car ? 0.4 : 0.34} />
    <directionalLight position={[-3, 5, 4]} intensity={car ? 1.15 : 1.55} color="#f6f5f3" />
    <directionalLight position={[4, 2.4, -4]} intensity={car ? 1.4 : 1.9} color="#e1ebf5" />
    {car ? <Environment files={import.meta.env.BASE_URL + 'media/atelier-softboxes.hdr'} environmentIntensity={1.0} />
      : <Environment resolution={compact ? 64 : 128} frames={1} environmentIntensity={0.92}>
      <Lightformer form="rect" intensity={3.0} color="#f2f0ed" position={[-2, 5, 3]} scale={[9, 2.3, 1]}
        target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={5.1} color="#dfebf8" position={[1, 3, -4]} scale={[7, 1.4, 1]}
        target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.25} color="#e4e9ee" position={[5, 2, 3]} scale={[5, 2, 1]}
        target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.25} color="#edeeef" position={[-5, 0.5, -2]} scale={[4, 1, 1]}
        target={[0, 0, 0]} />
    </Environment>}
  </>
}

export function StudioFloor() {
  const fade = useMemo(() => {
    const size = 64
    const pixels = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x / (size - 1) * 2 - 1, y / (size - 1) * 2 - 1)
      const value = Math.round((1 - T.MathUtils.smoothstep(distance, 0.12, 0.98)) * 255)
      pixels.set([value, value, value, 255], (y * size + x) * 4)
    }
    const texture = new T.DataTexture(pixels, size, size)
    texture.minFilter = texture.magFilter = T.LinearFilter
    texture.needsUpdate = true
    return texture
  }, [])
  useEffect(() => () => fade.dispose(), [fade])
  return <mesh rotation-x={-Math.PI / 2} position-y={carConfig.floor.height} renderOrder={-2}>
    <planeGeometry args={[10.2, 5.8]} />
    <MeshReflectorMaterial resolution={carConfig.floor.reflectionResolution} blur={carConfig.floor.reflectionBlur as [number,number]}
      mirror={0.74} mixBlur={1.35} mixStrength={carConfig.floor.reflectionStrength}
      color={carConfig.floor.color} roughness={carConfig.floor.roughness} alphaMap={fade} transparent opacity={carConfig.floor.reflectionOpacity} depthWrite={false} />
  </mesh>
}

function Ready({ onReady }: { onReady: (ready: boolean) => void }) {
  const count=useRef(0),sent=useRef(false),invalidate=useThree(state=>state.invalidate)
  const callback=useRef(onReady);callback.current=onReady
  useFrame(()=>{if(sent.current)return;if(++count.current>=3){sent.current=true;callback.current(true)}else invalidate()})
  return null
}

function WheelContacts({ model }: { model: T.Group }) {
  const contacts = useMemo(() => {
    model.updateWorldMatrix(true,true)
    return carManifest.roles.wheels.flatMap(name => {
      const wheel = model.getObjectByName(name)
      if (!wheel) return []
      const center = model.worldToLocal(new T.Box3().setFromObject(wheel).getCenter(new T.Vector3()))
      return [new T.Vector3(center.x,carConfig.floor.height+.003,center.z)]
    })
  }, [model])
  const mask = useMemo(() => {
    const size = carConfig.detail.textureSize
    const pixels = new Uint8Array(size*size*4)
    for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
      const radius = Math.hypot(x/size*2-1,y/size*2-1)
      const alpha = Math.pow(Math.max(0,1-radius),1.5)*255
      pixels.set([0,0,0,alpha],(y*size+x)*4)
    }
    const texture = new T.DataTexture(pixels,size,size)
    texture.needsUpdate = true
    texture.minFilter = texture.magFilter = T.LinearFilter
    return texture
  }, [])
  useEffect(() => () => mask.dispose(),[mask])
  return <>{contacts.map((position,index) => <mesh key={index} position={position} rotation-x={-Math.PI/2} renderOrder={-1}>
    <planeGeometry args={[carConfig.floor.coreRadius[0]*2,carConfig.floor.coreRadius[1]*2]} />
    <meshBasicMaterial map={mask} transparent opacity={carConfig.floor.coreOpacity} depthWrite={false} />
  </mesh>)}</>
}

function HeroCar({ compact, progress, reduced, onReady }: {
  compact: boolean; progress?: MutableRefObject<number>; reduced: boolean; onReady: (ready: boolean) => void
}) {
  const car = useRef<T.Group>(null)
  const boot=useBoot()
  const entering=useRef(0)
  useEffect(()=>{onReady(false)},[compact])
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    const draw = () => invalidate()
    window.addEventListener('rr:hero', draw)
    return () => window.removeEventListener('rr:hero', draw)
  }, [invalidate])
  useFrame((_,delta) => {
    if (!car.current) return
    const p = reduced ? 0 : progress?.current ?? 0
    entering.current=reduced?1:boot.released?Math.min(1,entering.current+Math.min(delta,.05)/.85):0
    const offset=1-T.MathUtils.smoothstep(entering.current,0,1)
    car.current.position.x = T.MathUtils.lerp(carConfig.pose.startX,carConfig.pose.endX,p)+offset*.2
    car.current.position.y=-offset*.035
    car.current.rotation.y = T.MathUtils.degToRad(carConfig.pose.carYaw + carConfig.pose.scrollYaw * p)
    if(boot.released&&entering.current<1)invalidate()
  })
  return <group ref={car} name="RRHeroCar">
    <pointLight position={carConfig.lighting.cabin.position as XYZ} intensity={carConfig.lighting.cabin.intensity}
      color={carConfig.lighting.cabin.color} distance={carConfig.lighting.cabin.distance} decay={carConfig.lighting.cabin.decay} />
    <ModelAsset src={carSource(compact)} fallback={makeCar}>{model => <>
      <primitive object={model} />
      <WheelContacts model={model} />
      <Ready onReady={onReady} />
    </>}</ModelAsset>
  </group>
}

function ShowroomObject({index,active,open,reduced,portal,onReady,onToggle}:{index:number;active:boolean;open:boolean|undefined;reduced:boolean;portal:RefObject<HTMLDivElement|null>;onReady:(value:boolean)=>void;onToggle:()=>void}) {
  const report=useCallback((value:boolean)=>{if(active&&value)onReady(true)},[active,onReady])
  return <group visible={active} rotation-y={carConfig.site.tuning.yaw+(index===3?-Math.PI/2:0)} name={'Showroom_'+index}>
    <ExplodableModel src={modelPath(content.tuning.items[index].model)} fallback={makeBrake}
      parts={tuningParts[index]} open={active?open:true} reduced={reduced} trigger="hover"
      portal={portal} onReady={report} onToggle={onToggle} showLabels={active} />
  </group>
}

function StageContents({ kind, step = 0, reduced, compact, trigger = 'hover', onStep, onPart, onReady, heroProgress, portal, leader, ready, tuningIndex=0 }:
  SceneCanvasProps & { portal: RefObject<HTMLDivElement | null>; ready: boolean }) {
  const isBody = kind === 'body'
  const open = step < 0 ? undefined : step > 0
  const toggle = () => onStep?.(step > 0 ? -1 : 1)
  return <>
    <Camera kind={kind} ready={ready} />
    {(isBody || kind === 'hero') && <TransmissionBackdrop />}
    <Suspense fallback={null}><StudioLight compact={compact} car={isBody || kind === 'hero'} /></Suspense>
    {kind === 'hero' && <HeroCar compact={compact} progress={heroProgress} reduced={reduced} onReady={onReady} />}
    {kind === 'engine' && <ExplodableModel src={modelPath(compact ? content.services.scenes[1].mobileModel ?? content.services.scenes[1].model : content.services.scenes[1].model)}
      fallback={makeEngine} parts={engineParts} open={open} reduced={reduced} detailed
      trigger={trigger} portal={portal} onToggle={toggle}
      onPart={onPart} onReady={onReady} leader={leader} fit />}
    {kind === 'brake' && content.tuning.items.map((_,index)=><ShowroomObject key={index} index={index}
      active={index===tuningIndex} open={open} reduced={reduced} portal={portal} onReady={onReady} onToggle={toggle} />)}
    {isBody && <>
      <ExplodableModel src={carSource(compact)}
        fallback={isBody ? makeCar : makeBrake} parts={isBody ? bodyParts : brakeParts}
        open={open} reduced={reduced} translucent={isBody} trigger={trigger}
        onToggle={toggle} onReady={onReady} portal={portal}
        detailed={!isBody} onPart={onPart} leader={leader} fit />
    </>}
    {kind === 'hero' && ready && !compact && <StudioFloor />}
    {compact
      ? <mesh rotation-x={-Math.PI / 2} position-y={-0.017} scale={kind === 'engine' ? [1.02, 1.4, 1] : kind === 'brake' ? [1.3, 0.9, 1] : [2.35, 0.83, 1]}>
          <circleGeometry args={[1, 40]} /><meshBasicMaterial color="#090b0d" transparent opacity={0.27} depthWrite={false} />
        </mesh>
      : ready && <ContactShadows position={[0, carConfig.floor.height, 0]} opacity={kind === 'hero' ? carConfig.floor.shadowOpacity : 0.40} scale={8.2}
          blur={kind === 'hero' ? carConfig.floor.shadowBlur : 3.5} far={3.2} frames={1}
          resolution={carConfig.floor.shadowResolution} color="#090b0d" />}
  </>
}

function onCanvasCreated({ gl }: { gl: T.WebGLRenderer }) {
  gl.setClearAlpha(0)
  gl.toneMapping = T.ACESFilmicToneMapping
  gl.outputColorSpace = T.SRGBColorSpace
}

function AdaptiveResolution({ compact }: { compact: boolean }) {
  const setDpr = useThree(state => state.setDpr)
  const samples = useRef<number[]>([])
  useFrame((_, delta) => {
    // Ignore demand-rendering pauses; only consecutive animation frames count.
    if (delta > carConfig.performance.idleGap || delta < carConfig.performance.minFrameGap) { samples.current.length = 0; return }
    samples.current.push(delta)
    if (samples.current.length < carConfig.performance.sampleFrames) return
    const mean = samples.current.reduce((sum, value) => sum + value, 0) / samples.current.length
    samples.current.length = 0
    if (mean > 1 / carConfig.performance.targetFps) setDpr(Math.min(devicePixelRatio,
      compact ? carConfig.performance.weakMobileDpr : carConfig.performance.weakDesktopDpr))
  })
  return null
}

export default function SceneCanvas(props: SceneCanvasProps) {
  const portal = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [tabVisible,setTabVisible] = useState(!document.hidden)
  useEffect(() => {
    const update = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting),{rootMargin:'0px'})
    if(host.current)observer.observe(host.current)
    return () => observer.disconnect()
  },[])
  const notifyReady = useCallback((next: boolean) => {
    if (next) setReady(true)
    props.onReady(next)
  }, [props.onReady])
  return <div ref={host} className="canvas-host" data-scene={props.kind} data-ready={ready} style={{position:'absolute',inset:0}}><RenderBoundary fallback={null} onError={error => {
    console.warn('RR Studio: WebGL scene unavailable', error.message)
    props.onReady(false)
    props.onUnavailable(true)
  }}>
    <Canvas orthographic dpr={[1, props.compact ? carConfig.performance.mobileDpr : carConfig.performance.desktopDpr]} frameloop={visible && tabVisible ? 'demand' : 'never'}
      fallback={null} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={props.kind === 'hero' ? { near: carConfig.camera.near, far: carConfig.camera.far, fov: carConfig.camera.fov }
        : { near: 0.1, far: 40, zoom: 100 }}
      onCreated={state => { onCanvasCreated(state); renderAudit.contextsCreated++; state.gl.toneMappingExposure = props.kind === 'hero' || props.kind === 'body' ? carConfig.lighting.exposure : 1 }}
      role="presentation" aria-hidden="true">
      <AdaptiveResolution compact={props.compact} />
      <SceneLifecycle kind={props.kind} active={visible && tabVisible} ready={ready} />
      <StageContents {...props} onReady={notifyReady} portal={portal} ready={ready} />
    </Canvas>
  </RenderBoundary><div className="callout-layer" ref={portal} aria-hidden="true" />
  </div>
}

function SceneLifecycle({kind,active,ready}:{kind:StageKind;active:boolean;ready:boolean}) {
  const {gl,invalidate,scene} = useThree()
  useEffect(() => {
    sceneStats(kind).mounts++; auditEvent('mount',kind)
    const lost=(event:Event)=>{event.preventDefault();renderAudit.lost++;auditEvent('contextlost',kind)}
    const restored=()=>{renderAudit.restored++;auditEvent('contextrestored',kind);invalidate(3)}
    gl.domElement.addEventListener('webglcontextlost',lost)
    gl.domElement.addEventListener('webglcontextrestored',restored)
    return ()=>{sceneStats(kind).unmounts++;auditEvent('unmount',kind);gl.domElement.removeEventListener('webglcontextlost',lost);gl.domElement.removeEventListener('webglcontextrestored',restored)}
  },[gl,invalidate,kind])
  useEffect(()=>{Object.assign(sceneStats(kind),{active,ready});if(active)invalidate(3)},[active,ready,invalidate,kind])
  useFrame(()=>{
    const stats=sceneStats(kind);stats.frames++
    let count=0,showroom=0
    scene.traverseVisible(object=>{
      if(object instanceof T.Mesh)count+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3
      if(object.name.startsWith('Showroom_'))showroom++
    })
    stats.triangles=count
    if(kind==='brake'){stats.visibleShowroomModels=showroom;stats.maxShowroomModels=Math.max(stats.maxShowroomModels||0,showroom)}
  })
  return null
}

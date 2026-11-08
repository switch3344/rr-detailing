import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Html, Line, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { KTX2Loader } from 'three-stdlib'
import * as T from 'three'
import type { Part } from '../content'
import { poseWheels, styleCar } from './carStyle'
import { styleRoxy } from './roxyStyle'
import { styleGT3RS } from './gt3rsStyle'
import { auditEvent } from './diagnostics'

export type Trigger = 'hover' | 'tap' | 'scroll'
export type ModelSource = { src?: string; fallback: () => T.Group }
const base = import.meta.env.BASE_URL
export const modelPath = (file: string) => base + 'models/' + file

export class RenderBoundary extends Component<{
  fallback: ReactNode
  children: ReactNode
  onError?: (error: Error) => void
}, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { this.props.onError?.(error) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function ProceduralModel({ fallback, children }: Pick<ModelSource, 'fallback'> & { children: (model: T.Group) => ReactNode }) {
  const model = useMemo(fallback, [fallback])
  useEffect(() => () => {
    const materials = new Set<T.Material>()
    model.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      object.geometry.dispose()
      for (const material of [object.material].flat()) materials.add(material)
    })
    materials.forEach(material => material.dispose())
  }, [model])
  return children(model)
}

function FileModel({ src, children }: { src: string; children: (model: T.Group) => ReactNode }) {
  const gl = useThree(state => state.gl)
  const loader = useMemo(() => new KTX2Loader().setTranscoderPath(base + 'decoders/basis/').detectSupport(gl), [gl])
  const { scene } = useGLTF(src, base + 'decoders/draco/', true, gltf => gltf.setKTX2Loader(loader))
  const model = useMemo(() => {
    const clone = scene.clone(true)
    const materials=new Map<T.Material,T.Material>()
    clone.traverse(object=>{
      if(!(object instanceof T.Mesh))return
      object.frustumCulled=false
      object.geometry.computeBoundingSphere()
      const copy=(original:T.Material)=>{
        if(!materials.has(original))materials.set(original,original.clone())
        return materials.get(original)!
      }
      object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material)
    })
    if (/\/(porsche-)?gt3rs-/.test(src)) {
      styleGT3RS(clone,gl)
      if(src.includes('/porsche-')&&!(import.meta.env.DEV&&new URLSearchParams(location.search).get('experiment')==='rest'))poseWheels(clone)
    } else if (src.includes('/porsche-roxy-')) {
      styleRoxy(clone,gl);poseWheels(clone)
    } else if (/\/porsche-(studio|roof|wheels)-/.test(src)) {
      styleCar(clone, gl,matchMedia('(max-width:760px), (hover:none), (pointer:coarse)').matches)
      poseWheels(clone)
    }
    return clone
  }, [scene, src, gl])
  useEffect(()=>()=>{
    const materials=new Set<T.Material>()
    model.traverse(object=>{if(object instanceof T.Mesh)for(const material of [object.material].flat())materials.add(material)})
    materials.forEach(material=>material.dispose())
  },[model])
  useEffect(() => () => { loader.dispose() }, [loader])
  return children(model)
}

export function ModelAsset({ src, fallback, children }: ModelSource & { children: (model: T.Group) => ReactNode }) {
  const procedural = <ProceduralModel fallback={fallback}>{children}</ProceduralModel>
  if (!src) return procedural
  return <RenderBoundary key={src} fallback={procedural} onError={error => {auditEvent('asset-error',src);console.warn('RR Studio: GLB fallback', src, error.message)}}>
    <Suspense fallback={null}><FileModel src={src}>{children}</FileModel></Suspense>
  </RenderBoundary>
}

export function useModelSpring(target: number, reduced: boolean, apply: (progress: number, dt: number) => boolean | void) {
  const progress = useRef(target)
  const velocity = useRef(0)
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => { invalidate() }, [invalidate, target, reduced])
  useFrame((_, delta) => {
    const dt = Math.min(0.048, delta)
    if (reduced) {
      progress.current = target
      velocity.current = 0
    } else {
      let remaining = dt
      while (remaining > 0) {
        const step = Math.min(1 / 120, remaining)
        velocity.current += (220 * (target - progress.current) - 27 * velocity.current) * step
        progress.current += velocity.current * step
        remaining -= step
      }
      if (Math.abs(target - progress.current) < 0.001 && Math.abs(velocity.current) < 0.01) {
        progress.current = target
        velocity.current = 0
      }
    }
    const repeat = apply(T.MathUtils.clamp(progress.current, 0, 1), dt)
    if (progress.current !== target || repeat) invalidate()
  }, -2)
}

type BoundPart = { config: Part; node: T.Object3D; start: T.Vector3 }
type Skin = {
  mesh: T.Mesh
  original: T.Material | T.Material[]
  materials: T.Material[]
  opacity: number[]
  color: (T.Color | undefined)[]
  highlight: T.Color
  edge: { value: number }
}

function skinParts(bound: BoundPart[], translucent: boolean) {
  return bound.map(({ node }) => {
    const skins: Skin[] = []
    node.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      const original = object.material as T.Material | T.Material[]
      const materials = [original].flat().map(material => material.clone())
      const edge = { value: 0 }
      if (translucent) for (const material of materials) {
        if (!(material instanceof T.MeshStandardMaterial)) continue
        material.onBeforeCompile = shader => {
          shader.uniforms.rrFresnel = edge
          shader.fragmentShader = 'uniform float rrFresnel;\n' + shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `#include <opaque_fragment>
             float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * rrFresnel;
             gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.10, 0.33, 0.68), rim * 0.73);
             gl_FragColor.a = min(1.0, gl_FragColor.a + rim * 0.35);`,
          )
        }
      }
      object.material = Array.isArray(original) ? materials : materials[0]
      skins.push({
        mesh: object, original, materials, opacity: materials.map(material => material.opacity),
        color: materials.map(material => 'color' in material && material.color instanceof T.Color ? material.color.clone() : undefined),
        highlight: new T.Color('#407fb8'),
        edge,
      })
    })
    return skins
  })
}

function wave(a: T.Vector3, b: T.Vector3) {
  return [a.clone(),b.clone()]
}

function Callout({ part, localFrom, portal, lane }: {
  part: BoundPart; localFrom: (object: T.Object3D, point: T.Vector3) => T.Vector3
  portal?: RefObject<HTMLDivElement | null>
  lane?: number
}) {
  const { config, node } = part
  const line = useRef<T.Object3D>(null)
  const caption = useRef<T.Group>(null)
  const zero = useMemo(() => wave(new T.Vector3(), new T.Vector3(0.01, 0, 0)), [])
  const offset = useMemo(() => new T.Vector3(...(config.labelOffset ?? [0.13, 0.19, 0.12])), [config])
  const camera = useThree(state => state.camera)
  useFrame(() => {
    if (!node.parent) return
    const current = localFrom(node.parent, node.position)
    const end = current.clone().add(offset)
    if (lane !== undefined) {
      const depth = node.getWorldPosition(new T.Vector3()).project(camera).z
      const world = new T.Vector3(lane < 4 ? -.62 : .62, .73 - (lane % 4) * .43, depth).unproject(camera)
      end.copy(localFrom(camera, camera.worldToLocal(world)))
    }
    const object = line.current as unknown as { geometry: { setPositions: (data: number[]) => void } } | null
    object?.geometry.setPositions(wave(current, end).flatMap(point => point.toArray()))
    if (caption.current) {
      caption.current.position.copy(end)
      caption.current.updateWorldMatrix(true, false)
    }
  }, -1)
  return <>
    <Line ref={line as never} points={zero} color="#9aa3ae" lineWidth={1.1} transparent opacity={0.88}
      depthTest={false} renderOrder={12} frustumCulled={false} raycast={() => null} />
    {config.label && <group ref={caption}>
      <Html center className="callout-label" portal={portal as RefObject<HTMLElement>}
        zIndexRange={[4, 1]} wrapperClass="callout-anchor" style={{ pointerEvents: 'none' }}>
        <strong>{config.label}</strong>
      </Html>
    </group>}
  </>
}

export type ExplodableProps = ModelSource & {
  parts: Part[]
  trigger?: Trigger
  open?: boolean
  enabled?: boolean
  reduced?: boolean
  translucent?: boolean
  detailed?: boolean
  onToggle?: () => void
  onPart?: (part: Part | null) => void
  onReady?: (ready: boolean) => void
  portal?: RefObject<HTMLDivElement | null>
  leader?: RefObject<SVGPathElement | null>
  fit?: boolean
  showLabels?: boolean
}

function AnimatedParts({
  model, parts, trigger = 'hover', open, enabled = true, reduced = false,
  translucent = false, detailed = false, onToggle, onPart, onReady, portal, leader, fit, showLabels = true,
}: Omit<ExplodableProps, keyof ModelSource> & { model: T.Group }) {
  const [hover, setHover] = useState(false)
  const [tap, setTap] = useState(false)
  const [selected, setSelected] = useState<BoundPart | null>(null)
  const [lines, setLines] = useState(false)
  const skins = useRef<Skin[][]>([])
  const group = useRef<T.Group>(null)
  const camera = useThree(state => state.camera)
  const sceneWidth = useThree(state => state.size.width)
  const invalidate = useThree(state => state.invalidate)
  const projected = useMemo(() => new T.Vector3(), [])
  useLayoutEffect(() => { invalidate() }, [selected, invalidate])
  useFrame(() => {
    if (!selected || !active || !leader?.current) return
    selected.node.getWorldPosition(projected).project(camera)
    const x = T.MathUtils.clamp((projected.x + 1) * 500, 10, 990)
    const y = T.MathUtils.clamp((1 - projected.y) * 500, 10, 980)
    leader.current.setAttribute('d', `M ${x} ${y} L ${x} 965 L 500 1000`)
  }, -1)
  const canvas = useThree(state => state.gl.domElement)
  const bound = useMemo(() => parts.flatMap(config => {
    const node = model.getObjectByName(config.nodeName)
    if (node) return [{ config, node, start: node.position.clone() }]
    console.warn('RR Studio: missing model node', config.nodeName)
    auditEvent('missing-node',config.nodeName)
    return []
  }), [model, parts])
  const active = enabled && (open ?? (trigger === 'hover' && hover || trigger !== 'scroll' && tap))
  const target = active ? 1 : 0

  useLayoutEffect(() => {
    skins.current = skinParts(bound, translucent)
    return () => skins.current.flat().forEach(skin => {
      skin.mesh.material = skin.original
      skin.materials.forEach(material => material.dispose())
    })
  }, [bound, translucent])
  useEffect(() => {
    onReady?.(true)
    return () => onReady?.(false)
  }, [onReady])
  useEffect(() => { setHover(false) }, [open])
  useEffect(() => {
    function leaveCanvas() {
      setHover(false)
      if (!open) {
        setSelected(null)
        onPart?.(null)
      }
    }
    canvas.addEventListener('pointerleave', leaveCanvas)
    return () => canvas.removeEventListener('pointerleave', leaveCanvas)
  }, [canvas, open, onPart])
  useEffect(() => {
    if (!active) { setSelected(null); onPart?.(null) }
  }, [active, onPart])
  const isDrawing = useRef(false)
  useModelSpring(target, reduced, p => {
    if (fit && camera instanceof T.OrthographicCamera && typeof camera.userData.rrBaseZoom === 'number') {
      const zoom = camera.userData.rrBaseZoom * (1 - p * 0.19)
      if (camera.zoom !== zoom) {
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      }
    }
    const show = p > 0.31
    if (show !== isDrawing.current) {
      isDrawing.current = show
      setLines(show)
    }
    for (const [i, part] of bound.entries()) {
      const { delay, explodeVector } = part.config
      const stagger = T.MathUtils.smoothstep(p, delay, 1)
      part.node.position.set(
        part.start.x + explodeVector[0] * stagger,
        part.start.y + explodeVector[1] * stagger,
        part.start.z + explodeVector[2] * stagger,
      )
      for (const skin of skins.current[i] ?? []) {
        skin.edge.value = stagger
        for (const [j, material] of skin.materials.entries()) {
          const fade = translucent && !material.userData.rrKeepOpaque
          const opacity = fade ? T.MathUtils.lerp(skin.opacity[j], 0.56, stagger) : skin.opacity[j]
          const transparent = opacity < 0.99 || [skin.original].flat()[j].transparent
          if (transparent !== material.transparent) {
            material.transparent = transparent
            material.depthWrite = !transparent
            material.needsUpdate = true
          }
          material.opacity = opacity
          const initial = skin.color[j]
          if (initial && 'color' in material && material.color instanceof T.Color) {
            material.color.copy(initial).lerp(skin.highlight, selected === part && active ? 0.70 : fade ? stagger * 0.20 : 0)
          }
        }
      }
    }
  })

  function find(event: ThreeEvent<PointerEvent | MouseEvent>) {
    let object: T.Object3D | null = event.object
    while (object && object !== model) {
      const current = object
      const part = bound.find(candidate => candidate.node === current)
      if (part) return part
      object = object.parent
    }
    return null
  }
  function select(part: BoundPart | null) {
    setSelected(part)
    onPart?.(part?.config ?? null)
  }
  function inspect(event: ThreeEvent<PointerEvent>) {
    if (!enabled || event.pointerType === 'touch') return
    event.stopPropagation()
    if (trigger === 'hover' && open === undefined) setHover(true)
    if (detailed && (active || trigger === 'hover' && open === undefined)) {
      const part = find(event)
      if (part && part !== selected) select(part)
    }
  }
  function localFrom(object: T.Object3D, point: T.Vector3) {
    return group.current?.worldToLocal(object.localToWorld(point.clone())) ?? point.clone()
  }

  return <group ref={group}>
    <group onPointerOver={inspect} onPointerMove={inspect} onClick={event => {
      if (!enabled) return
      event.stopPropagation()
      const part = find(event)
      if (detailed && active && part) select(part)
      else if (trigger !== 'scroll') {
        if (onToggle) onToggle()
        else setTap(value => !value)
      }
    }}>
      <primitive object={model} />
    </group>
    {showLabels && active && lines && bound.filter(part => part.config.label && (!detailed || sceneWidth>540 || selected===part)).map((part,index) =>
      <Callout key={part.config.nodeName} part={part} localFrom={localFrom} portal={portal} lane={detailed&&sceneWidth>540?index:undefined} />)}
  </group>
}

export function ExplodableModel({ src, fallback, ...props }: ExplodableProps) {
  return <ModelAsset src={src} fallback={fallback}>
    {model => <AnimatedParts model={model} {...props} />}
  </ModelAsset>
}

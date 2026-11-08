import { useEffect, useRef } from 'react'

const palette = Array.from({ length: 96 }, (_, index) => {
  const level = index / 95
  const color = level < .65 ? [17, 28, 39] : [30, 106, 129]
  const light = level < .65 ? [30, 106, 129] : [176, 234, 240]
  const blend = level < .65 ? level / .65 : (level - .65) / .35
  return 'rgb(' + color.map((channel, i) => Math.round(channel + (light[i] - channel) * blend)).join(',') + ')'
})

type Cell = { path: Path2D; x: number; y: number; phase: number }

export function ContactGlow({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = ref.current
    const parent = element?.parentElement
    const drawing = element?.getContext('2d')
    if (!element || !parent || !drawing) return
    const canvas = element
    const card = parent
    const context = drawing

    let cells: Cell[] = []
    let width = 0
    let height = 0
    let frame = 0
    let visible = false
    let elapsed = 0
    let last = 0
    const pointer = { x: .8, y: .36, strength: 0 }
    const target = { ...pointer }

    function paint(delta: number) {
      const follow = 1 - Math.exp(-delta * 7)
      pointer.x += (target.x - pointer.x) * follow
      pointer.y += (target.y - pointer.y) * follow
      pointer.strength += (target.strength - pointer.strength) * follow

      const lightX = .77 + Math.sin(elapsed * .63) * .15
      const lightY = .37 + Math.sin(elapsed * .71 + .3) * .22
      const ratio = width / height
      context.clearRect(0, 0, width, height)
      for (const { path, x, y, phase } of cells) {
        const sweep = Math.sin(9 * x - 5 * y + Math.sin(6 * y + elapsed * .73) - elapsed * 1.35)
        const streak = Math.pow(.5 + .5 * sweep, 3)
        const pool = Math.exp(-((x - lightX) ** 2 * 16 + (y - lightY) ** 2 * 7))
        const cursor = Math.exp(-14 * (((x - pointer.x) * ratio) ** 2 + (y - pointer.y) ** 2))
        const shimmer = .024 * Math.sin(phase + elapsed * 1.8)
        const energy = .095 + streak * (.12 + .18 * x) + .59 * pool + cursor * pointer.strength * .68 + shimmer
        context.fillStyle = palette[Math.round(Math.max(0, Math.min(1, energy)) * 95)]
        context.fill(path)
      }
    }

    function resize() {
      width = card.clientWidth
      height = card.clientHeight
      if (!width || !height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const columns = Math.max(1, Math.round(width / 13))
      const rows = Math.max(1, Math.round(height / 24))
      const pitchX = width / columns
      const pitchY = height / rows
      cells = []
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const path = new Path2D()
          path.roundRect(column * pitchX + 1.25, row * pitchY + 1.25, pitchX - 2.5, pitchY - 2.5, 3.2)
          cells.push({ path, x: (column + .5) / columns, y: (row + .5) / rows, phase: 5.1 * column + 2.3 * row })
        }
      }
      paint(0)
    }

    function schedule() {
      if (!frame && visible && !reduced && !document.hidden) frame = requestAnimationFrame(tick)
    }

    function tick(now: number) {
      frame = 0
      if (!visible || document.hidden) return
      if (!last || now - last >= 30) {
        const delta = last ? Math.min((now - last) / 1000, .05) : .03
        last = now
        elapsed += delta
        paint(delta)
      }
      schedule()
    }

    function move(event: PointerEvent) {
      if (event.pointerType === 'touch') return
      const bounds = card.getBoundingClientRect()
      target.x = (event.clientX - bounds.left) / bounds.width
      target.y = (event.clientY - bounds.top) / bounds.height
      target.strength = 1
    }

    function leave() { target.strength = 0 }

    const resizeObserver = new ResizeObserver(resize)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      schedule()
    })
    resize()
    resizeObserver.observe(card)
    visibilityObserver.observe(card)
    document.addEventListener('visibilitychange', schedule)
    if (!reduced) {
      card.addEventListener('pointermove', move)
      card.addEventListener('pointerleave', leave)
    }
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      document.removeEventListener('visibilitychange', schedule)
      card.removeEventListener('pointermove', move)
      card.removeEventListener('pointerleave', leave)
    }
  }, [reduced])

  return <canvas ref={ref} className="contact-glow" aria-hidden="true" />
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { content } from './content'
import { ActionLink, Brand, Icon } from './components/ui'
import { HeroVisual, ServiceScene, useNearbyStages } from './components/Stage'
import { ContactFooter } from './components/Footer'
import { TuningScene } from './components/TuningScene'
import visual from './three/car-config.json'

const mobileQuery = '(max-width: 760px), (hover: none), (pointer: coarse)'

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const media = matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

function usePagePosition(reduced: boolean) {
  const hero = useRef<HTMLElement>(null)
  const contact = useRef<HTMLElement>(null)
  const progress = useRef(0)
  const [position, setPosition] = useState<'hero' | 'content' | 'contact'>('hero')

  useEffect(() => {
    let frame = 0
    function update() {
      frame = 0
      const intro = hero.current?.getBoundingClientRect()
      const footer = contact.current?.getBoundingClientRect()
      const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0
      if (!intro || !footer) return
      setPosition(intro.bottom > header ? 'hero' : footer.top > innerHeight * .78 ? 'content' : 'contact')
      const next = reduced ? 0 : Math.max(0, Math.min(1, (header - intro.top) / intro.height))
      if (next !== progress.current) {
        progress.current = next
        window.dispatchEvent(new Event('rr:hero'))
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    if (hero.current) observer.observe(hero.current)
    if (contact.current) observer.observe(contact.current)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [reduced])

  return { hero, contact, progress, position }
}

function Header({ showContact }: { showContact: boolean }) {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggle.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return <header className="site-header">
    <div className="shell header-inner">
      <Brand />
      <nav id="primary-nav" className={open ? 'main-nav nav-open' : 'main-nav'} aria-label={content.ui.navigation}>
        {content.navigation.map(item => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
      </nav>
      <div className="header-actions">
        {showContact && <ActionLink onClick={() => setOpen(false)} />}
        <button ref={toggle} type="button" className="nav-toggle" aria-expanded={open} aria-controls="primary-nav"
          aria-label={open ? content.ui.closeMenu : content.ui.openMenu} onClick={() => setOpen(value => !value)}>
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </div>
    </div>
  </header>
}

export default function App() {
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const compact = useMedia(mobileQuery)
  const { hero, contact, progress, position } = usePagePosition(reduced)
  const nearby = useNearbyStages()
  const services = content.services
  useLayoutEffect(() => {
    if (location.hash.length > 1) {
      const target = location.hash.slice(1)
      const removedSections = ['packages', 'process', 'master', 'booking', 'privacy']
      const section = removedSections.includes(target) ? 'contact' : target
      if (section !== target) history.replaceState(null, '', '#contact')
      document.getElementById(section)?.scrollIntoView({ behavior: 'instant' })
    }
  }, [])

  return <>
    <div id="top" />
    <a className="skip-link" href="#main">{content.ui.skip}</a>
    <Header showContact={position === 'hero'} />
    <main id="main">
      <section ref={hero} className="hero" aria-labelledby="hero-title">
        <HeroVisual nearby={nearby} reduced={reduced} compact={compact} progress={progress} />
        <div className="shell hero-copy">
          <h1 id="hero-title">{content.hero.title.map((line,index)=><span className="hero-line" key={line}><span style={{animationDelay:`${index*visual.site.revealDelayMs}ms`}}>{line}</span></span>)}</h1>
          <p id="how-it-works">{content.hero.text}</p>
        </div>
        <div className="studio-background" aria-hidden="true"><i /><i /><i /><span /></div>
      </section>
      <section className="services-section" id="services" aria-labelledby="services-title">
        <div className="shell section-header services-header">
          <h2 id="services-title">{services.title}</h2>
        </div>
        {services.scenes.map(scene => scene.id==='brake'?<TuningScene key={scene.id} nearby={nearby} reduced={reduced} compact={compact} />:
          <ServiceScene key={scene.id} scene={scene} nearby={nearby} reduced={reduced} compact={compact} />)}
      </section>
    </main>
    <ContactFooter sectionRef={contact} reduced={reduced} />
    {position === 'content' && <div className="floating-contact"><ActionLink /></div>}
  </>
}

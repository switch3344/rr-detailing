import type { ReactNode } from 'react'
import { content } from '../content'

export function LogoRR({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 56 44" fill="none" aria-hidden="true">
    <path fill="#9AA3AE" d="M15 4h19c10 0 16 5 16 13 0 6-3 10-9 12l11 11H40L28 27h-4v13h-9zm9 8v8h10c4 0 6-1 6-4 0-2-2-4-6-4z" />
    <path fill="#5B8DEF" d="M3 4h19c10 0 16 5 16 13 0 6-3 10-9 12l11 11H28L16 27h-4v13H3zm9 8v8h10c4 0 6-1 6-4 0-2-2-4-6-4z" />
  </svg>
}

const icons: Record<string, ReactNode> = {
  telegram:<path d="m3 11 18-7-5 17-5-6-4 3 1-6 9-6-7 8z" />,
  phone:<path d="M6 3h4l2 5-3 2c2 4 3 5 7 7l2-3 4 2v4c-1 3-6 2-11-2S2 7 4 4z" />,
  whatsapp:<><path d="M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5A9 9 0 1 1 21 11.5Z"/><path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 1c0 3-3 3-6 1S6 10 8 7Z"/></>,
  down: <path d="M12 4v15m-5-5 5 5 5-5" />,
  expand: <path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5m4-7 8 8m0-8-8 8" />,
  collapse: <path d="m4 4 5 5m6 6 5 5m0-16-5 5M4 20l5-5M4 9h5V4m6 0v5h5m0 6h-5v5m-6 0v-5H4" />,
  menu: <path d="M4 8h16M4 16h16" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

export function Brand() {
  return <a href="#top" className="brand" aria-label={content.brand}>
    <LogoRR /><span>{content.brand}</span>
  </a>
}

export function ActionLink({ onClick }: { onClick?: () => void }) {
  return <a className="button button-primary" href="#contact" onClick={onClick}>{content.action}</a>
}

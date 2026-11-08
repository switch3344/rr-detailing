import type { StageKind } from '../three/SceneCanvas'

export function ModelDiagram({ kind, expanded }: { kind: StageKind; expanded: boolean }) {
  return <svg className={'model-diagram' + (expanded ? ' diagram-expanded' : '')}
    viewBox="0 0 560 290" fill="none" aria-hidden="true">
    <g stroke="#59616a" strokeWidth="1" strokeDasharray="4 6" opacity=".55">
      <path d="M45 222h470M280 27v224" /><ellipse cx="280" cy="202" rx="206" ry="50" />
    </g>
    {kind === 'brake' ? <g stroke="#8a929c" strokeWidth="2" transform="translate(278 147)">
      <g className="diagram-shift" style={{ transform: expanded ? 'translate(-75px,15px)' : '' }}>
        <circle r="71" fill="#1c222a" /><circle r="53" fill="#313943" /><circle r="20" /><circle r="7" />
        {[0, 60, 120, 180, 240, 300].map(angle => <path key={angle} d="M0-20v-32" transform={'rotate(' + angle + ')'} />)}
      </g>
      <g className="diagram-shift" style={{ transform: expanded ? 'translate(68px,-6px)' : '' }}>
        <path d="M55-54c19 8 33 22 37 44l-19 12c-5-15-14-28-29-36Z" fill="#3c4651" />
        <path d="m-18-81 55-24m-53 38 54-24m-52 38 56-24m-49 36 56-24" />
      </g>
    </g> : kind === 'engine' ? <g stroke="#87929c" strokeWidth="1.9" strokeLinejoin="round" transform="translate(280 148)">
      <path d="m-55-21 110-15 32 23-12 58-121 19-37-26Z" fill="#293038" />
      <path d="m-49 4 96-13m-96 24 96-13m-96 23 96-13m-96 23 96-13" opacity=".65" />
      <g className="diagram-shift" style={{ transform: expanded ? 'translate(-59px,13px)' : '' }}>
        <path d="m-118-15 55-11 21 16-6 48-55 9-22-16Z" fill="#3c4651" />
        <path d="m-111 4 46-9m-48 20 46-9m-48 20 46-9" />
      </g>
      <g className="diagram-shift" style={{ transform: expanded ? 'translate(59px,-3px)' : '' }}>
        <path d="m59-30 54-11 22 15-6 47-55 10-22-16Z" fill="#3c4651" />
        <path d="m69-9 48-9m-49 20 48-9m-49 20 48-9" />
      </g>
      <g className="diagram-shift" style={{ transform: expanded ? 'translate(0,-49px)' : '' }}>
        <path d="m-46-50 82-13 27 17-7 15-82 13-26-16Z" fill="#353e48" />
        <path d="m-25-30-35 20m60-24-35 20m60-24-35 20m47-29 23 11m-1-16 23 11" />
      </g>
    </g> : <g stroke="#87929c" strokeWidth="1.9" strokeLinejoin="round">
      <path d="M88 189 92 164l28-25 91-12 45-43c18-13 96-15 129-3l53 45 36 10 15 24-6 27-38 8-20-5-237 7-31-9Z" fill="#222830" />
      <path d="M211 127l52-39c23-10 78-12 113-1l42 38-44 4Z" fill="#353e48" />
      <path d="m92 164 108 1 21-31m-3 29 236-16m-248 19-16 31m116-68 2 61m-219-4 67 3m275-18 50-13" />
      <circle cx="162" cy="192" r="28" fill="#12161b" /><circle cx="162" cy="192" r="17" fill="#38414a" />
      <circle cx="423" cy="187" r="27" fill="#12161b" /><circle cx="423" cy="187" r="16" fill="#38414a" />
      {expanded && <g stroke="#9aa3ae" fill="#323c46">
        <path d="m105 95 100-11 18-23-76 3Z" /><path d="m136 94 16 35m144-62-10 20m93 115 30 19" strokeDasharray="4 4" />
        <path d="m250 63 33-29 76-3 35 29Z" /><path d="m282 223 133-14-13 27-113 9Z" />
      </g>}
    </g>}
  </svg>
}

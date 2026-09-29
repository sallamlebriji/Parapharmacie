import type { Shape } from '../lib/types'

// Stylised packshots drawn in SVG: consistent art direction across the catalogue,
// crisp at any size and no dependency on external image hosting.

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 110
}

export function ProductVisual({ shape, color, brand, name, className = '', bg = true }: { shape: Shape; color: string; brand: string; name?: string; className?: string; bg?: boolean }) {
  const id = `g${shape}${color.slice(1)}`
  const body = `url(#${id}b)`
  const cap = isDark(color) ? '#c9a96e' : shade(color, -70)
  const labelText = isDark(color) ? '#f6eedf' : '#3c5143'
  const label = (x: number, y: number, w: number, h: number) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={isDark(color) ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.72)'} />
      <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontFamily="Fraunces, serif" fontSize={Math.min(11, w / 6)} fill={labelText} fontWeight={500}>{brand}</text>
      <line x1={x + w * 0.3} x2={x + w * 0.7} y1={y + h / 2 + 5} y2={y + h / 2 + 5} stroke={labelText} strokeOpacity={0.35} strokeWidth={1} />
    </g>
  )
  let art: JSX.Element
  switch (shape) {
    case 'jar':
      art = <g>
        <rect x={55} y={78} width={90} height={16} rx={4} fill={cap} />
        <rect x={50} y={92} width={100} height={66} rx={14} fill={body} />
        {label(62, 108, 76, 32)}
      </g>
      break
    case 'tube':
      art = <g>
        <path d="M72 42 h56 l-6 104 h-44 z" fill={body} />
        <rect x={70} y={36} width={60} height={8} rx={2} fill={shade(color, -25)} />
        <rect x={84} y={146} width={32} height={20} rx={4} fill={cap} />
        {label(80, 78, 40, 40)}
      </g>
      break
    case 'pump':
      art = <g>
        <rect x={92} y={36} width={16} height={14} rx={2} fill={cap} />
        <rect x={92} y={36} width={34} height={7} rx={3} fill={cap} />
        <rect x={86} y={50} width={28} height={14} rx={3} fill={shade(color, -40)} />
        <rect x={66} y={62} width={68} height={100} rx={16} fill={body} />
        {label(76, 92, 48, 40)}
      </g>
      break
    case 'dropper':
      art = <g>
        <ellipse cx={100} cy={52} rx={11} ry={14} fill={cap} />
        <rect x={88} y={62} width={24} height={20} rx={3} fill={shade(color, -60)} />
        <rect x={72} y={80} width={56} height={80} rx={12} fill={body} />
        {label(80, 104, 40, 34)}
      </g>
      break
    case 'spray':
      art = <g>
        <rect x={88} y={40} width={24} height={18} rx={4} fill={cap} />
        <rect x={110} y={46} width={10} height={5} rx={2} fill={cap} />
        <rect x={82} y={56} width={36} height={12} rx={3} fill={shade(color, -35)} />
        <rect x={68} y={66} width={64} height={96} rx={20} fill={body} />
        {label(78, 98, 44, 36)}
      </g>
      break
    case 'box':
      art = <g>
        <path d="M62 60 l14 -12 h62 l-14 12 z" fill={shade(color, 18)} />
        <path d="M124 60 l14 -12 v96 l-14 12 z" fill={shade(color, -30)} />
        <rect x={62} y={60} width={62} height={96} rx={2} fill={body} />
        {label(68, 88, 50, 38)}
      </g>
      break
    case 'stick':
      art = <g>
        <rect x={84} y={38} width={32} height={44} rx={8} fill={cap} />
        <rect x={84} y={78} width={32} height={84} rx={8} fill={body} />
        <text x={100} y={122} textAnchor="middle" fontFamily="Fraunces, serif" fontSize={8} fill={labelText} transform="rotate(-90 100 122)">{brand}</text>
      </g>
      break
    default:
      art = <g>
        <rect x={86} y={36} width={28} height={22} rx={4} fill={cap} />
        <rect x={90} y={56} width={20} height={10} fill={shade(color, -35)} />
        <path d="M70 84 q0 -18 22 -20 h16 q22 2 22 20 v66 q0 12 -12 12 h-36 q-12 0 -12 -12 z" fill={body} />
        {label(78, 100, 44, 40)}
      </g>
  }
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={name ? `${brand} — ${name}` : brand}>
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="1">
          <stop offset="0" stopColor={shade(color, 14)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -22)} />
        </linearGradient>
        <radialGradient id={`${id}bg`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={shade(color, isDark(color) ? 150 : 8)} stopOpacity={0.55} />
        </radialGradient>
      </defs>
      {bg && <rect width="200" height="200" fill={`url(#${id}bg)`} />}
      <ellipse cx={100} cy={166} rx={48} ry={6} fill="#1f2622" opacity={0.07} />
      {art}
      <rect x={shape === 'box' ? 68 : 74} y={70} width={5} height={70} rx={2.5} fill="#fff" opacity={0.28} />
    </svg>
  )
}

import { useRef, type ReactNode } from 'react'
import { canHover } from '../lib/motion'
import { cx } from './ui'

/**
 * Very light CSS-3D tilt for product visuals (perspective 1100px, rotateX ±4°, rotateY ±6°) with a
 * radial light reflection following the pointer. No WebGL. Disabled on touch devices and when the
 * user prefers reduced motion. Updates are batched in one requestAnimationFrame.
 */
export function Tilt({ children, className, max = { x: 4, y: 6 } }: { children: ReactNode; className?: string; max?: { x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !canHover()) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(0.5 - py) * 2 * max.x}deg`)
      el.style.setProperty('--ry', `${(px - 0.5) * 2 * max.y}deg`)
      el.style.setProperty('--gx', `${px * 100}%`)
      el.style.setProperty('--gy', `${py * 100}%`)
      el.dataset.tilt = 'on'
    })
  }
  const reset = () => {
    cancelAnimationFrame(frame.current)
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.dataset.tilt = 'off'
  }

  return (
    <div className={cx('[perspective:1100px]', className)} onPointerMove={onMove} onPointerLeave={reset}>
      <div
        ref={ref}
        data-tilt="off"
        className="group/tilt relative h-full w-full [transform-style:preserve-3d] transition-transform duration-500 ease-signature will-change-transform"
        style={{ transform: 'rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(0)' }}
      >
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-data-[tilt=on]/tilt:opacity-100"
          style={{ background: 'radial-gradient(circle at var(--gx, 50%) var(--gy, 30%), rgb(255 255 255 / 0.35), transparent 55%)' }}
        />
      </div>
    </div>
  )
}

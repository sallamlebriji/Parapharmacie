import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Star, X } from 'lucide-react'
import type { OrderStatus, PaymentStatus, POStatus } from '../lib/types'
import type { StockState } from '../lib/logic'
import { dialog, drawer as drawerVariants, DURATION, EASE, overlay } from '../lib/motion'

export const cx = (...c: (string | number | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ───────────────────────── Layout primitives ───────────────────────── */

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div className="min-w-0">
        {eyebrow && <div className="text-caption uppercase tracking-[0.16em] text-champagne-600 font-semibold mb-1.5">{eyebrow}</div>}
        <h1 className="text-[26px] md:text-h1 text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '', title, action, padded = true, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean; subtitle?: ReactNode }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h3 className="font-sans text-[15px] font-semibold text-ink leading-6">{title}</h3>
            {subtitle && <p className="text-xs text-soft mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? cx('px-5 pb-5', !title && !action && 'pt-5') : ''}>{children}</div>
    </section>
  )
}

const TONES: Record<string, string> = {
  sage: 'bg-sage-100 text-sage-700',
  teal: 'bg-teal-100 text-teal-600',
  gold: 'bg-champagne-100 text-champagne-600',
  rose: 'bg-rose-soft text-rose-ink',
  amber: 'bg-amber-soft text-amber-ink',
  sky: 'bg-sky-soft text-sky-ink',
  neutral: 'bg-cream text-muted',
  dark: 'bg-sage-800 text-white',
}
export function Badge({ tone = 'neutral', children, dot, className }: { tone?: string; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('chip', TONES[tone] ?? TONES.neutral, className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}

/* ───────────────────────── Numbers ───────────────────────── */

/**
 * Counts up to the value when it enters the viewport (1.6 s). Accepts formatted strings such as
 * « 157.700 DH » or « 45,9 % » and keeps their prefix, suffix and separators.
 */
export function AnimatedNumber({ value, className }: { value: string | number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduce = useReducedMotion()
  const str = String(value)
  const m = str.match(/^([^\d-]*)(-?\d[\d\s.  ]*(?:,\d+)?)(.*)$/)
  const target = m ? Number(m[2].replace(/[\s.  ]/g, '').replace(',', '.')) : NaN
  const decimals = m && m[2].includes(',') ? m[2].split(',')[1].length : 0
  const group = m?.[2].match(/\d([\s.  ])\d{3}/)?.[1] ?? ''
  const fmt = (n: number) => {
    const [int, dec] = Math.abs(n).toFixed(decimals).split('.')
    return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (dec ? ',' + dec : '')
  }
  const [shown, setShown] = useState(() => (reduce || Number.isNaN(target) ? str : `${m![1]}${fmt(0)}${m![3]}`))
  useEffect(() => {
    if (Number.isNaN(target) || !m) { setShown(str); return }
    if (reduce) { setShown(str); return }
    if (!inView) return
    const c = animate(0, target, { duration: DURATION.counter, ease: EASE, onUpdate: (v) => setShown(`${m[1]}${fmt(v)}${m[3]}`) })
    return () => c.stop()
  }, [inView, str]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className={cx('num', className)} aria-label={str}>{shown}</span>
}

export function Delta({ value, suffix }: { value?: number; suffix?: string }) {
  if (value === undefined || !Number.isFinite(value)) return null
  const up = value >= 0
  return (
    <span className={cx('inline-flex items-center gap-0.5 font-medium num', up ? 'text-sage-600' : 'text-rose-ink')}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      {Math.abs(value).toFixed(1).replace('.', ',')} %{suffix && <span className="text-soft font-normal ml-1">{suffix}</span>}
    </span>
  )
}

export function Stat({ label, value, delta, hint, icon, tone = 'sage', to }: { label: string; value: ReactNode; delta?: number; hint?: string; icon?: ReactNode; tone?: string; to?: string }) {
  const body = (
    <div className={cx('card p-4 h-full', to && 'card-hover')}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted font-medium">{label}</span>
        {icon && <span className={cx('size-8 grid place-items-center rounded-xl', TONES[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight text-ink num">
        {typeof value === 'string' || typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
        <Delta value={delta} />
        {hint && <span className="text-soft">{hint}</span>}
      </div>
    </div>
  )
  return to ? <Link to={to} className="block rounded-[var(--radius-card)]">{body}</Link> : body
}

/* ───────────────────────── Controls ───────────────────────── */

/** Segmented control with a sliding indicator. */
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const id = useId()
  return (
    <div role="tablist" className={cx('inline-flex p-1 rounded-xl bg-cream border border-line gap-0.5 overflow-x-auto max-w-full scrollbar-thin', className)}>
      {tabs.map((t) => {
        const active = value === t.id
        return (
          <button key={t.id} role="tab" aria-selected={active} onClick={() => onChange(t.id)} className={cx('relative h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors', active ? 'text-ink' : 'text-muted hover:text-ink')}>
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-lg bg-surface shadow-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative">
              {t.label}
              {t.count !== undefined && <span className={cx('ml-1.5 num', active ? 'text-sage-600' : 'text-soft')}>{t.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-soft mt-1">{hint}</span>}
    </label>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-300 cursor-pointer', on ? 'bg-accent' : 'bg-sand')}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 36 }} className={cx('absolute top-0.5 size-4 rounded-full bg-surface shadow', on ? 'right-0.5' : 'left-0.5')} />
    </button>
  )
}

/* ───────────────────────── Overlays ───────────────────────── */

function useOverlay(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog for keyboard and screen-reader users.
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Fermer"])')?.focus() ?? panel.current?.focus(), 60)
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; clearTimeout(t); previous?.focus?.() }
  }, [open, onClose])
  return panel
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const panel = useOverlay(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-overlay)] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div variants={overlay} initial="hidden" animate="show" exit="exit" className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            ref={panel} role="dialog" aria-modal="true" tabIndex={-1} variants={dialog} initial="hidden" animate="show" exit="exit"
            className={cx('relative bg-surface w-full rounded-t-[1.5rem] sm:rounded-[1.5rem] shadow-float border border-line max-h-[92vh] flex flex-col outline-none', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
          >
            <header className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-h2">{title}</h2>
              <button onClick={onClose} className="btn-ghost h-8 w-8 p-0" aria-label="Fermer"><X className="size-4" /></button>
            </header>
            <div className="p-6 overflow-y-auto scrollbar-thin">{children}</div>
            {footer && <footer className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-2 bg-ivory/60 rounded-b-[1.5rem]">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, children, side = 'right', footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; side?: 'left' | 'right'; footer?: ReactNode }) {
  const panel = useOverlay(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-overlay)]">
          <motion.div variants={overlay} initial="hidden" animate="show" exit="exit" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            ref={panel} role="dialog" aria-modal="true" tabIndex={-1} variants={drawerVariants(side)} initial="hidden" animate="show" exit="exit"
            className={cx('absolute inset-y-0 w-[22rem] max-w-[88vw] bg-surface shadow-float flex flex-col outline-none', side === 'left' ? 'left-0 border-r border-line' : 'right-0 border-l border-line')}
          >
            {title && (
              <header className="flex items-center justify-between px-5 h-16 border-b border-line shrink-0">
                <div className="font-display text-xl">{title}</div>
                <button onClick={onClose} className="btn-ghost h-8 w-8 p-0" aria-label="Fermer"><X className="size-4" /></button>
              </header>
            )}
            <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
            {footer && <footer className="p-4 border-t border-line">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ───────────────────────── Feedback ───────────────────────── */

/** Soft illustrated empty state: an icon floating on concentric rings. */
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="relative mx-auto size-24 mb-5" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-sage-50" />
        <span className="absolute inset-3 rounded-full bg-sage-100/70" />
        <span className="absolute inset-[26px] rounded-2xl bg-surface shadow-soft border border-line grid place-items-center text-sage-500 animate-float">
          {icon ?? <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3c-3.5 2.6-5.5 5.7-5.5 8.8a5.5 5.5 0 0 0 11 0C17.5 8.7 15.5 5.6 12 3Z" /><path d="M12 8v9M9 13.5h6" strokeLinecap="round" /></svg>}
        </span>
      </div>
      <div className="font-semibold text-ink">{title}</div>
      {text && <p className="text-sm text-muted mt-1.5 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${value} sur 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
          <Star className="absolute inset-0 text-sand" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, value - i + 1)) * 100}%` }}>
            <Star className="text-champagne-400" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      ))}
    </span>
  )
}

/** Progress bar animated with transform (GPU) rather than width. */
export function Progress({ value, tone = 'sage', className }: { value: number; tone?: 'sage' | 'gold' | 'rose' | 'amber' | 'teal'; className?: string }) {
  const c = { sage: 'bg-sage-500', gold: 'bg-champagne-400', rose: 'bg-rose-ink', amber: 'bg-amber-ink', teal: 'bg-teal-500' }[tone]
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cx('h-1.5 rounded-full bg-cream overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cx('h-full w-full rounded-full origin-left', c)} initial={{ scaleX: 0 }} animate={{ scaleX: v / 100 }} transition={{ duration: 0.9, ease: EASE }} />
    </div>
  )
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  recue: { label: 'Reçue', tone: 'sky' },
  preparation: { label: 'En préparation', tone: 'amber' },
  expediee: { label: 'Expédiée', tone: 'teal' },
  livraison: { label: 'En livraison', tone: 'gold' },
  livree: { label: 'Livrée', tone: 'sage' },
  annulee: { label: 'Annulée', tone: 'rose' },
}
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: string }> = {
  en_attente: { label: 'Paiement en attente', tone: 'amber' },
  paye: { label: 'Payé', tone: 'sage' },
  rembourse: { label: 'Remboursé', tone: 'neutral' },
}
export const PO_STATUS: Record<POStatus, { label: string; tone: string }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  envoyee: { label: 'Envoyée', tone: 'sky' },
  partielle: { label: 'Partiellement reçue', tone: 'amber' },
  recue: { label: 'Reçue', tone: 'sage' },
}
export const STOCK_STATE: Record<StockState, { label: string; tone: string }> = {
  ok: { label: 'En stock', tone: 'sage' },
  faible: { label: 'Stock faible', tone: 'amber' },
  rupture: { label: 'Rupture', tone: 'rose' },
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: string }>; value: string }) {
  const m = map[value]
  return <Badge tone={m?.tone} dot>{m?.label ?? value}</Badge>
}

/* Toasts: stacked, animated in and out. */
type ToastT = { id: number; text: string; tone: 'ok' | 'error' }
let pushToast: (t: string, tone: ToastT['tone']) => void = () => {}
export const toast = (t: string, tone: ToastT['tone'] = 'ok') => pushToast(t, tone)
export function Toaster() {
  const [items, setItems] = useState<ToastT[]>([])
  useEffect(() => {
    pushToast = (text, tone) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x.slice(-3), { id, text, tone }])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tone === 'error' ? 5000 : 3200)
    }
  }, [])
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[var(--z-toast)] flex flex-col gap-2 items-center pointer-events-none px-4" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.4, ease: EASE }}
            className={cx('pointer-events-auto flex items-center gap-2.5 text-sm px-4 py-2.5 rounded-2xl shadow-float max-w-md border', t.tone === 'error' ? 'bg-rose-ink text-white border-rose-ink' : 'bg-sage-900 text-white border-white/10')}
          >
            {t.tone === 'error' ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 text-sage-300 shrink-0" />} {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4
  const bg = ['bg-sage-100 text-sage-700', 'bg-champagne-100 text-champagne-600', 'bg-teal-100 text-teal-600', 'bg-rose-soft text-rose-ink'][hue]
  return <span className={cx('inline-grid place-items-center size-8 rounded-full text-[11px] font-semibold shrink-0', bg, className)} aria-hidden>{initials}</span>
}

export function Countdown({ to, compact }: { to: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, new Date(to).getTime() - now)
  const parts = [Math.floor(ms / 86400000), Math.floor(ms / 3600000) % 24, Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60]
  const labels = ['j', 'h', 'min', 's']
  if (compact) return <span className="num">{parts.map((p, i) => `${String(p).padStart(2, '0')}${labels[i]}`).join(' ')}</span>
  return (
    <div className="flex gap-2" role="timer">
      {parts.map((p, i) => (
        <div key={i} className="min-w-12 text-center rounded-xl bg-surface/80 border border-line px-2 py-1.5">
          <div className="text-lg font-semibold num leading-none text-ink">{String(p).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{['Jours', 'Heures', 'Min', 'Sec'][i]}</div>
        </div>
      ))}
    </div>
  )
}

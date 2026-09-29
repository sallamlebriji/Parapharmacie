import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Star, X } from 'lucide-react'
import type { OrderStatus, PaymentStatus, POStatus } from '../lib/types'
import type { StockState } from '../lib/logic'

export const cx = (...c: (string | number | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.14em] text-champagne-600 font-medium mb-1">{eyebrow}</div>}
        <h1 className="text-2xl md:text-[28px] text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '', title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h3 className="font-sans text-[15px] font-semibold text-ink">{title}</h3>
          {action}
        </header>
      )}
      <div className={padded ? cx('px-5 pb-5', !title && !action && 'pt-5') : ''}>{children}</div>
    </section>
  )
}

const TONES: Record<string, string> = {
  sage: 'bg-sage-100 text-sage-700',
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
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

export function Stat({ label, value, delta, hint, icon, tone = 'sage', to }: { label: string; value: ReactNode; delta?: number; hint?: string; icon?: ReactNode; tone?: string; to?: string }) {
  const body = (
    <div className="card p-4 h-full transition hover:shadow-lift hover:-translate-y-px">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted font-medium">{label}</span>
        {icon && <span className={cx('size-8 grid place-items-center rounded-lg', TONES[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined && Number.isFinite(delta) && (
          <span className={cx('inline-flex items-center font-medium', delta >= 0 ? 'text-sage-600' : 'text-rose-ink')}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(1).replace('.', ',')} %
          </span>
        )}
        {hint && <span className="text-soft">{hint}</span>}
      </div>
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('inline-flex p-1 rounded-xl bg-cream border border-line gap-1 overflow-x-auto max-w-full scrollbar-thin', className)}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cx('h-8 px-3 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer', value === t.id ? 'bg-white text-ink shadow-soft' : 'text-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className={cx('ml-1.5 tabular-nums', value === t.id ? 'text-sage-600' : 'text-soft')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-lift animate-fade-up max-h-[92vh] flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-lg">{title}</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0" aria-label="Fermer"><X className="size-4" /></button>
        </header>
        <div className="p-6 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <footer className="px-6 py-4 border-t border-line flex justify-end gap-2 bg-ivory rounded-b-2xl">{footer}</footer>}
      </div>
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

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      {icon && <div className="mx-auto size-12 rounded-2xl bg-sage-50 text-sage-500 grid place-items-center mb-3">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {text && <p className="text-sm text-muted mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${value} sur 5`}>
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

export function Progress({ value, tone = 'sage', className }: { value: number; tone?: 'sage' | 'gold' | 'rose' | 'amber'; className?: string }) {
  const c = { sage: 'bg-sage-500', gold: 'bg-champagne-400', rose: 'bg-rose-ink', amber: 'bg-amber-ink' }[tone]
  return (
    <div className={cx('h-1.5 rounded-full bg-cream overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  recue: { label: 'Reçue', tone: 'sky' },
  preparation: { label: 'En préparation', tone: 'amber' },
  expediee: { label: 'Expédiée', tone: 'gold' },
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

/* Minimal toast system */
type ToastT = { id: number; text: string; tone: 'ok' | 'error' }
let pushToast: (t: string, tone: ToastT['tone']) => void = () => {}
export const toast = (t: string, tone: ToastT['tone'] = 'ok') => pushToast(t, tone)
export function Toaster() {
  const [items, setItems] = useState<ToastT[]>([])
  useEffect(() => {
    pushToast = (text, tone) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x, { id, text, tone }])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tone === 'error' ? 5000 : 3200)
    }
  }, [])
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none px-4" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cx('animate-fade-up pointer-events-auto flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl shadow-lift max-w-md', t.tone === 'error' ? 'bg-rose-ink text-white' : 'bg-sage-800 text-white')}>
          {t.tone === 'error' ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 text-sage-200 shrink-0" />} {t.text}
        </div>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative inline-flex h-5 w-9 shrink-0 rounded-full transition cursor-pointer', on ? 'bg-sage-500' : 'bg-sand')}>
      <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4
  const bg = ['bg-sage-100 text-sage-700', 'bg-champagne-100 text-champagne-600', 'bg-sky-soft text-sky-ink', 'bg-rose-soft text-rose-ink'][hue]
  return <span className={cx('inline-grid place-items-center size-8 rounded-full text-[11px] font-semibold shrink-0', bg, className)}>{initials}</span>
}

export function Countdown({ to, compact }: { to: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, new Date(to).getTime() - now)
  const parts = [Math.floor(ms / 86400000), Math.floor(ms / 3600000) % 24, Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60]
  const labels = ['j', 'h', 'min', 's']
  if (compact) return <span className="tabular-nums">{parts.map((p, i) => `${String(p).padStart(2, '0')}${labels[i]}`).join(' ')}</span>
  return (
    <div className="flex gap-2">
      {parts.map((p, i) => (
        <div key={i} className="min-w-12 text-center rounded-xl bg-white/80 border border-white px-2 py-1.5">
          <div className="text-lg font-semibold tabular-nums leading-none text-ink">{String(p).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{['Jours', 'Heures', 'Min', 'Sec'][i]}</div>
        </div>
      ))}
    </div>
  )
}

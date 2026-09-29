import { Check, ClipboardCheck, Home, Package, Truck } from 'lucide-react'
import { dateTime } from '../lib/format'
import type { Order, OrderStatus } from '../lib/types'
import { cx } from './ui'

const STEPS: { s: OrderStatus; label: string; icon: typeof Check }[] = [
  { s: 'recue', label: 'Commande reçue', icon: ClipboardCheck },
  { s: 'preparation', label: 'Préparation', icon: Package },
  { s: 'expediee', label: 'Expédiée', icon: Truck },
  { s: 'livraison', label: 'En livraison', icon: Truck },
  { s: 'livree', label: 'Livrée', icon: Home },
]

export function OrderTimeline({ order }: { order: Order }) {
  const cur = STEPS.findIndex((x) => x.s === order.status)
  if (order.status === 'annulee') return <div className="text-sm text-rose-ink bg-rose-soft rounded-xl px-4 py-3">Cette commande a été annulée.</div>
  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((step, i) => {
        const done = i <= cur
        const h = order.history.find((x) => x.status === step.s)
        return (
          <li key={step.s} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={cx('absolute top-4 right-1/2 w-full h-0.5 -z-0', i <= cur ? 'bg-sage-400' : 'bg-line')} />}
            <span className={cx('relative z-10 size-8 rounded-full grid place-items-center border-2 transition', done ? 'bg-sage-500 border-sage-500 text-white' : 'bg-white border-line text-soft', i === cur && 'ring-4 ring-sage-100')}>
              {done && i < cur ? <Check className="size-4" /> : <step.icon className="size-3.5" />}
            </span>
            <span className={cx('mt-2 text-[11px] sm:text-xs font-medium leading-tight', done ? 'text-ink' : 'text-soft')}>{step.label}</span>
            {h && <span className="text-[10px] text-muted mt-0.5 hidden sm:block">{dateTime(h.date)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Info, RotateCcw, ShoppingBag } from 'lucide-react'
import { actions, useData } from '../../lib/store'
import { money, sum } from '../../lib/format'
import { priceOf, quizRoutine, type QuizAnswers } from '../../lib/logic'
import { ProductVisual } from '../../components/ProductVisual'
import { Progress, cx, toast } from '../../components/ui'

const QUESTIONS: { key: keyof QuizAnswers; title: string; options: { v: string; label: string; hint?: string }[] }[] = [
  { key: 'skin', title: 'Comment décririez-vous votre peau ?', options: [{ v: 'seche', label: 'Sèche', hint: 'Tiraillements, rugosité' }, { v: 'grasse', label: 'Grasse', hint: 'Brillances, pores visibles' }, { v: 'mixte', label: 'Mixte', hint: 'Zone T brillante' }, { v: 'normale', label: 'Normale', hint: 'Équilibrée, confortable' }, { v: 'sensible', label: 'Sensible', hint: 'Rougeurs, réactivité' }] },
  { key: 'concern', title: 'Quelle est votre préoccupation principale ?', options: [{ v: 'hydratation', label: 'Hydratation' }, { v: 'imperfections', label: 'Imperfections' }, { v: 'anti-age', label: 'Rides & fermeté' }, { v: 'eclat', label: 'Teint terne' }, { v: 'sensibilite', label: 'Rougeurs & inconfort' }] },
  { key: 'age', title: 'Quelle est votre tranche d’âge ?', options: [{ v: '<25', label: 'Moins de 25 ans' }, { v: '25-34', label: '25 – 34 ans' }, { v: '35-44', label: '35 – 44 ans' }, { v: '45+', label: '45 ans et plus' }] },
  { key: 'sensitivity', title: 'Votre peau réagit-elle facilement ?', options: [{ v: 'oui', label: 'Oui, souvent', hint: 'Picotements avec certains produits' }, { v: 'parfois', label: 'Parfois' }, { v: 'non', label: 'Rarement' }] },
  { key: 'habit', title: 'Votre routine idéale ?', options: [{ v: 'express', label: 'Express', hint: '2 minutes, l’essentiel' }, { v: 'equilibre', label: 'Équilibrée', hint: 'Matin et soir' }, { v: 'complet', label: 'Complète', hint: 'J’aime prendre le temps' }] },
  { key: 'budget', title: 'Quel budget par produit ?', options: [{ v: 'essentiel', label: 'Moins de 180 DH' }, { v: 'confort', label: '180 – 280 DH' }, { v: 'premium', label: 'Pas de limite' }] },
]

export default function Quiz() {
  const d = useData()
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Partial<QuizAnswers>>({})
  const done = step >= QUESTIONS.length
  const result = done ? quizRoutine(d, a as QuizAnswers) : []
  const total = sum(result, (r) => priceOf(d, r.product).price)
  const q = QUESTIONS[step]

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center">
        <div className="text-[11px] uppercase tracking-[0.16em] text-champagne-600">Quiz beauté</div>
        <h1 className="text-3xl md:text-5xl mt-2">Trouvez votre routine idéale</h1>
      </div>
      {!done ? (
        <div className="card p-6 md:p-10 mt-8 animate-fade-up" key={step}>
          <div className="flex items-center justify-between text-xs text-muted mb-2"><span>Question {step + 1} sur {QUESTIONS.length}</span>{step > 0 && <button className="flex items-center gap-1 hover:text-ink cursor-pointer" onClick={() => setStep(step - 1)}><ArrowLeft className="size-3.5" /> Précédent</button>}</div>
          <Progress value={(step / QUESTIONS.length) * 100} />
          <h2 className="text-2xl md:text-3xl mt-8 text-center">{q.title}</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-8">
            {q.options.map((o) => (
              <button key={o.v} onClick={() => { setA({ ...a, [q.key]: o.v }); setStep(step + 1) }} className={cx('rounded-2xl border p-5 text-left cursor-pointer transition hover:border-sage-400 hover:bg-sage-50 hover:-translate-y-0.5', a[q.key] === o.v ? 'border-sage-500 bg-sage-50' : 'border-line bg-white')}>
                <div className="font-medium">{o.label}</div>
                {o.hint && <div className="text-xs text-muted mt-0.5">{o.hint}</div>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 animate-fade-up">
          <div className="card p-6 md:p-8">
            <h2 className="text-2xl">Votre routine personnalisée</h2>
            <p className="text-sm text-muted mt-1">Sélectionnée selon votre type de peau, votre préoccupation et votre budget.</p>
            <ol className="mt-6 space-y-3">
              {result.map((r, i) => {
                const pi = priceOf(d, r.product)
                return (
                  <li key={r.step + r.product.id} className="flex items-center gap-4 rounded-2xl border border-line p-3">
                    <span className="size-7 rounded-full bg-sage-600 text-white grid place-items-center text-xs shrink-0">{i + 1}</span>
                    <ProductVisual shape={r.product.shape} color={r.product.color} brand={r.product.brand} className="size-16 rounded-xl shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-champagne-600">{r.step}</div>
                      <Link to={`/boutique/produit/${r.product.id}`} className="font-medium hover:text-sage-600">{r.product.name}</Link>
                      <div className="text-xs text-muted">{r.product.brand} · {r.product.volume}</div>
                    </div>
                    <div className="text-right font-semibold tabular-nums">{money(pi.price)}</div>
                  </li>
                )
              })}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-line">
              <div><div className="text-sm text-muted">Total de la routine</div><div className="text-2xl font-semibold">{money(total)}</div></div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => { setStep(0); setA({}) }}><RotateCcw className="size-4" /> Recommencer</button>
                <button className="btn-primary" onClick={() => { result.forEach((r) => actions.addToCart({ kind: 'product', productId: r.product.id, qty: 1 })); toast('Routine ajoutée au panier') }}><ShoppingBag className="size-4" /> Tout ajouter au panier</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mt-6 flex gap-3 rounded-2xl bg-sky-soft/60 border border-sky-soft p-4 text-sm text-sky-ink">
        <Info className="size-5 shrink-0 mt-0.5" />
        <p>Ces recommandations sont <b>commerciales</b> et basées sur vos réponses. Elles <b>ne remplacent pas l’avis d’un professionnel de santé</b>. En cas de problème de peau persistant, d’allergie ou de traitement en cours, consultez votre médecin, dermatologue ou pharmacien.</p>
      </div>
    </div>
  )
}

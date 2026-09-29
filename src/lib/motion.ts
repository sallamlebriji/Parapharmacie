/**
 * Motion tokens — « l'application respire ». Mirrors the CSS tokens in index.css.
 * One signature curve everywhere; durations stay short for work screens and longer for marketing.
 */
import type { Transition, Variants } from 'framer-motion'

export const EASE = [0.22, 1, 0.36, 1] as const
export const GSAP_EASE = 'power3.out'

export const DURATION = { fast: 0.18, base: 0.32, slow: 0.8, counter: 1.6 } as const
export const STAGGER = { page: 0.12, list: 0.04, words: 0.055 } as const

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }
export const smooth: Transition = { duration: DURATION.base, ease: EASE }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE } },
}

export const overlay: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
}

export const dialog: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: EASE } },
  exit: { opacity: 0, y: 8, scale: 0.985, transition: { duration: DURATION.fast } },
}

export const drawer = (side: 'left' | 'right'): Variants => ({
  hidden: { x: side === 'left' ? '-100%' : '100%' },
  show: { x: 0, transition: { duration: 0.5, ease: EASE } },
  exit: { x: side === 'left' ? '-100%' : '100%', transition: { duration: 0.28, ease: EASE } },
})

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Pointer-driven effects (3D tilt) are only for fine pointers with motion allowed. */
export const canHover = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion()

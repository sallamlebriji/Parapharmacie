import { useEffect, type RefObject } from 'react'
import { GSAP_EASE, prefersReducedMotion, STAGGER } from './motion'

/**
 * Marketing-page choreography (GSAP + ScrollTrigger + Lenis), loaded lazily so the back-office
 * never ships these libraries. Lenis is driven by GSAP's ticker: one requestAnimationFrame only.
 *
 * Hooks into data attributes:
 *   [data-split]          headline whose `.word > span` children rise word by word
 *   [data-reveal]         fades up when entering the viewport
 *   [data-reveal-group]   children fade up with a 0.12 s stagger
 *   [data-parallax="-8"]  gentle yPercent drift while scrolling (desktop only)
 *   [data-hero-mock]      product mock settling from a CSS-3D tilt as the page scrolls
 */
export function useLandingMotion(root: RefObject<HTMLElement>) {
  useEffect(() => {
    if (prefersReducedMotion()) return
    let cancelled = false
    let failsafe = 0
    let cleanup = () => {}
    ;(async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')])
      if (cancelled || !root.current) return
      gsap.registerPlugin(ScrollTrigger)

      const lenis = new Lenis({ duration: 1.1, easing: (t: number) => 1 - Math.pow(1 - t, 3) })
      lenis.on('scroll', ScrollTrigger.update)
      // In-page anchors glide through Lenis, offset for the sticky header.
      const onAnchor = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
        const target = a && a.hash.length > 1 ? document.querySelector<HTMLElement>(a.hash) : null
        if (!target) return
        e.preventDefault()
        lenis.scrollTo(target, { offset: -72 })
      }
      root.current.addEventListener('click', onAnchor)
      const tick = (time: number) => lenis.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)

      const ctx = gsap.context(() => {
        const intro = gsap.timeline({ delay: 0.1 })
        intro.from('[data-split] .word > span', { yPercent: 110, rotateX: -55, opacity: 0, transformOrigin: '50% 100%', duration: 1.1, ease: GSAP_EASE, stagger: STAGGER.words })
        intro.from('[data-hero-fade]', { y: 28, opacity: 0, duration: 0.8, ease: GSAP_EASE, stagger: 0.12 }, 0.35)
        // Failsafe: if frames are not being painted (background tab, throttled device), never leave the hero invisible.
        failsafe = window.setTimeout(() => { if (intro.progress() < 1) intro.progress(1) }, 2500)

        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, { y: 28, opacity: 0, duration: 0.8, ease: GSAP_EASE, scrollTrigger: { trigger: el, start: 'top 86%', once: true } })
        })
        gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((g) => {
          gsap.from(g.children, { y: 28, opacity: 0, duration: 0.8, ease: GSAP_EASE, stagger: 0.12, scrollTrigger: { trigger: g, start: 'top 86%', once: true } })
        })

        // Depth effects are reserved for large screens: mobile keeps plain reveals.
        const mm = gsap.matchMedia()
        mm.add('(min-width: 1024px)', () => {
          gsap.fromTo('[data-hero-mock]', { rotateX: 14, y: 30 }, { rotateX: 0, y: 0, ease: 'none', scrollTrigger: { trigger: '[data-hero-mock]', start: 'top 92%', end: 'top 30%', scrub: 0.6 } })
          gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
            gsap.to(el, { yPercent: Number(el.dataset.parallax) || -8, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } })
          })
        })
      }, root.current)

      const el = root.current
      cleanup = () => { ctx.revert(); gsap.ticker.remove(tick); lenis.destroy(); el.removeEventListener('click', onAnchor) }
    })()
    return () => { cancelled = true; clearTimeout(failsafe); cleanup() }
  }, [root])
}

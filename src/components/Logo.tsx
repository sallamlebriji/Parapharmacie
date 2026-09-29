export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#5f7d68" />
      <path d="M16 7c-4 3-6 6.5-6 10a6 6 0 0 0 12 0c0-3.5-2-7-6-10Z" fill="#fbfaf7" />
      <path d="M16 12v11M12.5 17.5h7" stroke="#c9a96e" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ name = 'Paraflow', sub }: { name?: string; sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="font-display text-[19px] text-ink tracking-tight">{name}</span>
        {sub && <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mt-1">{sub}</span>}
      </span>
    </span>
  )
}

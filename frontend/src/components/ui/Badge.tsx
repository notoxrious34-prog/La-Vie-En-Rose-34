import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'rose' | 'gold' | 'neutral';

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      {...props}
      className={clsx(
        'relative inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide',
        variant === 'rose' &&
          'border-[color:color-mix(in_srgb,var(--brand-rose-gold)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-rose-gold)_12%,transparent)] text-[color:color-mix(in_srgb,var(--brand-rose-gold)_88%,var(--pearl-white))] shadow-[0_0_16px_color-mix(in_srgb,var(--brand-rose-gold)_18%,transparent)]',
        variant === 'gold' &&
          'border-[color:color-mix(in_srgb,var(--brand-champagne)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-champagne)_10%,transparent)] text-[color:color-mix(in_srgb,var(--brand-champagne)_88%,var(--pearl-white))] shadow-[0_0_16px_color-mix(in_srgb,var(--brand-champagne)_16%,transparent)]',
        variant === 'neutral' && 
          'border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--fg)_4%,transparent)] text-[color:var(--fg-muted)]',
        className
      )}
    >
      <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fg)_6%,transparent),transparent)] pointer-events-none" />
      <span className="relative z-10">{props.children}</span>
    </span>
  );
}

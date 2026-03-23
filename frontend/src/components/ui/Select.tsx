import type { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full group">
      <div className="relative">
        <select
          {...props}
          className={clsx(
            'w-full appearance-none rounded-[var(--radius-xl)] border px-[var(--space-5)] py-[var(--space-3)] text-sm focus:outline-none cursor-pointer transition-all duration-[var(--duration-normal)] ease-[var(--ease-luxury)]',
            'bg-[color:color-mix(in_srgb,var(--surface-2)_70%,transparent)] text-[color:var(--fg)] border-[color:var(--border-soft)]',
            'focus:border-[color:var(--accent)] focus:bg-[color:color-mix(in_srgb,var(--surface-2)_82%,transparent)] focus:shadow-[var(--focus-ring),var(--shadow-inset)]',
            'group-hover:border-[color:var(--border)] group-hover:bg-[color:color-mix(in_srgb,var(--surface-2)_76%,transparent)]',
            className
          )}
        />
        <div className="absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--fg)_4%,transparent)] group-hover:ring-[color:color-mix(in_srgb,var(--fg)_7%,transparent)] transition-all duration-[var(--duration-normal)] ease-[var(--ease-luxury)]" />
        <div className="pointer-events-none absolute inset-y-0 flex items-center pr-[var(--space-4)]" style={{ insetInlineEnd: 0 }}>
          <svg className="h-4 w-4 text-[color:var(--fg-subtle)] transition-transform duration-[var(--duration-normal)] ease-[var(--ease-luxury)] group-focus-within:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

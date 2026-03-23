import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, id, ...props },
  ref
) {
  const reactId = useId();
  const inputId = id || props.name || reactId;
  
  return (
    <div className="relative w-full group">
      {label && (
        <label
          htmlFor={inputId}
          className="type-caption block text-[color:var(--fg-muted)] mb-[var(--space-2)] ml-[var(--space-1)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          {...props}
          className={clsx(
            'w-full appearance-none rounded-[var(--radius-xl)] border px-[var(--space-5)] py-[var(--space-3)] text-sm focus:outline-none transition-all duration-[var(--duration-normal)] ease-[var(--ease-luxury)]',
            'bg-[color:color-mix(in_srgb,var(--surface-2)_70%,transparent)] text-[color:var(--fg)] border-[color:var(--border-soft)]',
            'placeholder:text-[color:var(--fg-subtle)] placeholder:font-medium placeholder:tracking-wide',
            'focus:border-[color:var(--accent)] focus:bg-[color:color-mix(in_srgb,var(--surface-2)_82%,transparent)] focus:shadow-[var(--focus-ring),var(--shadow-inset)]',
            'group-hover:border-[color:var(--border)] group-hover:bg-[color:color-mix(in_srgb,var(--surface-2)_76%,transparent)]',
            className
          )}
        />
        <div className="absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--fg)_4%,transparent)] group-hover:ring-[color:color-mix(in_srgb,var(--fg)_7%,transparent)] transition-all duration-[var(--duration-normal)] ease-[var(--ease-luxury)]" />
      </div>
    </div>
  );
});

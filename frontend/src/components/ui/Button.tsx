import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import clsx from 'clsx';
import { motion, type TargetAndTransition } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'luxe' | 'outline';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = 'primary', children, disabled, onClick, type }: ButtonProps) {
  const style: CSSProperties | undefined =
    variant === 'primary'
      ? { 
          background: 'var(--gradient-jewel-primary)', 
          boxShadow: 'var(--shadow-glow-primary-lg)',
          border: '1px solid color-mix(in srgb, var(--surface-1) 10%, transparent)'
        }
      : variant === 'luxe'
        ? { 
            background: 'var(--gradient-jewel-primary)', 
            boxShadow: 'var(--shadow-glow-primary-lg)',
            border: '1px solid color-mix(in srgb, var(--surface-1) 15%, transparent)'
          }
        : variant === 'secondary'
          ? { 
              background: 'var(--gradient-jewel-secondary)', 
              boxShadow: 'var(--shadow-glass)',
              border: '1px solid var(--glass-border)'
            }
          : variant === 'outline' || variant === 'ghost'
            ? undefined
            : undefined;

  const hoverMotion: Record<ButtonVariant, TargetAndTransition> = {
    primary: { scale: 1.02, y: -1, boxShadow: 'var(--shadow-glow-primary-lg)' },
    luxe: { scale: 1.02, y: -1, boxShadow: 'var(--shadow-glow-primary-lg)' },
    secondary: { scale: 1.01, y: -1, boxShadow: 'var(--shadow-surface-hover)' },
    ghost: { scale: 1.0, y: 0 },
    outline: { scale: 1.0, y: 0 },
  };

  return (
    <motion.button
      whileHover={disabled ? {} : hoverMotion[variant]}
      whileTap={disabled ? {} : { scale: 0.985 }}
      type={type ?? 'button'}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={clsx(
        'group relative inline-flex items-center justify-center gap-[var(--space-2)] overflow-hidden rounded-[var(--radius-xl)] px-[var(--space-6)] py-[var(--space-3)] text-sm font-semibold tracking-wide transition-all duration-[var(--duration-normal)] ease-[var(--ease-luxury)] disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
        
        variant === 'primary' && 'text-[color:var(--on-accent)]',
        
        variant === 'secondary' && 'text-[color:var(--fg)] backdrop-blur-2xl',
        
        variant === 'ghost' && 'bg-transparent text-[color:var(--fg-muted)] hover:bg-[color:var(--accent-softer)] hover:text-[color:var(--fg)]',
        
        variant === 'luxe' && 'text-[color:var(--on-accent)]',

        variant === 'outline' && 'bg-transparent border-2 border-[color:var(--border-soft)] text-[color:var(--accent-strong)] hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-softer)]',

        className
      )}
    >
      {variant !== 'ghost' && variant !== 'outline' && (
        <>
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--pearl-white)_26%,transparent),transparent_62%)] opacity-70 transition-opacity group-hover:opacity-100" />
          <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,black_10%,transparent))] pointer-events-none" />
        </>
      )}
      <span className="relative z-10 flex items-center gap-[var(--space-2)]">{children}</span>
    </motion.button>
  );
}

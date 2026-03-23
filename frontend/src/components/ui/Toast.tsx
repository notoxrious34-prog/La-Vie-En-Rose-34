import { useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  ttlMs?: number;
};

export function Toast({ item, onClose }: { item: ToastItem; onClose: (id: string) => void }) {
  useEffect(() => {
    const ttl = item.ttlMs ?? 3500;
    const t = window.setTimeout(() => onClose(item.id), ttl);
    return () => window.clearTimeout(t);
  }, [item.id, item.ttlMs, onClose]);

  const kindClass =
    item.kind === 'success' ? 'toast-success' : item.kind === 'error' ? 'toast-error' : 'toast-info';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={clsx(
        'relative overflow-hidden rounded-3xl border p-4 backdrop-blur-xl',
        'ring-1 ring-[color:color-mix(in_srgb,var(--surface-1)_10%,transparent)]',
        'border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] shadow-[var(--shadow-surface)]',
        kindClass
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-80 toast-accent" />

      <div className="relative flex items-start gap-3">
        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--toast-dot)] shadow-sm" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-[color:var(--fg)]">{item.title}</div>
          {item.message ? <div className="mt-1 text-sm text-[color:var(--fg-muted)]">{item.message}</div> : null}

          {item.actionLabel && item.onAction ? (
            <button
              className={clsx(
                'mt-2 inline-flex items-center justify-center rounded-2xl border px-3 py-1.5 text-xs font-semibold',
                'border-[color:var(--border-soft)] bg-[color:var(--surface-2)] text-[color:var(--fg)]',
                'shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-1)_18%,transparent)] transition',
                'hover:shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]'
              )}
              onClick={() => item.onAction?.()}
            >
              {item.actionLabel}
            </button>
          ) : null}
        </div>

        <button
          className={clsx(
            'inline-flex h-8 w-8 items-center justify-center rounded-2xl border text-sm font-bold',
            'border-[color:var(--border-soft)] bg-[color:var(--surface-2)] text-[color:var(--fg-muted)]',
            'shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-1)_18%,transparent)] transition',
            'hover:text-[color:var(--fg)] hover:shadow-[var(--shadow-control)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]'
          )}
          onClick={() => onClose(item.id)}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </motion.div>
  );
}

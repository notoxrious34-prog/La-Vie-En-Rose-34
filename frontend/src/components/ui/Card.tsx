import type { PropsWithChildren } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={clsx(
        'relative overflow-hidden rounded-3xl border backdrop-blur-3xl bg-[color:var(--glass-bg)] border-[color:var(--glass-border)] shadow-[var(--shadow-surface)]',
        'ring-1 ring-[color:color-mix(in_srgb,var(--fg)_4%,transparent)]',
        'transition-all duration-[var(--duration-slow)] ease-[var(--ease-luxury)]',
        'hover:shadow-[var(--shadow-surface-hover)] hover:-translate-y-1',
        'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(1200px_400px_at_20%_-10%,color-mix(in_srgb,var(--accent)_8%,transparent),transparent_65%),radial-gradient(800px_400px_at_90%_100%,color-mix(in_srgb,var(--color-secondary-500)_5%,transparent),transparent_65%)] before:content-[""]',
        className
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fg)_3%,transparent),transparent)] pointer-events-none" />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}

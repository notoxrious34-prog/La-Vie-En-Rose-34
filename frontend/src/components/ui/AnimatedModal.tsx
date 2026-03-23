import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';
import { GOLDEN_EASE, MOTION_BASE, MOTION_FAST } from '../../motion';

export function AnimatedModal({
  open,
  onClose,
  children,
  className,
  panelClassName,
  title,
  description,
  maxWidthClassName,
  disableOutsideClose,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  maxWidthClassName?: string;
  disableOutsideClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (disableOutsideClose) return;
      onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disableOutsideClose, onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION_FAST, ease: GOLDEN_EASE }}
          className={clsx('lux-overlay p-4', className)}
          onClick={() => {
            if (disableOutsideClose) return;
            onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ duration: MOTION_BASE, ease: GOLDEN_EASE }}
            className={clsx('lux-modal-panel w-full', maxWidthClassName ?? 'max-w-xl', panelClassName)}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {(title || description) && (
              <div className="px-6 pt-6">
                {title && <div className="text-lg font-black text-[color:var(--fg)]">{title}</div>}
                {description && <div className="mt-1 text-sm text-[color:var(--fg-subtle)]">{description}</div>}
              </div>
            )}
            <div className={clsx(title || description ? 'p-6' : 'p-6')}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

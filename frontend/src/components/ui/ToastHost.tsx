import { AnimatePresence } from 'framer-motion';
import { Toast, type ToastItem } from './Toast';

export function ToastHost({ items, onClose }: { items: ToastItem[]; onClose: (id: string) => void }) {
  return (
    <div
      className="pointer-events-none fixed top-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] space-y-3"
      style={{ insetInlineEnd: '1rem' }}
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast item={t} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

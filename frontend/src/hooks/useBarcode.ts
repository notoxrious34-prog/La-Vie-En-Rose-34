import { useEffect, useRef } from 'react';

export function useBarcode(onBarcode: (code: string) => void, opts?: { minLength?: number; timeoutMs?: number }) {
  const buffer = useRef('');
  const timer = useRef<number | null>(null);
  const minLength = opts?.minLength ?? 4;
  const timeoutMs = opts?.timeoutMs ?? 40;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }

      if (e.key === 'Enter') {
        const code = buffer.current;
        buffer.current = '';
        if (code.length >= minLength) onBarcode(code);
        return;
      }

      if (e.key.length === 1) {
        buffer.current += e.key;
        timer.current = window.setTimeout(() => {
          const code = buffer.current;
          buffer.current = '';
          if (code.length >= minLength) onBarcode(code);
        }, timeoutMs);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [minLength, onBarcode, timeoutMs]);
}

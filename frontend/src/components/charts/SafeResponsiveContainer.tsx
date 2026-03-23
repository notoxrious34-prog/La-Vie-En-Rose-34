import type { ReactElement } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

type Props = {
  children: (size: { width: number; height: number }) => ReactElement;
  minWidth?: number;
  minHeight?: number;
};

export function SafeResponsiveContainer({
  minWidth = 1,
  minHeight = 1,
  children,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const next = { width: Math.floor(rect.width), height: Math.floor(rect.height) };
      if (next.width >= minWidth && next.height >= minHeight) setSize(next);
    });

    ro.observe(el);

    const rect = el.getBoundingClientRect();
    const initial = { width: Math.floor(rect.width), height: Math.floor(rect.height) };
    if (initial.width >= minWidth && initial.height >= minHeight) setSize(initial);

    return () => ro.disconnect();
  }, [minWidth, minHeight]);

  return (
    <div
      ref={hostRef}
      className="h-full w-full"
      style={{ minWidth, minHeight }}
    >
      {size ? children(size) : null}
    </div>
  );
}

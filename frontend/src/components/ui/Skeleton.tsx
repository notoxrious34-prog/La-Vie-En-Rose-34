import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  radius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
};

export function Skeleton({ className, radius = '2xl', ...props }: SkeletonProps) {
  const radiusClass =
    radius === 'sm'
      ? 'rounded-[var(--radius-sm)]'
      : radius === 'md'
        ? 'rounded-[var(--radius-md)]'
        : radius === 'lg'
          ? 'rounded-[var(--radius-lg)]'
          : radius === 'xl'
            ? 'rounded-[var(--radius-xl)]'
            : radius === '3xl'
              ? 'rounded-[var(--radius-3xl)]'
              : 'rounded-[var(--radius-2xl)]';

  return <div className={clsx('lux-skeleton', radiusClass, className)} {...props} />;
}

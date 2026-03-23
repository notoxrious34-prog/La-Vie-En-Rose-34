import React from 'react';
import { Skeleton } from './Skeleton';

interface SkeletonListProps {
  items?: number;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 5,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={`skeleton-item-${i}`} className="bg-white rounded-lg border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
};

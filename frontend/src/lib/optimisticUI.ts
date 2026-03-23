// Optimistic UI Updates
// Phase 4: Instant UI feedback with safe rollbacks

import { useState, useCallback, useRef } from 'react';

// React hook for optimistic updates
export function useOptimisticUI<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: any, rollbackData?: T) => void;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const originalDataRef = useRef<T | null>(null);

  const optimisticUpdate = useCallback((updatedItem: T) => {
    const currentItem = data;
    originalDataRef.current = currentItem;
    
    // Update UI immediately
    setData(updatedItem);
    setIsLoading(true);
    setError(null);

    // Execute in background
    fetcher()
      .then(result => {
        setData(result);
        setIsLoading(false);
        options.onSuccess?.(result);
      })
      .catch(err => {
        // Rollback to original data
        setData(originalDataRef.current);
        setIsLoading(false);
        setError(err);
        options.onError?.(err, originalDataRef.current || undefined);
      });
  }, [key, fetcher, data, options.onSuccess, options.onError]);

  return {
    data,
    isLoading,
    error,
    optimisticUpdate
  };
}

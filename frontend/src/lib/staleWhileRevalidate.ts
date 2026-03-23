// Stale-While-Revalidate Cache Pattern
// Phase 3: Instant cache with background updates

import { useState, useEffect, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isValid: boolean;
}

class SWRManager {
  private cache = new Map<string, CacheEntry<any>>();
  private revalidatePromises = new Map<string, Promise<any>>();

  // Get data with SWR pattern
  async getSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    revalidateInterval?: number
  ): Promise<{ data: T; isValidating: boolean }> {
    // Return cached data immediately if available
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < (revalidateInterval || 30000)) {
      // Start background revalidation if stale
      if (now - cached.timestamp > 1000) { // Don't revalidate too frequently
        void this.backgroundRevalidate(key, fetcher);
      }

      return {
        data: cached.data,
        isValidating: false
      };
    }

    // No cache or stale, fetch fresh data
    return this.freshFetch(key, fetcher);
  }

  // Background revalidation
  private async backgroundRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<void> {
    // Don't start if already revalidating
    if (this.revalidatePromises.has(key)) {
      return;
    }

    const revalidatePromise = this.freshFetch(key, fetcher)
      .then(() => {
        // Data updated, cache is fresh
        this.revalidatePromises.delete(key);
      })
      .catch(() => {
        // Failed revalidation, keep stale data
        this.revalidatePromises.delete(key);
      });

    this.revalidatePromises.set(key, revalidatePromise);
  }

  // Fresh fetch with cache update
  private async freshFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<{ data: T; isValidating: boolean }> {
    try {
      const data = await fetcher();
      
      // Update cache
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        isValid: true
      });

      return {
        data,
        isValidating: false
      };
    } catch (error) {
      console.error('SWR fetch error:', error);
      
      // Return stale data if available
      const cached = this.cache.get(key);
      if (cached) {
        return {
          data: cached.data,
          isValidating: false
        };
      }

      throw error;
    }
  }

  // Optimistic update
  optimisticUpdate<T>(key: string, newData: T): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.cache.set(key, {
        ...existing,
        data: newData,
        isValid: false // Mark as potentially invalid
      });
    }
  }

  // Confirm optimistic update
  confirmOptimistic<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
    return this.backgroundRevalidate(key, fetcher);
  }

  // Clear cache
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.revalidatePromises.delete(key);
    } else {
      this.cache.clear();
      this.revalidatePromises.clear();
    }
  }
}

// Global SWR manager
export const swrManager = new SWRManager();

// React hook for SWR pattern
export function useSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    revalidateInterval?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      if (!mountedRef.current) return;

      setIsValidating(true);
      setError(null);

      try {
        const result = await swrManager.getSWR(key, fetcher, options.revalidateInterval);
        
        if (!isCancelled && mountedRef.current) {
          setData(result.data);
          setIsValidating(result.isValidating);
          options.onSuccess?.(result.data);
        }
      } catch (err) {
        if (!isCancelled && mountedRef.current) {
          setError(err);
          setIsValidating(false);
          options.onError?.(err);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [key, options.revalidateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    isValidating,
    error,
    mutate: (newData: T) => {
      swrManager.optimisticUpdate(key, newData);
      setData(newData);
    },
    revalidate: () => {
      void swrManager.confirmOptimistic(key, fetcher);
    }
  };
}

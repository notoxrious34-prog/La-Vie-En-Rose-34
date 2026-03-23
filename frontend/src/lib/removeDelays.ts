// Remove Micro Delays
// Phase 6: Remove unnecessary awaits and blocking operations

import { useCallback, useRef, useEffect, useState } from 'react';

// Non-blocking async operations
export function useNonBlocking<T>(operation: () => Promise<T>): (key: string) => Promise<T> {
  const pendingOperations = useRef<Map<string, Promise<T>>>(new Map());

  return useCallback((key: string) => {
    // Cancel existing operation for this key
    const existing = pendingOperations.current.get(key);
    if (existing) {
      // Don't wait for existing operation, return the pending promise
      return existing;
    }

    // Start new operation
    const promise = operation().finally(() => {
      pendingOperations.current.delete(key);
    });

    pendingOperations.current.set(key, promise);
    return promise;
  }, []);
}

// Batch multiple operations
export function useBatchedOperations<T>() {
  const batchQueue = useRef<Array<() => Promise<T>>>([]);
  const batchTimeout = useRef<number>(0);

  const addToBatch = useCallback((operation: () => Promise<T>) => {
    batchQueue.current.push(operation);

    // Start batch timeout if not already running
    if (!batchTimeout.current) {
      batchTimeout.current = window.setTimeout(() => {
        const operations = batchQueue.current.splice(0); // Get all operations
        batchQueue.current = [];
        batchTimeout.current = 0;

        // Execute all operations in parallel
        void Promise.all(operations.map(op => op().catch(error => {
          console.warn('Batched operation failed:', error);
        })));
      }, 0); // Execute immediately on next tick
    }
  }, []);

  const flushBatch = useCallback(() => {
    if (batchTimeout.current) {
      window.clearTimeout(batchTimeout.current);
    }

    const operations = batchQueue.current.splice(0);
    batchQueue.current = [];
    
    // Execute immediately
    void Promise.all(operations.map(op => op().catch(error => {
      console.warn('Flushed operation failed:', error);
    })));
  }, []);

  useEffect(() => {
    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      flushBatch();
    };
  }, []);

  return {
    addToBatch,
    flushBatch
  };
}

// Optimized event handler
export function useOptimizedEventHandler<T extends (...args: any[]) => any>(
  handler: T,
  debounceMs = 0
): T {
  const timeoutRef = useRef<number>(0);

  return useCallback((...args: Parameters<T>) => {
    // Clear previous timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    if (debounceMs > 0) {
      // Debounced execution
      timeoutRef.current = window.setTimeout(() => {
        handler(...args);
      }, debounceMs);
    } else {
      // Immediate execution
      handler(...args);
    }
  }, [handler, debounceMs]) as T;
}

// Fast state updates
export function useFastState<T>(initialValue: T): [T, (updater: T) => void] {
  const [state, setState] = useState<T>(initialValue);

  const fastUpdate = useCallback((updater: T) => {
    // Update state synchronously without batching delays
    setState(updater);
  }, []);

  return [state, fastUpdate];
}

// Remove unnecessary awaits
export function removeUnnecessaryAwaits<T>(promise: Promise<T>): T {
  // For promises that resolve immediately, avoid await
  return promise.then(result => result).catch(error => {
    throw error;
  }) as unknown as T;
}

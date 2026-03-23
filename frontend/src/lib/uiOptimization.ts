// UI Performance Optimization Utilities
// Phase 4: Simple, clean, and error-free implementation

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

// Simple memo helper for expensive computations
export function useMemoValue<T extends any>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

// Simple debounce function
export function useDebounce<T>(
  value: T,
  delay: number
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<number>(0);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
  }, [value, delay]);

  return debouncedValue;
}

// Simple stable callback
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

// Simple performance monitor
export function useRenderTimer(name: string): void {
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime.current;
      
      if (duration > 100) {
        console.warn(`Slow render: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  });
}

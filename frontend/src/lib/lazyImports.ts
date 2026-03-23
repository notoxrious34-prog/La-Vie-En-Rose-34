// Lazy loading utilities for heavy components and pages
// Phase 2: Implement dynamic imports

import { lazy } from 'react';

// Lazy load heavy components with error boundaries
export const LazyAIAssistantPanel = lazy(() => 
  import('../components/AIAssistantPanel').then(m => ({ default: m.AIAssistantPanel }))
);

export const LazyReceiptView = lazy(() => 
  import('../components/pos/ReceiptView').then(m => ({ default: m.ReceiptView }))
);

export const LazyAnimatedModal = lazy(() => 
  import('../components/ui/AnimatedModal').then(m => ({ default: m.AnimatedModal }))
);

// Lazy load charts with proper typing
export const LazyAreaChart = lazy(() => 
  import('recharts').then(m => ({ default: m.AreaChart }))
);

export const LazyRecharts = lazy(() => 
  import('recharts').then(m => ({ 
    default: m as any // Use type assertion for complex recharts export
  }))
);

// Dynamic page imports with loading states
export function createLazyPage<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  return lazy(() => importFn().then(module => ({ default: module.default })));
}

// Preload pages on hover/idle
export function preloadPage(importFn: () => Promise<any>): void {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void importFn();
    });
  } else {
    setTimeout(() => void importFn(), 100);
  }
}

// Intersection observer for lazy loading
export function createIntersectionLoader(
  loader: () => void,
  options: { rootMargin?: string; threshold?: number } = {}
): (element: HTMLElement) => void {
  const { rootMargin = '50px', threshold = 0.1 } = options;
  
  return (element: HTMLElement) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            loader();
            observer.unobserve(element);
          }
        });
      },
      { rootMargin, threshold }
    );
    
    observer.observe(element);
    
    // Return cleanup function
    return () => observer.disconnect();
  };
}

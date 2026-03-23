// Smart Preloading Utilities
// Phase 2: Predictive loading for instant UX

import { useEffect, useRef } from 'react';

// Preload manager for intelligent data fetching
class PreloadManager {
  private preloadedData = new Map<string, any>();
  private preloadingPromises = new Map<string, Promise<any>>();
  private observers = new Map<string, IntersectionObserver>();

  // Preload data with cache
  async preloadData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Return cached data if available
    if (this.preloadedData.has(key)) {
      return this.preloadedData.get(key);
    }

    // Return existing promise if already loading
    if (this.preloadingPromises.has(key)) {
      return this.preloadingPromises.get(key);
    }

    // Start new preload
    const promise = fetcher().then(data => {
      this.preloadedData.set(key, data);
      this.preloadingPromises.delete(key);
      return data;
    }).catch(error => {
      this.preloadingPromises.delete(key);
      throw error;
    });

    this.preloadingPromises.set(key, promise);
    return promise;
  }

  // Preload on hover with delay
  preloadOnHover<T>(key: string, fetcher: () => Promise<T>, delay = 200): void {
    const timeoutRef = setTimeout(() => {
      void this.preloadData(key, fetcher);
    }, delay);

    // Store timeout for cleanup
    this.preloadedData.set(`${key}_timeout`, timeoutRef);
  }

  // Preload on route change
  preloadRoute(route: string, fetchers: Record<string, () => Promise<any>>): void {
    const relevantFetchers = this.getRelevantFetchers(route, fetchers);
    relevantFetchers.forEach(([key, fetcher]) => {
      void this.preloadData(key, fetcher);
    });
  }

  // Get relevant fetchers based on current route
  private getRelevantFetchers(
    currentRoute: string, 
    fetchers: Record<string, () => Promise<any>>
  ): Array<[string, () => Promise<any>]> {
    const relevant: Array<[string, () => Promise<any>]> = [];

    // Dashboard → preload products and sales data
    if (currentRoute === '/dashboard') {
      relevant.push(['products', fetchers.products || (() => Promise.resolve([]))]);
      relevant.push(['sales', fetchers.sales || (() => Promise.resolve([]))]);
    }

    // Products → preload product details and categories
    if (currentRoute === '/products' || currentRoute === '/inventory') {
      relevant.push(['categories', fetchers.categories || (() => Promise.resolve([]))]);
      relevant.push(['suppliers', fetchers.suppliers || (() => Promise.resolve([]))]);
    }

    // Customers → preload customer stats and recent orders
    if (currentRoute === '/customers') {
      relevant.push(['orders', fetchers.orders || (() => Promise.resolve([]))]);
    }

    return relevant;
  }

  // Setup intersection observer for element-based preloading
  setupIntersectionObserver<T>(
    element: HTMLElement,
    key: string,
    fetcher: () => Promise<T>
  ): void {
    if (this.observers.has(key)) {
      this.observers.get(key)?.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            void this.preloadData(key, fetcher);
            observer.unobserve(element);
          }
        });
      },
      { rootMargin: '50px' }
    );

    observer.observe(element);
    this.observers.set(key, observer);
  }

  // Clear preload cache
  clearCache(pattern?: string): void {
    if (pattern) {
      // Clear specific pattern
      for (const key of this.preloadedData.keys()) {
        if (key.includes(pattern)) {
          this.preloadedData.delete(key);
        }
      }
    } else {
      // Clear all
      this.preloadedData.clear();
    }

    // Clear timeouts
    for (const [key, timeout] of this.preloadedData.entries()) {
      if (key.endsWith('_timeout')) {
        clearTimeout(timeout);
        this.preloadedData.delete(key);
      }
    }
  }

  // Get cached data
  getCachedData<T>(key: string): T | null {
    return this.preloadedData.get(key) || null;
  }

  // Check if data is preloaded
  isPreloaded(key: string): boolean {
    return this.preloadedData.has(key);
  }
}

// Global preload manager instance
export const preloadManager = new PreloadManager();

// React hook for smart preloading
export function useSmartPreloading() {
  const currentRoute = useRef<string>('');
  const isHovering = useRef<string>('');

  useEffect(() => {
    // Track current route for predictive preloading
    const handleRouteChange = () => {
      const newRoute = window.location.hash.slice(1) || '/';
      if (newRoute !== currentRoute.current) {
        currentRoute.current = newRoute;
        // Trigger route-based preloading
        preloadManager.preloadRoute(newRoute, {});
      }
    };

    // Listen for route changes
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Initial call

    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  return {
    preloadOnHover: <T>(key: string, fetcher: () => Promise<T>, delay?: number) => {
      preloadManager.preloadOnHover(key, fetcher, delay);
    },
    preloadData: <T>(key: string, fetcher: () => Promise<T>) => {
      return preloadManager.preloadData(key, fetcher);
    },
    getCachedData: <T>(key: string) => {
      return preloadManager.getCachedData<T>(key);
    },
    isPreloaded: (key: string) => {
      return preloadManager.isPreloaded(key);
    },
    setupIntersectionObserver: <T>(element: HTMLElement, key: string, fetcher: () => Promise<T>) => {
      preloadManager.setupIntersectionObserver(element, key, fetcher);
    },
    clearCache: (pattern?: string) => {
      preloadManager.clearCache(pattern);
    }
  };
}

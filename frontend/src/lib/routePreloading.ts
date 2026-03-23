// Route Preloading
// Phase 5: Preload routes before navigation

import { useEffect, useRef } from 'react';

class RoutePreloader {
  private preloadedRoutes = new Set<string>();
  private preloadPromises = new Map<string, Promise<any>>();

  // Preload route data
  async preloadRoute(route: string, fetchers: Record<string, () => Promise<any>>): Promise<void> {
    if (this.preloadedRoutes.has(route)) {
      return;
    }

    if (this.preloadPromises.has(route)) {
      return this.preloadPromises.get(route);
    }

    const relevantFetchers = this.getRelevantFetchers(route, fetchers);
    const preloadPromises = relevantFetchers.map(([key, fetcher]) => {
      const promise = fetcher().catch(error => {
        console.warn(`Preload failed for ${key}:`, error);
      });
      return promise;
    });

    const allPromises = Promise.allSettled(preloadPromises);
    
    this.preloadPromises.set(route, allPromises);
    
    try {
      await allPromises;
      this.preloadedRoutes.add(route);
      this.preloadPromises.delete(route);
    } finally {
      this.preloadPromises.delete(route);
    }
  }

  // Get relevant fetchers for route
  private getRelevantFetchers(
    route: string, 
    fetchers: Record<string, () => Promise<any>>
  ): Array<[string, () => Promise<any>]> {
    const relevant: Array<[string, () => Promise<any>]> = [];

    // Dashboard → preload products and sales
    if (route === '/dashboard') {
      if (fetchers.products) relevant.push(['products', fetchers.products]);
      if (fetchers.sales) relevant.push(['sales', fetchers.sales]);
    }

    // Products/Inventory → preload categories and suppliers
    if (route === '/products' || route === '/inventory') {
      if (fetchers.categories) relevant.push(['categories', fetchers.categories]);
      if (fetchers.suppliers) relevant.push(['suppliers', fetchers.suppliers]);
    }

    // Customers → preload orders
    if (route === '/customers') {
      if (fetchers.orders) relevant.push(['orders', fetchers.orders]);
    }

    return relevant;
  }

  // Preload on hover
  preloadOnHover(route: string, fetchers: Record<string, () => Promise<any>>, delay = 100): void {
    setTimeout(() => {
      void this.preloadRoute(route, fetchers);
    }, delay);
  }

  // Clear preloaded routes
  clearPreloaded(route?: string): void {
    if (route) {
      this.preloadedRoutes.delete(route);
    } else {
      this.preloadedRoutes.clear();
    }
  }
}

// Global route preloader
export const routePreloader = new RoutePreloader();

// React hook for route preloading
export function useRoutePreloading(fetchers: Record<string, () => Promise<any>>) {
  const currentRoute = useRef<string>('');
  const isHovering = useRef<string>('');

  useEffect(() => {
    // Track current route
    const updateRoute = () => {
      const newRoute = window.location.hash.slice(1) || '/';
      if (newRoute !== currentRoute.current) {
        currentRoute.current = newRoute;
        
        // Preload related routes
        void routePreloader.preloadRoute(newRoute, fetchers);
      }
    };

    // Listen for route changes
    window.addEventListener('hashchange', updateRoute);
    updateRoute(); // Initial call

    return () => {
      window.removeEventListener('hashchange', updateRoute);
    };
  }, []);

  return {
    preloadRoute: (route: string) => {
      void routePreloader.preloadRoute(route, fetchers);
    },
    preloadOnHover: (route: string, delay?: number) => {
      routePreloader.preloadOnHover(route, fetchers, delay);
    },
    clearPreloaded: (route?: string) => {
      routePreloader.clearPreloaded(route);
    }
  };
}

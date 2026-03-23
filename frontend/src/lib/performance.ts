/**
 * Performance monitoring and optimization utilities
 * Provides performance metrics, memory management, and optimization helpers
 */

export interface PerformanceMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private isSupported = typeof performance !== 'undefined' && 'measure' in performance;

  private constructor() {
    if (this.isSupported) {
      this.setupObservers();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private setupObservers() {
    try {
      // Observer for long tasks
      if ('PerformanceObserver' in window) {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            console.warn('[Performance] Long task detected:', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      }
    } catch (error) {
      console.warn('[Performance] Could not setup performance observers:', error);
    }
  }

  startTimer(name: string, metadata?: Record<string, any>): PerformanceMetrics {
    const metric: PerformanceMetrics = {
      name,
      startTime: performance.now(),
      metadata,
    };

    if ('memory' in performance && (performance as any).memory) {
      metric.memoryBefore = (performance as any).memory.usedJSHeapSize;
    }

    this.metrics.push(metric);
    return metric;
  }

  endTimer(metric: PerformanceMetrics): PerformanceMetrics {
    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    if ('memory' in performance && (performance as any).memory) {
      metric.memoryAfter = (performance as any).memory.usedJSHeapSize;
      if (typeof metric.memoryBefore === 'number' && typeof metric.memoryAfter === 'number') {
        metric.memoryDelta = metric.memoryAfter - metric.memoryBefore;
      }
    }

    // Log slow operations
    if (metric.duration > 100) {
      console.warn(`[Performance] Slow operation: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
    }

    return metric;
  }

  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const metric = this.startTimer(name, metadata);
    try {
      const result = fn();
      this.endTimer(metric);
      return result;
    } catch (error) {
      this.endTimer(metric);
      throw error;
    }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const metric = this.startTimer(name, metadata);
    try {
      const result = await fn();
      this.endTimer(metric);
      return result;
    } catch (error) {
      this.endTimer(metric);
      throw error;
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.name === name);
  }

  getAverageDuration(name: string): number {
    const nameMetrics = this.getMetricsByName(name);
    const completedMetrics = nameMetrics.filter(m => m.duration !== undefined);
    
    if (completedMetrics.length === 0) return 0;
    
    const total = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    return total / completedMetrics.length;
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  generateReport(): string {
    const report = this.metrics
      .filter(m => m.duration !== undefined)
      .map(m => 
        `${m.name}: ${m.duration?.toFixed(2)}ms` +
        (m.memoryDelta ? ` (${(m.memoryDelta / 1024 / 1024).toFixed(2)}MB)` : '')
      )
      .join('\n');

    return report || 'No performance metrics available';
  }
}

// Memory management utilities
export class MemoryManager {
  private static caches = new Map<string, { data: any; expiry: number; size: number }>();
  private static maxCacheSize = 50 * 1024 * 1024; // 50MB
  private static currentCacheSize = 0;

  static set(key: string, data: any, ttlMs = 5 * 60 * 1000): void {
    const size = this.estimateSize(data);
    
    // Clear expired entries first
    this.clearExpired();
    
    // If adding this would exceed limit, clear oldest entries
    while (this.currentCacheSize + size > this.maxCacheSize && this.caches.size > 0) {
      this.clearOldest();
    }
    
    const expiry = Date.now() + ttlMs;
    this.caches.set(key, { data, expiry, size });
    this.currentCacheSize += size;
  }

  static get<T = any>(key: string): T | null {
    const entry = this.caches.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.delete(key);
      return null;
    }
    
    return entry.data;
  }

  static delete(key: string): boolean {
    const entry = this.caches.get(key);
    if (!entry) return false;
    
    this.currentCacheSize -= entry.size;
    return this.caches.delete(key);
  }

  static clear(): void {
    this.caches.clear();
    this.currentCacheSize = 0;
  }

  static clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.caches.entries()) {
      if (now > entry.expiry) {
        this.currentCacheSize -= entry.size;
        this.caches.delete(key);
      }
    }
  }

  static clearOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.caches.entries()) {
      const entryTime = entry.expiry - (5 * 60 * 1000); // Approximate creation time
      if (entryTime < oldestTime) {
        oldestTime = entryTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private static estimateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // Rough estimate (2 bytes per char)
    } catch {
      return 1024; // Default 1KB if serialization fails
    }
  }

  static getStats(): { size: number; entries: number; maxSize: number } {
    return {
      size: this.currentCacheSize,
      entries: this.caches.size,
      maxSize: this.maxCacheSize,
    };
  }
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

// Memoization utility
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      if (typeof firstKey === 'string') cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

// Lazy loading utility
export function lazyLoad<T>(
  loader: () => Promise<T>,
  cacheKey?: string
): () => Promise<T> {
  let cachedPromise: Promise<T> | null = null;
  
  return async () => {
    if (cachedPromise) return cachedPromise;
    
    cachedPromise = loader();
    
    try {
      const result = await cachedPromise;
      
      // Cache in memory manager if key provided
      if (cacheKey) {
        MemoryManager.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes
      }
      
      return result;
    } catch (error) {
      cachedPromise = null; // Reset on error
      throw error;
    }
  };
}

// Virtual scrolling helper
export class VirtualScroller {
  private itemHeight: number;
  private containerHeight: number;
  private scrollTop = 0;
  private totalCount: number;

  constructor(itemHeight: number, containerHeight: number) {
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
    this.totalCount = 0;
  }

  setTotalCount(count: number): void {
    this.totalCount = count;
  }

  setScrollTop(top: number): void {
    this.scrollTop = top;
  }

  getVisibleRange(): { start: number; end: number; offsetY: number } {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(start + visibleCount + 1, this.totalCount);
    const offsetY = start * this.itemHeight;
    
    return { start, end, offsetY };
  }

  getTotalHeight(): number {
    return this.totalCount * this.itemHeight;
  }
}

// Export singleton and utilities
export const performanceMonitor = PerformanceMonitor.getInstance();
export const measure = performanceMonitor.measure.bind(performanceMonitor);
export const measureAsync = performanceMonitor.measureAsync.bind(performanceMonitor);

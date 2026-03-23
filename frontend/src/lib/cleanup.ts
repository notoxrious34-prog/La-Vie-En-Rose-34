// Cleanup Utilities
// Phase 7: Remove unused code, console logs, fix inefficient loops

// Type declarations for window extensions
declare global {
  interface Window {
    debugLogs?: Array<{ type: string; args: any[]; timestamp: number }>;
    eventListeners?: Array<{ target: any; type: string; listener: EventListener; options?: any }>;
  }
}

// Remove console logs in production
export function setupConsoleCleanup(): void {
  if (import.meta.env.PROD) {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = (...args: any[]) => {
      // Store logs for debugging but don't show in production
      if (window.debugLogs) {
        window.debugLogs.push({ type: 'log', args, timestamp: Date.now() });
      }
    };
    
    console.warn = (...args: any[]) => {
      if (window.debugLogs) {
        window.debugLogs.push({ type: 'warn', args, timestamp: Date.now() });
      }
    };
    
    console.error = (...args: any[]) => {
      if (window.debugLogs) {
        window.debugLogs.push({ type: 'error', args, timestamp: Date.now() });
      }
    };
  }
}

// Optimize array operations
export function optimizedForEach<T>(
  array: T[],
  callback: (item: T, index: number) => void
): void {
  // Use for...of instead of forEach for better performance
  for (let i = 0; i < array.length; i++) {
    callback(array[i], i);
  }
}

// Optimize map operations
export function optimizedMap<T, R>(
  array: T[],
  callback: (item: T, index: number) => R
): R[] {
  const result = new Array(array.length);
  for (let i = 0; i < array.length; i++) {
    result[i] = callback(array[i], i);
  }
  return result;
}

// Optimize filter operations
export function optimizedFilter<T>(
  array: T[],
  callback: (item: T, index: number) => boolean
): T[] {
  const result: T[] = [];
  for (let i = 0; i < array.length; i++) {
    if (callback(array[i], i)) {
      result.push(array[i]);
    }
  }
  return result;
}

// Remove unused event listeners
export function cleanupEventListeners(): void {
  // Store all added event listeners for cleanup
  if (!window.eventListeners) {
    window.eventListeners = [];
  }
  
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  
  EventTarget.prototype.addEventListener = function(
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ) {
    if (window.eventListeners) {
      window.eventListeners.push({ target: this, type, listener, options });
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  EventTarget.prototype.removeEventListener = function(
    type: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions
  ) {
    if (window.eventListeners) {
      window.eventListeners = window.eventListeners.filter(
        item => !(item.target === this && item.type === type && item.listener === listener)
      );
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };
}

// Cleanup function for components
export function createCleanup(): {
  add: (fn: () => void) => void;
  execute: () => void;
} {
  const cleanupFunctions: (() => void)[] = [];
  
  return {
    add: (fn: () => void) => cleanupFunctions.push(fn),
    execute: () => {
      cleanupFunctions.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      });
      cleanupFunctions.length = 0;
    }
  };
}

// Startup optimization utilities
// Phase 1: Load only essential UI first, defer heavy data fetching

export interface DeferredLoadOptions {
  delay?: number;
  priority?: 'high' | 'low';
}

// Generic deferred loader for non-critical data
export function createDeferredLoader<T>(
  loader: () => Promise<T>,
  options: DeferredLoadOptions = {}
): () => Promise<T> {
  const { delay = 0, priority = 'low' } = options;
  
  return () => {
    return new Promise<T>((resolve) => {
      const loadFn = async () => {
        try {
          const result = await loader();
          resolve(result);
        } catch (error) {
          console.error('Deferred load error:', error);
          resolve(error as T);
        }
      };

      if (priority === 'high') {
        // High priority loads after minimal delay
        setTimeout(loadFn, Math.max(delay, 50));
      } else {
        // Low priority loads after main render is complete
        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => setTimeout(loadFn, delay));
        } else {
          setTimeout(loadFn, Math.max(delay, 200));
        }
      }
    });
  };
}

// Preload critical resources
export function preloadCriticalResources(): void {
  // Preload fonts
  if ('fonts' in document) {
    const fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.as = 'font';
    fontLink.href = '/fonts/inter-var.woff2';
    document.head.appendChild(fontLink);
  }
}

// Initialize essential UI state immediately
export function initializeEssentialState(): void {
  // Set initial theme immediately
  try {
    const savedTheme = window.localStorage.getItem('lver34.theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch {
    // ignore
  }

  // Set initial language immediately
  try {
    const savedLang = window.localStorage.getItem('lver34.lang');
    if (savedLang && ['fr', 'ar', 'en'].includes(savedLang)) {
      document.documentElement.setAttribute('dir', savedLang === 'ar' ? 'rtl' : 'ltr');
    }
  } catch {
    // ignore
  }
}

// Firebase-specific deferred loading
export function createDeferredFirebaseLoader<T>(
  firebaseLoader: () => Promise<T>,
  fallbackValue: T
): () => Promise<T> {
  return () => {
    return new Promise<T>((resolve) => {
      // Try Firebase with timeout
      const timeout = setTimeout(() => {
        console.warn('Firebase load timeout, using fallback');
        resolve(fallbackValue);
      }, 3000); // 3 second timeout

      firebaseLoader()
        .then(resolve)
        .catch((error) => {
          console.warn('Firebase load failed, using fallback:', error);
          resolve(fallbackValue);
        })
        .finally(() => clearTimeout(timeout));
    });
  };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from './i18n'
import './index.css'
import App from './App'
import { initializeEssentialState } from './lib/startupOptimization'
import { preloadEssentialFirebaseData } from './lib/firebaseOptimization'
import { setupConsoleCleanup, cleanupEventListeners } from './lib/cleanup'

// Initialize essential state immediately
initializeEssentialState()

// Setup optimizations
setupConsoleCleanup()
cleanupEventListeners()

// Preload essential data in background
preloadEssentialFirebaseData()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // In a local Electron app the backend is always on localhost —
      // aggressive refetching only wastes CPU and makes the UI feel sluggish.
      staleTime: 30_000,          // data stays fresh for 30 s — no redundant re-fetches on mount
      gcTime: 5 * 60_000,         // keep unused cache 5 min so back-navigation is instant
      refetchOnWindowFocus: false, // Electron windows losing/gaining focus must NOT trigger mass re-fetch
      refetchOnReconnect: true,    // do re-sync if network comes back (covers backend restart)
      retry: 1,                    // one retry on failure is enough for a local server
    },
  },
})

try {
  const savedTheme = window.localStorage.getItem('lver34.theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
} catch {
  // ignore
}

try {
  // Restore saved language preference
  const savedLang = window.localStorage.getItem('lver34.lang');
  if (savedLang && ['fr', 'ar', 'en'].includes(savedLang)) {
    void i18n.changeLanguage(savedLang);
  }

  const applyDir = (lng: string) => {
    const isArabic = lng === 'ar';
    document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lng);
    document.documentElement.classList.toggle('rtl', isArabic);
    // Persist language preference
    try { window.localStorage.setItem('lver34.lang', lng); } catch { /* ignore */ }
  };
  applyDir(i18n.language || 'fr');
  i18n.on('languageChanged', applyDir);
} catch {
  // ignore
}

try {
  const formatArgs = (args: unknown[]) =>
    args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');

  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]) => {
    origError(...(args as any));
    try {
      console.log(`__console_error__ ${formatArgs(args)}`);
    } catch {
      // ignore
    }
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...(args as any));
    try {
      console.log(`__console_warn__ ${formatArgs(args)}`);
    } catch {
      // ignore
    }
  };

  window.addEventListener('error', (e) => {
    try {
      const err = (e as any)?.error;
      if (err instanceof Error) console.log(`__window_error__ ${err.name}: ${err.message}\n${err.stack || ''}`);
      else console.log(`__window_error__ ${String((e as any)?.message || '')}`);
    } catch {
      // ignore
    }
  });

  window.addEventListener('unhandledrejection', (e) => {
    try {
      const r = (e as any)?.reason;
      if (r instanceof Error) console.log(`__unhandled_rejection__ ${r.name}: ${r.message}\n${r.stack || ''}`);
      else console.log(`__unhandled_rejection__ ${String(r)}`);
    } catch {
      // ignore
    }
  });
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

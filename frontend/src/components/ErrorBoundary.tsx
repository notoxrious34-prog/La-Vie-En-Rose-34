import { Component, type ReactNode, type ErrorInfo } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type State = {
  hasError: boolean;
  message?: string;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
};

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeouts: number[] = [];

  state: State = { 
    hasError: false, 
    retryCount: 0 
  };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { 
      hasError: true, 
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error))
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', { error, errorInfo });
    
    // Store error info for debugging
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerErr) {
        console.error('Error in custom error handler:', handlerErr);
      }
    }

    // Log to external service in production
    if (import.meta.env.PROD) {
      // Could integrate with Sentry, LogRocket, etc.
      console.warn('Production error detected:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
  }

  componentWillUnmount() {
    // Clean up any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
  }

  private handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount >= this.maxRetries) {
      console.warn('Max retries reached for ErrorBoundary');
      return;
    }

    // Exponential backoff for retries
    const delay = Math.pow(2, retryCount) * 1000;
    
    const timeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        message: undefined,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }, delay);
    
    this.retryTimeouts.push(timeout);
  };

  private handleReload = () => {
    // Clear any pending timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
    
    // Hard reload
    window.location.reload();
  };

  private handleReset = () => {
    // Clear any pending timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
    
    // Reset error state
    this.setState({ 
      hasError: false, 
      message: undefined, 
      error: undefined, 
      errorInfo: undefined,
      retryCount: 0 
    });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const canRetry = this.state.retryCount < this.maxRetries;
    const retryDelay = Math.pow(2, this.state.retryCount) * 1000;

    return (
      <div className="flex min-h-screen w-full items-center justify-center p-6" style={{ background: 'var(--app-bg)' }}>
        <div
          className="w-full max-w-xl rounded-3xl border p-6 shadow-glass backdrop-blur-xl"
          style={{ borderColor: 'var(--glass-border)', background: 'color-mix(in srgb, var(--glass-bg) 55%, transparent)' }}
        >
          <div className="text-sm font-semibold" style={{ color: 'var(--accent-strong)' }}>La Vie En Rose 34</div>
          <div className="mt-2 text-2xl font-extrabold" style={{ color: 'var(--fg)' }}>Une erreur est survenue</div>
          <div className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>L'application peut se récupérer. Essayez de recharger.</div>
          
          {this.state.message ? (
            <div
              className="mt-4 rounded-2xl border p-3 text-xs"
              style={{
                borderColor: 'var(--border-soft)',
                background: 'color-mix(in srgb, var(--surface-2) 55%, transparent)',
                color: 'var(--fg-muted)',
              }}
            >
              {this.state.message}
            </div>
          ) : null}

          {/* Retry indicator */}
          {this.state.retryCount > 0 && (
            <div className="mt-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
              Tentative de récupération {this.state.retryCount}/{this.maxRetries}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {/* Retry button */}
            {canRetry ? (
              <button
                className="rounded-2xl bg-[color:color-mix(in_srgb,var(--accent)_82%,transparent)] px-4 py-2 text-sm font-bold text-[color:var(--fg)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--accent)_55%,transparent)] transition hover:bg-[color:color-mix(in_srgb,var(--accent)_92%,transparent)]"
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= this.maxRetries}
              >
                Réessayer {this.state.retryCount > 0 && `(${retryDelay / 1000}s)`}
              </button>
            ) : null}
            
            {/* Reload button */}
            <button
              className="rounded-2xl bg-[color:color-mix(in_srgb,var(--surface-1)_82%,transparent)] px-4 py-2 text-sm font-bold text-[color:var(--fg)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-1)_55%,transparent)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-1)_92%,transparent)]"
              onClick={this.handleReload}
            >
              Recharger
            </button>
            
            {/* Continue button */}
            <button
              className="rounded-2xl border bg-[color:color-mix(in_srgb,var(--surface-2)_55%,transparent)] px-4 py-2 text-sm font-semibold text-[color:var(--fg)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-2)_72%,transparent)]"
              style={{ borderColor: 'var(--border-soft)' }}
              onClick={this.handleReset}
            >
              Continuer
            </button>
          </div>

          {/* Development details */}
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs" style={{ color: 'var(--fg-muted)' }}>
                Détails techniques (développement)
              </summary>
              <div className="mt-2 max-h-32 overflow-auto rounded-xl border p-2 text-xs font-mono" 
                   style={{ 
                     borderColor: 'var(--border-soft)', 
                     background: 'color-mix(in srgb, var(--surface-1) 30%, transparent)',
                     color: 'var(--fg-muted)'
                   }}>
                <div>Message: {this.state.error.message}</div>
                {this.state.error.stack && (
                  <div className="mt-1">Stack: {this.state.error.stack}</div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-1">Component Stack: {this.state.errorInfo.componentStack}</div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }
}

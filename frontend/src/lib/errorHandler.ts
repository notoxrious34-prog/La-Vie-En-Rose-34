/**
 * Centralized error handling and logging system
 * Provides consistent error reporting, user feedback, and debugging capabilities
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
  severity?: ErrorReport['severity'];
  additionalData?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userAgent?: string;
  url?: string;
  timestamp: number;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorReports: ErrorReport[] = [];
  private maxReports = 100; // Keep last 100 errors in memory
  private isDevelopment = import.meta.env.DEV;

  private constructor() {
    // Setup global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityFromError(error: Error): ErrorReport['severity'] {
    // Determine severity based on error content
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'medium';
    }
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return 'high';
    }
    if (error.message.includes('Security') || error.message.includes('Permission')) {
      return 'critical';
    }
    return 'low';
  }

  private handleGlobalError(event: ErrorEvent) {
    this.reportError(event.error || new Error(event.message), {
      component: 'Global',
      action: 'UnhandledError',
      additionalData: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    this.reportError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      {
        component: 'Global',
        action: 'UnhandledPromiseRejection',
      }
    );
  }

  reportError(error: Error | string, context: ErrorContext = {}): ErrorReport {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const errorId = this.generateErrorId();
    
    const report: ErrorReport = {
      id: errorId,
      message: errorObj.message,
      stack: errorObj.stack,
      context: {
        timestamp: Date.now(),
        ...context,
      },
      severity: context.severity || this.getSeverityFromError(errorObj),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: Date.now(),
    };

    // Store in memory
    this.errorReports.push(report);
    if (this.errorReports.length > this.maxReports) {
      this.errorReports.shift();
    }

    // Log to console
    this.logError(report);

    // In production, could send to external service
    if (import.meta.env.PROD && report.severity !== 'low') {
      this.sendToExternalService(report);
    }

    return report;
  }

  private logError(report: ErrorReport) {
    const logMethod = report.severity === 'critical' ? 'error' : 
                     report.severity === 'high' ? 'warn' : 'info';
    
    console[logMethod](`[ErrorHandler] ${report.severity.toUpperCase()}: ${report.message}`, {
      id: report.id,
      context: report.context,
      stack: report.stack,
    });
  }

  private async sendToExternalService(report: ErrorReport) {
    // Placeholder for external error reporting service
    // Could integrate with Sentry, LogRocket, etc.
    if (this.isDevelopment) {
      console.debug('[ErrorHandler] Would send to external service:', report);
    }
  }

  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  getErrorById(id: string): ErrorReport | undefined {
    return this.errorReports.find(report => report.id === id);
  }

  clearErrors(): void {
    this.errorReports = [];
  }

  // User-friendly error messages
  getUserFriendlyMessage(error: Error | string): string {
    const message = typeof error === 'string' ? error : error.message;
    
    // Common error patterns and user-friendly messages
    if (message.includes('Network') || message.includes('fetch')) {
      return 'Problème de connexion. Vérifiez votre internet et réessayez.';
    }
    if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
      return 'Mise à jour en cours. Veuillez recharger la page.';
    }
    if (message.includes('Security') || message.includes('Permission')) {
      return 'Permission refusée. Veuillez vous reconnecter.';
    }
    if (message.includes('timeout')) {
      return 'Opération trop longue. Veuillez réessayer.';
    }
    
    return 'Une erreur est survenue. Veuillez réessayer.';
  }

  // Retry mechanism with exponential backoff
  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      context?: ErrorContext;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, context } = options;
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          this.reportError(lastError, {
            ...context,
            action: `${context?.action || 'Operation'}_Failed`,
            additionalData: {
              ...context?.additionalData,
              attempts: attempt + 1,
            },
          });
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        
        console.warn(`[ErrorHandler] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, lastError.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export convenience functions
export const reportError = (error: Error | string, context?: ErrorContext) => 
  errorHandler.reportError(error, context);

export const getUserFriendlyMessage = (error: Error | string) => 
  errorHandler.getUserFriendlyMessage(error);

export const withRetry = <T>(
  operation: () => Promise<T>,
  options?: Parameters<typeof errorHandler.withRetry>[1]
) => errorHandler.withRetry(operation, options);

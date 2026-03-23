import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

type MaybeAxiosError = {
  response?: {
    status?: number;
    data?: any;
  };
  request?: any;
  message?: string;
};

// Enhanced error handling for better debugging
function isAxiosError(error: any): error is AxiosError {
  return error && error.isAxiosError === true;
}

function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response) {
      // Server responded with error status
      return `Server error ${error.response.status}: ${(error.response.data as any)?.error || (error.response.data as any)?.message || 'Unknown error'}`;
    } else if (error.request) {
      // Request was made but no response received
      return 'Network error: No response from server. Check your connection.';
    } else {
      // Something else happened
      return `Request error: ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    (typeof window !== 'undefined'
      ? window.location.protocol === 'file:'
        ? 'http://localhost:8787'
        : (import.meta as any).env?.DEV &&
            window.location.hostname === 'localhost' &&
            /^517\d$/.test(window.location.port)
          ? 'http://localhost:8787'
          : ''
      : ''),
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor with error handling
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('lver_token');
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add request timestamp for debugging
      config.metadata = { startTime: Date.now() };
      
      return config;
    } catch (err) {
      console.warn('Request interceptor error:', err);
      return config;
    }
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with enhanced error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response time in development
    if (import.meta.env.DEV && response.config.metadata?.startTime) {
      const duration = Date.now() - response.config.metadata.startTime;
      console.debug(`API call to ${response.config.url} took ${duration}ms`);
    }
    
    return response;
  },
  (error: unknown) => {
    const status = (error as MaybeAxiosError)?.response?.status;
    const errorMessage = getErrorMessage(error);
    
    // Enhanced logging for debugging
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        status,
        message: errorMessage,
        url: (error as any)?.config?.url,
        method: (error as any)?.config?.method?.toUpperCase(),
      });
    }
    
    // Handle authentication errors
    if (status === 401) {
      // Clear auth state
      localStorage.removeItem('lver_token');
      localStorage.removeItem('lver_user');
      
      // Redirect to login, but avoid infinite loops
      const currentHash = window.location.hash || '';
      if (currentHash !== '#/login' && currentHash !== '#/') {
        window.location.assign('#/login');
      }
    }
    
    // Handle network errors with retry logic for critical requests
    if (status === 0 || status === 503) {
      const config = (error as any)?.config;
      
      // Retry GET requests up to 3 times
      if (config?.method?.toLowerCase() === 'get' && (config.__retryCount || 0) < 3) {
        config.__retryCount = (config.__retryCount || 0) + 1;
        
        console.warn(`Retrying request to ${config.url} (attempt ${config.__retryCount})`);
        
        // Exponential backoff
        const delay = Math.pow(2, config.__retryCount) * 1000;
        return new Promise((resolve) => {
          setTimeout(() => resolve(api(config)), delay);
        });
      }
    }
    
    // Return enhanced error
    return Promise.reject({
      userMessage: errorMessage,
      status,
      isNetworkError: status === 0,
      isServerError: status && status >= 500,
      isClientError: status && status >= 400 && status < 500,
      originalError: error,
    });
  }
);

// Type declaration for metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
    __retryCount?: number;
  }
}

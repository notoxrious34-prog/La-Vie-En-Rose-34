import { create } from 'zustand';
import { api } from '../lib/api';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { isFirebaseConfigured } from '../lib/firebaseClient';

export type AuthUser = {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'employee';
  permissions?: string[];
  email?: string;
  displayName?: string;
  active?: boolean;
};

function getStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem('lver_user');
    if (!stored || stored === 'undefined' || stored === 'null') return null;
    const parsed = JSON.parse(stored);
    // Validate the stored user has required fields
    if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.username) {
      localStorage.removeItem('lver_user');
      return null;
    }
    return parsed as AuthUser;
  } catch (err) {
    console.warn('Failed to parse stored user:', err);
    localStorage.removeItem('lver_user');
    return null;
  }
}

function getStoredToken(): string | null {
  try {
    const token = localStorage.getItem('lver_token');
    if (!token || token === 'undefined' || token === 'null') return null;
    // Basic JWT format validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT format in stored token');
      localStorage.removeItem('lver_token');
      return null;
    }
    return token;
  } catch (err) {
    console.warn('Failed to get stored token:', err);
    localStorage.removeItem('lver_token');
    return null;
  }
}

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isLoading: false,
  error: null,
  
  login: async (email, password) => {
    const identifier = String(email ?? '').trim();
    if (!identifier) {
      set({ error: 'Veuillez entrer un identifiant' });
      throw new Error('missing_identifier');
    }

    if (!password) {
      set({ error: 'Veuillez entrer un mot de passe' });
      throw new Error('missing_password');
    }

    set({ isLoading: true, error: null });

    try {
      // Use Firebase only if configured AND identifier looks like an email
      const looksLikeEmail = identifier.includes('@');
      const firebaseEnabled = isFirebaseConfigured() && looksLikeEmail;

      let token: string;

      if (firebaseEnabled) {
        try {
          const { getFirebaseAuth } = await import('../lib/firebaseClient');
          const auth = await getFirebaseAuth();
          if (!auth) throw new Error('firebase_unavailable');
          const cred = await signInWithEmailAndPassword(auth, identifier, password);
          token = await cred.user.getIdToken();
        } catch (e: any) {
          // Rethrow Firebase auth errors with proper codes
          console.warn('Firebase auth error:', e);
          throw e;
        }
      } else {
        try {
          const res = await api.post('/api/auth/login', {
            username: identifier,
            password,
          });
          token = String((res.data as any)?.token ?? '');
          if (!token) throw new Error('missing_token');
        } catch (e: any) {
          // Handle API errors with better messages
          const userMessage = e.userMessage || 'Connexion échouée';
          set({ error: userMessage });
          throw e;
        }
      }

      // Validate token format before storing
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('invalid_token_format');
      }

      // Store token
      localStorage.setItem('lver_token', token);
      set({ token });

      // Pull authoritative role/permissions from backend
      try {
        const me = await api.get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = me.data as AuthUser;
        
        // Validate user data
        if (!user || !user.id || !user.username) {
          throw new Error('invalid_user_data');
        }
        
        localStorage.setItem('lver_user', JSON.stringify(user));
        set({ user, error: null });
      } catch (userErr) {
        // If we can't get user data, clean up auth state
        console.warn('Failed to fetch user data:', userErr);
        localStorage.removeItem('lver_token');
        localStorage.removeItem('lver_user');
        set({ token: null, user: null, error: 'Impossible de récupérer les informations utilisateur' });
        throw userErr;
      }
    } catch (err) {
      console.error('Login failed:', err);
      // Set error state if not already set
      if (!get().error) {
        const userMessage = (err as any)?.userMessage || 'Connexion échouée';
        set({ error: userMessage });
      }
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  
  logout: () => {
    // Clear local storage
    localStorage.removeItem('lver_token');
    localStorage.removeItem('lver_user');
    
    // Clear Firebase auth if configured
    void (async () => {
      try {
        if (!isFirebaseConfigured()) return;
        const { getFirebaseAuth } = await import('../lib/firebaseClient');
        const auth = await getFirebaseAuth();
        if (auth) await signOut(auth);
      } catch (err) {
        console.warn('Firebase signout error:', err);
        // Don't throw - local logout should still succeed
      }
    })();
    
    // Clear state
    set({ token: null, user: null, error: null, isLoading: false });
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  refreshUser: async () => {
    const { token } = get();
    if (!token) {
      throw new Error('No token available for refresh');
    }
    
    try {
      const me = await api.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const user = me.data as AuthUser;
      if (!user || !user.id || !user.username) {
        throw new Error('invalid_user_data');
      }
      
      localStorage.setItem('lver_user', JSON.stringify(user));
      set({ user });
    } catch (err) {
      console.error('Failed to refresh user:', err);
      // If refresh fails, clear auth state
      get().logout();
      throw err;
    }
  },
}));

// Initialize auth state validation
if (typeof window !== 'undefined') {
  // Validate stored auth on app start
  const token = getStoredToken();
  const user = getStoredUser();
  
  if (token && user) {
    console.log('Restored auth state for user:', user.username);
  } else if (token || user) {
    // Inconsistent state - clean up
    console.warn('Inconsistent auth state detected, cleaning up');
    localStorage.removeItem('lver_token');
    localStorage.removeItem('lver_user');
  }
}

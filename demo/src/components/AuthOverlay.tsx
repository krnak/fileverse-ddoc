import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

const GATE_BASE_URL = import.meta.env.VITE_GATE_BASE_URL || 'https://liqk.local.dev';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
}

/**
 * Extracts accessToken from URL and removes it from the browser's address bar
 */
function extractAndStripAccessToken(): string | null {
  const url = new URL(window.location.href);
  const accessToken = url.searchParams.get('accessToken');

  if (accessToken) {
    // Remove the accessToken from URL
    url.searchParams.delete('accessToken');
    // Replace current URL without the token (doesn't trigger navigation)
    window.history.replaceState({}, '', url.toString());
  }

  return accessToken;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkAuth = async (): Promise<boolean> => {
    try {
      // Try to access a protected endpoint to check auth status
      const response = await fetch(`${GATE_BASE_URL}/query?query=ASK{?s ?p ?o}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok || response.status === 200) {
        setIsAuthenticated(true);
        setShowOverlay(false);
        return true;
      } else if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        setShowOverlay(true);
        return false;
      }
      // For other errors, assume not authenticated
      setIsAuthenticated(false);
      setShowOverlay(true);
      return false;
    } catch (e) {
      console.error('Auth check failed:', e);
      setIsAuthenticated(false);
      setShowOverlay(true);
      return false;
    }
  };

  const loginWithToken = async (accessToken: string): Promise<boolean> => {
    try {
      const formData = new URLSearchParams();
      formData.append('token', accessToken);

      const response = await fetch(`${GATE_BASE_URL}/gate/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok || response.redirected) {
        setIsAuthenticated(true);
        setShowOverlay(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Token login failed:', e);
      return false;
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);

      // Check for accessToken in URL and strip it
      const urlToken = extractAndStripAccessToken();

      if (urlToken) {
        // Try to login with the URL token
        const success = await loginWithToken(urlToken);
        if (success) {
          setIsLoading(false);
          return;
        }
        // If URL token login failed, fall through to normal auth check
      }

      await checkAuth();
      setIsLoading(false);
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new URLSearchParams();
      formData.append('token', token);

      const response = await fetch(`${GATE_BASE_URL}/gate/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok || response.redirected) {
        // Login successful - cookie should be set
        setIsAuthenticated(true);
        setShowOverlay(false);
        setToken('');
      } else {
        setError('Invalid token. Please try again.');
      }
    } catch (e) {
      console.error('Login failed:', e);
      setError('Connection failed. Is the gate server running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, checkAuth }}>
      {showOverlay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#16213e] p-8 rounded-xl shadow-2xl max-w-md w-[90%] text-center">
            <h1 className="text-2xl font-bold text-[#e94560] mb-2">
              Authentication Required
            </h1>
            <p className="text-gray-400 mb-6">
              Enter your access token to continue
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Access Token"
                autoComplete="off"
                required
                className="w-full p-3 text-center font-mono text-base border-2 border-[#0f3460] rounded-md bg-[#1a1a2e] text-white mb-4 focus:outline-none focus:border-[#e94560]"
              />

              {error && (
                <p className="text-[#ff6b6b] mb-4 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full p-3 text-base font-semibold bg-[#e94560] text-white border-none rounded-md cursor-pointer transition-colors hover:bg-[#ff6b6b] disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Authenticating...' : 'Authenticate'}
              </button>
            </form>

            <p className="text-gray-500 text-xs mt-4">
              Token is displayed in gate server console on startup
            </p>
          </div>
        </div>
      )}
      {isAuthenticated && children}
    </AuthContext.Provider>
  );
}

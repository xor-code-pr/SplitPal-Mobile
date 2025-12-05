import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {api, setAuthToken} from '@api/client';
import {
  clearAuthPayload,
  loadAuthPayload,
  saveAuthPayload,
  StoredAuthPayload
} from '@storage/authStorage';

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  email: string | null;
  userId: number | null;
  userName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
};

const mapUser = (user: any | null | undefined): StoredAuthPayload['user'] => ({
  id: user?.id ?? null,
  name: user?.name ?? null,
  email: user?.email ?? null,
  is_admin: Boolean(user?.is_admin)
});

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const refreshTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const applySessionState = useCallback((payload: StoredAuthPayload) => {
    setAuthToken(payload.token);
    setToken(payload.token);
    setRefreshToken(payload.refreshToken);
    refreshTokenRef.current = payload.refreshToken;

    const mappedUser = mapUser(payload.user);
    setEmail(mappedUser.email);
    setUserId(mappedUser.id);
    setUserName(mappedUser.name);
    setIsAdmin(Boolean(mappedUser.is_admin));
  }, []);

  const persistSession = useCallback(async (payload: StoredAuthPayload) => {
    applySessionState(payload);
    try {
      await saveAuthPayload(payload);
    } catch {
      // Ignore persistence save failures so the in-memory session stays active
    }
  }, [applySessionState]);

  const clearSession = useCallback(async () => {
    refreshTokenRef.current = null;
    refreshPromiseRef.current = null;
    setAuthToken(undefined);
    setToken(null);
    setRefreshToken(null);
    setEmail(null);
    setUserId(null);
    setUserName(null);
    setIsAdmin(false);
    try {
      await clearAuthPayload();
    } catch {
      // Ignore persistence clear failures
    }
  }, []);

  const refreshSession = useCallback(async (overrideRefreshToken?: string): Promise<string | null> => {
    const activeRefreshToken = overrideRefreshToken ?? refreshTokenRef.current;
    if (!activeRefreshToken) {
      return null;
    }

    refreshTokenRef.current = activeRefreshToken;

    try {
      const response = await api.post('/auth/refresh', {refresh_token: activeRefreshToken});
      const {token: nextAccessToken, refresh_token: nextRefreshToken, user} = response.data ?? {};
      if (!nextAccessToken) {
        throw new Error('Missing access token');
      }

      const payload: StoredAuthPayload = {
        token: nextAccessToken,
        refreshToken: nextRefreshToken ?? activeRefreshToken,
        user: mapUser(user)
      };
      await persistSession(payload);
      return nextAccessToken;
    } catch (error) {
      await clearSession();
      throw error;
    }
  }, [persistSession, clearSession]);

  const getRefreshedToken = useCallback(async () => {
    if (!refreshTokenRef.current) {
      return null;
    }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = refreshSession().finally(() => {
        refreshPromiseRef.current = null;
      });
    }

    return refreshPromiseRef.current;
  }, [refreshSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = await loadAuthPayload();
        if (stored?.refreshToken) {
          refreshTokenRef.current = stored.refreshToken;
          setRefreshToken(stored.refreshToken);
          try {
            await refreshSession(stored.refreshToken);
          } catch {
            // already cleared in refreshSession
          }
        } else if (stored?.token) {
          applySessionState(stored);
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [applySessionState, refreshSession]);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      response => response,
      async error => {
        const status = error?.response?.status;
        const originalRequest = error?.config;

        const isRefreshCall = typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/refresh');
        if (!originalRequest || isRefreshCall || status !== 401) {
          return Promise.reject(error);
        }

        const config = originalRequest as typeof originalRequest & {_retry?: boolean};
        if (config._retry) {
          return Promise.reject(error);
        }

        config._retry = true;

        try {
          const refreshed = await getRefreshedToken();
          if (refreshed) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${refreshed}`;
            return api(config);
          }
        } catch {
          await clearSession();
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [getRefreshedToken, clearSession]);

  const login = useCallback(async (userEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/users/login', {email: userEmail, password});
      const {token: responseToken, refresh_token: responseRefresh, user} = response.data ?? {};
      if (!responseToken || !responseRefresh) {
        throw new Error('Missing token in response');
      }

      await persistSession({
        token: responseToken,
        refreshToken: responseRefresh,
        user: mapUser(user ?? {email: userEmail})
      });
    } finally {
      setIsLoading(false);
    }
  }, [persistSession]);

  const register = useCallback(async (name: string, userEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/users/register', {name, email: userEmail, password});
      const {token: responseToken, refresh_token: responseRefresh, user} = response.data ?? {};
      if (!responseToken || !responseRefresh) {
        throw new Error('Missing token in response');
      }

      await persistSession({
        token: responseToken,
        refreshToken: responseRefresh,
        user: mapUser(user ?? {name, email: userEmail})
      });
    } finally {
      setIsLoading(false);
    }
  }, [persistSession]);

  const logout = useCallback(async () => {
    const currentRefresh = refreshTokenRef.current;
    try {
      if (currentRefresh) {
        await api.post('/auth/logout', {refresh_token: currentRefresh});
      }
    } catch {
      // swallow logout failures
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      email,
      userId,
      userName,
      isAdmin,
      isLoading,
      isBootstrapping,
      login,
      register,
      logout
    }),
    [token, refreshToken, email, userId, userName, isAdmin, isLoading, isBootstrapping, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
};

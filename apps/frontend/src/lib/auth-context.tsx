'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type AuthResponse } from './api';

interface AuthState {
  user: AuthResponse['user'] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, inviteCode: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const setAuth = useCallback((response: AuthResponse) => {
    api.setToken(response.accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', response.refreshToken);
    }
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setAuth(res.data);
  }, [setAuth]);

  const register = useCallback(async (email: string, password: string, name: string, inviteCode: string) => {
    const res = await api.register({ email, password, name, inviteCode });
    setAuth(res.data);
  }, [setAuth]);

  const logout = useCallback(() => {
    api.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('refreshToken');
    }
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  useEffect(() => {
    api.setOnAuthFailure(() => {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    });
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    api.getMyProfile()
      .then((res) => {
        setState({ user: res.data as unknown as AuthResponse['user'], isLoading: false, isAuthenticated: true });
      })
      .catch((err) => {
        // Only clear tokens on auth errors (401), not on connection errors
        if (err?.status === 401) {
          api.setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('refreshToken');
          }
        }
        // On connection errors (status 0 or 500), keep tokens for retry on next load
        setState({ user: null, isLoading: false, isAuthenticated: false });
      });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

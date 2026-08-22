import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '../types/index.js';
import { api } from '../utils/api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      localStorage.removeItem('worklog_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (loginInput: string, password: string) => {
    const res = await api.post<{ user: User; token: string; message: string }>('/api/auth/login', {
      login: loginInput,
      password,
    });
    if (res.token) {
      localStorage.setItem('worklog_token', res.token);
    }
    setUser(res.user);
  };

  const register = async (email: string, username: string, password: string, fullName?: string) => {
    const res = await api.post<{ user: User; token: string; message: string }>('/api/auth/register', {
      email,
      username,
      password,
      fullName,
    });
    if (res.token) {
      localStorage.setItem('worklog_token', res.token);
    }
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('worklog_token');
      setUser(null);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    const res = await api.put<{ user: User; message: string }>('/api/auth/profile', {
      fullName: data.full_name,
      themePreference: data.theme_preference,
    });
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

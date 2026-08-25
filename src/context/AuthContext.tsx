import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, SessionInfo } from '../types';

interface AuthContextType {
  user: User | null;
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  concurrentSessionAlert: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<void>;
  dismissConcurrentAlert: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [concurrentSessionAlert, setConcurrentSessionAlert] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSession(data.session);
        setError(null);
      } else if (res.status === 401) {
        if (user) {
          // If we had a user and now got 401, it was revoked by a concurrent login!
          setConcurrentSessionAlert(true);
        }
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshAuth();

    // Heartbeat check every 30 seconds to catch remote disconnects / concurrent logins
    const interval = setInterval(() => {
      if (user) {
        refreshAuth();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshAuth, user]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao realizar login.');
        return { success: false, error: data.error || 'Erro ao realizar login.' };
      }

      setUser(data.user);
      setSession(data.session);
      setConcurrentSessionAlert(false);
      return { success: true };
    } catch (err: any) {
      const msg = 'Erro de conexão com o servidor.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  const changePassword = async (newPassword: string, currentPassword?: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao alterar senha.' };
      }
      if (user) {
        setUser({ ...user, forcePasswordChange: false });
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const dismissConcurrentAlert = () => {
    setConcurrentSessionAlert(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        error,
        concurrentSessionAlert,
        login,
        logout,
        changePassword,
        refreshAuth,
        dismissConcurrentAlert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

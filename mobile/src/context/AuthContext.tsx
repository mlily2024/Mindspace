/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authAPI } from '../services/api';
import { saveToken, getToken, removeToken, saveUser, getUser, clearAll } from '../services/storage';

interface User {
  userId: string;
  email: string;
  name?: string;
  preferences?: object;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on app start
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      if (token) {
        // Verify token by fetching profile
        const response = await authAPI.getProfile();
        if (response.success && response.data?.user) {
          setUser(response.data.user);
          setIsAuthenticated(true);
          await saveUser(response.data.user);
        } else {
          // Token invalid, clear storage
          await clearAll();
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        // Try to get cached user
        const cachedUser = await getUser();
        if (cachedUser) {
          setUser(cachedUser as User);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // Clear on error
      await clearAll();
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });

      if (response.success && response.data) {
        const { token, user: userData } = response.data;

        await saveToken(token);
        await saveUser(userData);

        setUser(userData as User);
        setIsAuthenticated(true);
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const response = await authAPI.register({ email, password, name });

      if (response.success && response.data) {
        const { token, user: userData } = response.data;

        await saveToken(token);
        await saveUser(userData);

        setUser(userData as User);
        setIsAuthenticated(true);
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await clearAll();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        await saveUser(response.data.user);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

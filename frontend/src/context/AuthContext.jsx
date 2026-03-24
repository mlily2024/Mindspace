import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Inactivity timeout: 30 minutes
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const inactivityTimer = useRef(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Inactivity timeout — auto-logout after 30 minutes of no interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      // Only logout if currently authenticated
      const token = localStorage.getItem('token');
      if (token) {
        localStorage.removeItem('token');
        setUser(null);
        window.location.href = '/login';
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetInactivityTimer();

    events.forEach(event => window.addEventListener(event, handler, { passive: true }));
    resetInactivityTimer(); // Start the timer

    return () => {
      events.forEach(event => window.removeEventListener(event, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getProfile();
      setUser(response.data.user);
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      return { success: true };
    } catch (err) {
      // Handle detailed validation errors from backend
      let message = 'Registration failed';
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        // Show all validation errors with field names
        message = err.errors.map(e => `${e.field}: ${e.message}`).join('. ');
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
      return { success: false, error: message };
    }
  };

  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      return { success: true };
    } catch (err) {
      // Handle detailed validation errors from backend
      let message = 'Login failed';
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        // Show all validation errors with field names
        message = err.errors.map(e => `${e.field}: ${e.message}`).join('. ');
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  const updateProfile = async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      setUser(response.data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updatePreferences = async (preferences) => {
    try {
      await authAPI.updatePreferences(preferences);
      await checkAuth();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile,
    updatePreferences,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

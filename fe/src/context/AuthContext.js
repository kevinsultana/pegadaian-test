'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check saved token & user on mount
    const savedToken = localStorage.getItem('pegadaian_token');
    const savedUser = localStorage.getItem('pegadaian_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('pegadaian_token');
        localStorage.removeItem('pegadaian_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (res.success && res.data) {
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);
      localStorage.setItem('pegadaian_token', receivedToken);
      localStorage.setItem('pegadaian_user', JSON.stringify(receivedUser));

      // Redirect based on role
      if (receivedUser.role === 'SUPER_ADMIN') {
        router.push('/admin/dashboard');
      } else if (receivedUser.location?.type === 'HEAD_OFFICE' || receivedUser.role.startsWith('HO_')) {
        router.push('/ho/dashboard');
      } else {
        router.push('/outlet/dashboard');
      }
      return res.data;
    }
    throw new Error(res.message || 'Login gagal');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pegadaian_token');
    localStorage.removeItem('pegadaian_user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

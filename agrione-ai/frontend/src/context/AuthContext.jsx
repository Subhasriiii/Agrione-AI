import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('agrione_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('agrione_token');
      const storedUser = localStorage.getItem('agrione_user');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);

          const res = await authApi.getProfile();
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem('agrione_user', JSON.stringify(res.user));
          }
        } catch (error) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('agrione_token');
          localStorage.removeItem('agrione_user');
        }
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('agrione_token');
        localStorage.removeItem('agrione_user');
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await authApi.login({ email, password });
      if (data?.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('agrione_token', data.token);
        localStorage.setItem('agrione_user', JSON.stringify(data.user));
        return { success: true };
      }
      return { success: false, message: data?.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const data = await authApi.register(userData);
      if (data?.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('agrione_token', data.token);
        localStorage.setItem('agrione_user', JSON.stringify(data.user));
        return { success: true };
      }
      return { success: false, message: data?.message || 'Registration failed' };
    } catch (err) {
      return { success: false, message: err.message || 'Registration failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('agrione_token');
    localStorage.removeItem('agrione_user');
  };

  const updateProfile = async (data) => {
    try {
      const res = await authApi.updateProfile(data);
      if (res?.user) {
        setUser(res.user);
        localStorage.setItem('agrione_user', JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, message: res?.message || 'Unable to update profile' };
    } catch (err) {
      return { success: false, message: err.message || 'Unable to update profile' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

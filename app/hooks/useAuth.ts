import { useState } from 'react';

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'signup' | 'login' | '2fa'>('signup');
  const [emailL, setEmailL] = useState('');
  const [passL, setPassL] = useState('');
  const [emailS, setEmailS] = useState('');
  const [passS, setPassS] = useState('');
  const [name, setName] = useState('');

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  const registerUser = async (email: string, password: string, userData: { name: string; roles: string[] }) => {
    setLoading(true);
    try {
      const requestData = { email, password, ...userData };
      console.log('Sending data to register:', requestData);

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || `Error ${response.status}`);
      }

      const data = await response.json();
      setToken(data.token);
      console.log('Registration successful:', data);
      return data;
    } catch (error: unknown) {
      if (error instanceof Error) setError(error.message);
      else setError('Error desconocido');
      console.error('Error during registration:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (email: string, password: string) => {
    setLoading(true);
    try {
      const requestData = { email, password };
      console.log('Sending data to login:', requestData);

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || 'Error al iniciar sesión');
      }

      const data = await response.json();
      setToken(data.token);
      console.log('Login successful:', data);

      return { ...data, twoFactorRequired: data.twoFactorRequired ?? false };
    } catch (error: unknown) {
      if (error instanceof Error) setError(error.message);
      else setError('Error desconocido');
      console.error('Error during login:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const verifyTwoFactor = async (email: string, password: string, twoFactorCode: string) => {
    setLoading(true);
    console.log('Verifying 2FA with code:', twoFactorCode);

    try {
      const requestData = { email, password, token: twoFactorCode };
      const response = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      console.log('Request data sent for 2FA verification:', requestData);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || 'Error during 2FA verification');
      }

      const data = await response.json();
      setToken(data.token);
      console.log('2FA verification successful:', data);

      return data;
    } catch (error: unknown) {
      if (error instanceof Error) setError(error.message);
      else setError('Error desconocido');
      console.error('Error during 2FA verification:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = () => {
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setTab('signup');
    setEmailL('');
    setPassL('');
    setEmailS('');
    setPassS('');
    setName('');
  };

  return {
    loading,
    error,
    token,
    registerUser,
    loginUser,
    verifyTwoFactor,
    logoutUser,
  };
};

import { create } from 'zustand';

interface AuthState {
  loading: boolean;
  error: string | null;
  token: string | null;
  tab: 'signup' | 'login' | '2fa';
  emailL: string;
  passL: string;
  emailS: string;
  passS: string;
  name: string;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setToken: (token: string | null) => void;
  setTab: (tab: 'signup' | 'login' | '2fa') => void;
  setEmailL: (email: string) => void;
  setPassL: (password: string) => void;
  setEmailS: (email: string) => void;
  setPassS: (password: string) => void;
  setName: (name: string) => void;
  registerUser: (email: string, password: string, userData: { name: string; roles: string[] }) => Promise<any>;
  loginUser: (email: string, password: string) => Promise<any>;
  verifyTwoFactor: (email: string, password: string, twoFactorCode: string) => Promise<any>;
  logoutUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  loading: false,
  error: null,
  token: null,
  tab: 'signup',
  emailL: '',
  passL: '',
  emailS: '',
  passS: '',
  name: '',

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setToken: (token) => set({ token }),
  setTab: (tab) => set({ tab }),
  setEmailL: (email) => set({ emailL: email }),
  setPassL: (password) => set({ passL: password }),
  setEmailS: (email) => set({ emailS: email }),
  setPassS: (password) => set({ passS: password }),
  setName: (name) => set({ name }),

  // Mantén la lógica tal como estaba en tus métodos
  registerUser: async (email, password, userData) => {
    set({ loading: true });
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
    try {
      const requestData = { email, password, ...userData };
      console.log('Sending data to register:', requestData);

      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || `Error ${response.status}`);
      }

      const data = await response.json();
      set({ token: data.token });
      console.log('Registration successful:', data);
      return data;
    } catch (error: unknown) {
      if (error instanceof Error) set({ error: error.message });
      else set({ error: 'Error desconocido' });
      console.error('Error during registration:', error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  loginUser: async (email, password) => {
    set({ loading: true });
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
    try {
      const requestData = { email, password };
      console.log('Sending data to login:', requestData);

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || 'Error al iniciar sesión');
      }

      const data = await response.json();
      set({ token: data.token });
      console.log('Login successful:', data);

      return { ...data, twoFactorRequired: data.twoFactorRequired ?? false };
    } catch (error: unknown) {
      if (error instanceof Error) set({ error: error.message });
      else set({ error: 'Error desconocido' });
      console.error('Error during login:', error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  verifyTwoFactor: async (email, password, twoFactorCode) => {
    set({ loading: true });
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
    try {
      const requestData = { email, password, token: twoFactorCode };
      const response = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      console.log('Request data sent for 2FA verification:', requestData);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || 'Error during 2FA verification');
      }

      const data = await response.json();
      set({ token: data.token });
      console.log('2FA verification successful:', data);

      return data;
    } catch (error: unknown) {
      if (error instanceof Error) set({ error: error.message });
      else set({ error: 'Error desconocido' });
      console.error('Error during 2FA verification:', error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  logoutUser: () => {
    set({ token: null });
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    set({ tab: 'signup', emailL: '', passL: '', emailS: '', passS: '', name: '' });
  },
}));


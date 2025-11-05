import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tab = 'signup' | 'login' | '2fa';

interface UserData {
  name?: string;
  roles?: string[];
  [k: string]: any;
}

interface AuthState {
  // UI / fields
  tab: Tab;
  name: string;
  emailS: string;
  passS: string;
  emailL: string;
  passL: string;
  err: string;
  twoFactorCode: string;
  qrCodeUrl: string | null;
  is2FARequired: boolean;
  loading: boolean;

  // auth token (persisted)
  token: string | null;

  // setters
  setTab: (tab: Tab) => void;
  setName: (name: string) => void;
  setEmailS: (email: string) => void;
  setPassS: (password: string) => void;
  setEmailL: (email: string) => void;
  setPassL: (password: string) => void;
  setErr: (error: string) => void;
  setTwoFactorCode: (code: string) => void;
  setQrCodeUrl: (url: string | null) => void;
  setIs2FARequired: (required: boolean) => void;
  setLoading: (loading: boolean) => void;
  setToken: (token: string | null, persist?: boolean) => void;

  // actions
  registerUser: (email: string, password: string, userData?: UserData) => Promise<any>;
  loginUser: (email: string, password: string) => Promise<any>;
  verifyTwoFactor: (email: string, password: string, twoFactorCode: string) => Promise<any>;
  logoutUser: () => void;

  // helpers
  resetState: () => void;
}

const API_BASE =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== '')
    ? process.env.NEXT_PUBLIC_API_URL
    : '';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // initial state
      tab: 'signup',
      name: '',
      emailS: '',
      passS: '',
      emailL: '',
      passL: '',
      err: '',
      twoFactorCode: '',
      qrCodeUrl: null,
      is2FARequired: false,
      loading: false,
      token: null,

      // setters
      setTab: (tab) => set({ tab }),
      setName: (name) => set({ name }),
      setEmailS: (email) => set({ emailS: email }),
      setPassS: (password) => set({ passS: password }),
      setEmailL: (email) => set({ emailL: email }),
      setPassL: (password) => set({ passL: password }),
      setErr: (error) => set({ err: error }),
      setTwoFactorCode: (code) => set({ twoFactorCode: code }),
      setQrCodeUrl: (url) => set({ qrCodeUrl: url }),
      setIs2FARequired: (required) => set({ is2FARequired: required }),
      setLoading: (loading) => set({ loading }),

      // persist-aware setter for token & name
      setToken: (token, persistToken = true) => {
        set({ token: token ?? null });
        try {
          if (typeof window !== 'undefined') {
            if (token && persistToken) {
              localStorage.setItem('authToken', token);
            } else {
              localStorage.removeItem('authToken');
            }
          }
        } catch {
          // ignore localStorage errors
        }
      },

      // actions
      registerUser: async (email, password, userData = {}) => {
        set({ loading: true, err: '' });
        try {
          const requestData = { email, password, ...userData };
          const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
          });

          const body = await res.json().catch(() => null);
          if (!res.ok) {
            const message = body?.message || `Error ${res.status}`;
            throw new Error(message);
          }

          // if backend returns token, persist via setToken
          if (body?.token) get().setToken(body.token);
          return body;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          set({ err: message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      loginUser: async (email, password) => {
        set({ loading: true, err: '' });
        try {
          const requestData = { email, password };
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
          });

          const body = await res.json().catch(() => null);
          if (!res.ok) {
            const message = body?.message || 'Error al iniciar sesión';
            throw new Error(message);
          }

          // If backend indicates 2FA is required, don't persist token yet
          const twoFactorRequired = body?.twoFactorRequired ?? false;
          if (twoFactorRequired) {
            set({ is2FARequired: true });
            if (body?.qrCodeUrl) set({ qrCodeUrl: body.qrCodeUrl });
            return { ...body, twoFactorRequired: true };
          }

          if (body?.token) {
            // persist token and optionally name
            get().setToken(body.token, true);
            if (body?.name) set({ name: body.name });
          }

          return { ...body, twoFactorRequired: false };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          set({ err: message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      verifyTwoFactor: async (email, password, twoFactorCode) => {
        set({ loading: true, err: '' });
        try {
          const requestData = { email, password, token: twoFactorCode };
          const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
          });

          const body = await res.json().catch(() => null);
          if (!res.ok) {
            const message = body?.message || 'Error during 2FA verification';
            throw new Error(message);
          }

          if (body?.token) {
            get().setToken(body.token, true);
            set({ is2FARequired: false, qrCodeUrl: null });
            if (body?.name) set({ name: body.name });
          }

          return body;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          set({ err: message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      logoutUser: () => {
        // clear persisted token & other client storage
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userName');
            // optionally remove other keys used in your app:
            // localStorage.removeItem('roles'); localStorage.removeItem('userData'); etc.
          }
        } catch { /* ignore */ }

        // reset store values (token & UI fields)
        set({
          token: null,
          name: '',
          tab: 'signup',
          emailS: '',
          passS: '',
          emailL: '',
          passL: '',
          err: '',
          twoFactorCode: '',
          qrCodeUrl: null,
          is2FARequired: false,
          loading: false,
        });
      },

      resetState: () => {
        // reset only UI fields but keep token (useful when modal closes)
        set({
          tab: 'signup',
          name: '',
          emailS: '',
          passS: '',
          emailL: '',
          passL: '',
          err: '',
          twoFactorCode: '',
          qrCodeUrl: null,
          is2FARequired: false,
          loading: false,
        });
      },
    }),

    {
      name: 'auth-store', // key in localStorage
      partialize: (state) => ({ token: state.token, name: state.name }), // persist only token & name
      version: 1,
    }
  )
);

export default useAuthStore;

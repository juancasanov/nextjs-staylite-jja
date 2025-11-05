'use client';

import 'font-awesome/css/font-awesome.min.css';
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { HostAuthModal } from '../auth/HostAuthModal';
import { SearchBar } from './SearchBar';
import type { OnSearchFn } from '../types/search';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/app/stores/stores';

// Componente interno que usa useSearchParams
function NavbarWithSearchParams({
  onAuthOpenChange
}: {
  onAuthOpenChange: (open: boolean, tab: 'signup' | 'login') => void
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const shouldOpen = searchParams.get('authOpen') === '1';
    const tab = (searchParams.get('tab') as 'signup' | 'login') || 'signup';
    if (shouldOpen) {
      onAuthOpenChange(true, tab);
    }
  }, [searchParams, onAuthOpenChange]);

  return null;
}

export const Navbar = ({ onSearch }: { onSearch: OnSearchFn }) => {
  // UI / modal local
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signup' | 'login'>('signup');
  const [roles, setRoles] = useState<string[]>([]);
  const [modalKey, setModalKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewAs, setViewAs] = useState<'host' | 'guest' | null>(null);
  const [pending, setPending] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const isListing = pathname?.startsWith('/listing/');

  const API_BASE =
    (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== '')
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  // ------------------ Zustand (auth central) ------------------
  const token = useAuthStore((s) => s.token);
  const authName = useAuthStore((s) => s.name);
  const loading = useAuthStore((s) => s.loading);

  // setters/actions
  const setToken = useAuthStore((s) => s.setToken);
  const setName = useAuthStore((s) => s.setName);
  const setTab = useAuthStore((s) => s.setTab);
  const setEmailL = useAuthStore((s) => s.setEmailL);
  const setPassL = useAuthStore((s) => s.setPassL);
  const setEmailS = useAuthStore((s) => s.setEmailS);
  const setPassS = useAuthStore((s) => s.setPassS);
  const setTwoFactorCode = useAuthStore((s) => s.setTwoFactorCode);
  const qrCodeUrl = useAuthStore((s) => s.qrCodeUrl);
  const is2FARequired = useAuthStore((s) => s.is2FARequired);

  const registerUser = useAuthStore((s) => s.registerUser);
  const loginUser = useAuthStore((s) => s.loginUser);
  const verifyTwoFactor = useAuthStore((s) => s.verifyTwoFactor);
  const logoutUser = useAuthStore((s) => s.logoutUser);
  const resetAuthState = useAuthStore((s) => s.resetState);

  // ------------------ helpers for localStorage roles / userId ------------------
  const normalizeRoles = (arr: any): string[] =>
    (Array.isArray(arr) ? arr : [arr])
      .filter((v) => v !== null && v !== undefined)
      .map(String)
      .flatMap((s) => (s.includes(',') ? s.split(',') : [s]))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

  const tryParse = (raw: string | null): any => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  };

  const readRoles = (): string[] => {
    let v = tryParse(localStorage.getItem('roles'));
    if (typeof v === 'string') {
      const looksJsonArray = v.trim().startsWith('[') && v.trim().endsWith(']');
      if (looksJsonArray) {
        try { v = JSON.parse(v); } catch { }
      }
    }
    if (!v || (Array.isArray(v) && v.length === 0)) {
      const ud = tryParse(localStorage.getItem('userData'));
      if (ud?.roles) v = ud.roles;
    }
    return Array.from(new Set(normalizeRoles(v ?? [])));
  };

  const readUserId = (): string | null => {
    const idFromStorage = localStorage.getItem('userId');
    if (idFromStorage) return idFromStorage;
    try {
      const udRaw = localStorage.getItem('userData');
      if (!udRaw) return null;
      const ud = JSON.parse(udRaw);
      const candidates = [
        ud?.id, ud?._id, ud?.userId, ud?.user?.id, ud?.user?._id, ud?.data?.id, ud?.data?._id, ud?.payload?.sub,
      ];
      for (const c of candidates) {
        if (c && String(c).trim()) return String(c);
      }
      if (ud && typeof ud === 'object') {
        for (const key of Object.keys(ud)) {
          const val = ud[key];
          if (typeof val === 'string' && val.length >= 6 && /^[a-z0-9-_.]+$/i.test(val)) return val;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const saveActiveRole = (role: 'host' | 'guest' | null) => {
    if (role) {
      localStorage.setItem('activeRole', role);
      localStorage.setItem('viewAs', role);
    } else {
      localStorage.removeItem('activeRole');
      localStorage.removeItem('viewAs');
    }
    window.dispatchEvent(new CustomEvent('role:changed', { detail: { activeRole: role } }));
    window.dispatchEvent(new CustomEvent('view:changed', { detail: { viewAs: role } }));
    window.dispatchEvent(new Event('auth:updated'));
  };

  // ------------------ roles API (kept local) ------------------
  const updateRolesApi = async (userIdParam: string, rolesArray: string[]) => {
    try {
      const url = `${API_BASE}/auth/${userIdParam}`;
      const t = localStorage.getItem('authToken');
      const normalized = Array.from(new Set((rolesArray ?? []).map(r => String(r ?? '').trim().toLowerCase()).filter(Boolean)));

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({ roles: normalized }),
      });

      const text = await res.text().catch(() => '');
      if (!res.ok) return { ok: false, status: res.status, bodyText: text };
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      const returnedRoles = Array.isArray(data?.roles) ? data.roles.map((r: any) => String(r).toLowerCase()) : normalized;
      return { ok: true, roles: returnedRoles, data };
    } catch (error) {
      console.error('updateRolesApi error', error);
      return { ok: false, error };
    }
  };

  const addRole = async (roleToAdd: string) => {
    const uid = userId ?? readUserId();
    if (!uid) {
      console.warn('No userId available to update roles. Abriendo login...');
      setAuthTab('login');
      setAuthOpen(true);
      return { ok: false, reason: 'no-userid' };
    }

    setPending(true);
    try {
      const current = roles.map(r => String(r).toLowerCase());
      const want = Array.from(new Set([...current, String(roleToAdd).toLowerCase()]));
      const res = await updateRolesApi(uid, want);
      if (!res.ok) return { ok: false, error: res };
      const finalRoles = Array.isArray(res.roles) ? res.roles : want;
      localStorage.setItem('roles', JSON.stringify(finalRoles));
      setRoles(finalRoles);
      setUserId(uid);
      window.dispatchEvent(new Event('auth:updated'));
      try { router.refresh(); } catch { }
      return { ok: true, roles: finalRoles };
    } finally {
      setPending(false);
    }
  };

  const removeRole = async (roleToRemove: string) => {
    const uid = userId ?? readUserId();
    if (!uid) {
      console.warn('No userId available to update roles. Abriendo login...');
      setAuthTab('login');
      setAuthOpen(true);
      return { ok: false, reason: 'no-userid' };
    }

    setPending(true);
    try {
      const current = roles.map(r => String(r).toLowerCase());
      const want = current.filter(r => r !== String(roleToRemove).toLowerCase());
      const res = await updateRolesApi(uid, want);
      if (!res.ok) return { ok: false, error: res };
      const finalRoles = Array.isArray(res.roles) ? res.roles : want;
      localStorage.setItem('roles', JSON.stringify(finalRoles));
      setRoles(finalRoles);
      setUserId(uid);
      window.dispatchEvent(new Event('auth:updated'));
      try { router.refresh(); } catch { }
      return { ok: true, roles: finalRoles };
    } finally {
      setPending(false);
    }
  };

  // ------------------ view management ------------------
  const setViewMode = (mode: 'host' | 'guest') => {
    setViewAs(mode);
    try {
      localStorage.setItem('viewAs', mode);
      localStorage.setItem('activeRole', mode);
    } catch (err) {
      console.warn('Could not write view to localStorage', err);
    }
    window.dispatchEvent(new CustomEvent('view:changed', { detail: { viewAs: mode } }));
    window.dispatchEvent(new CustomEvent('role:changed', { detail: { activeRole: mode } }));
    window.dispatchEvent(new Event('auth:updated'));
  };

  // ------------------ effects ------------------
  useEffect(() => {
    setRoles(readRoles());
    setUserId(readUserId());
    const savedView = localStorage.getItem('viewAs') as 'host' | 'guest' | null;
    if (savedView) setViewAs(savedView);

    const tokenLocal = localStorage.getItem('authToken');
    const nameLocal = localStorage.getItem('userName');
    if (tokenLocal && nameLocal) {
      setToken(tokenLocal);
      setName(nameLocal);
    } else {
      if (!tokenLocal) setToken(null);
    }
  }, []);

  useEffect(() => {
    const updateRoles = () => {
      setRoles(readRoles());
      setUserId(readUserId());
    };
    const storageHandler = (e: StorageEvent) => {
      if (!e.key) { updateRoles(); return; }
      if (['roles', 'userData', 'userId'].includes(e.key)) updateRoles();
    };
    window.addEventListener('auth:updated', updateRoles as EventListener);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('auth:updated', updateRoles as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  useEffect(() => { setRoles(readRoles()); }, [token]);

  // ------------------ handlers ------------------
  const handleAuthOpenChange = (open: boolean, tab: 'signup' | 'login') => {
    setAuthTab(tab);
    setAuthOpen(open);
  };

  const handleGoProfile = () => {
    if (!token) {
      setAuthTab('login');
      setAuthOpen(true);
      return;
    }
    router.push('/profile');
  };

  const handleCreateListing = async () => {
    if (!token) {
      localStorage.setItem('signupRole', 'host');
      setAuthTab('signup');
      setAuthOpen(true);
      return;
    }
    const lower = roles.map((r) => r.toLowerCase());
    if (lower.includes('host')) {
      router.push('/listing/new');
      return;
    }
    const res = await addRole('host');
    if (res.ok) router.push('/listing/new');
  };

  const handleConvertToHost = async () => {
    if (!token) {
      localStorage.setItem('signupRole', 'host');
      setAuthTab('signup');
      setAuthOpen(true);
      return;
    }
    const lower = roles.map((r) => r.toLowerCase());
    if (lower.includes('host')) {
      setViewMode('host');
      return;
    }

    setPending(true);
    try {
      const res = await addRole('host');
      if (res.ok && (res.roles ?? []).includes('host')) {
        setViewMode('host');
        return;
      }
      const uid = userId ?? readUserId();
      if (!uid) throw new Error('no userid');
      const replace = await updateRolesApi(uid, ['host']);
      if (replace.ok && (replace.roles ?? []).includes('host')) {
        localStorage.setItem('roles', JSON.stringify(replace.roles ?? []));
        setRoles(replace.roles ?? []);
        setViewMode('host');
        return;
      }
      alert('No se pudo asignar el rol anfitrión. Revisa backend/console.');
    } catch (err) {
      console.error('handleConvertToHost error', err);
      alert('Error inesperado. Revisa la consola.');
    } finally {
      setPending(false);
    }
  };

  const handleConvertToGuest = async () => {
    if (!token) {
      setAuthTab('signup');
      setAuthOpen(true);
      return;
    }
    const lower = roles.map((r) => r.toLowerCase());
    if (lower.includes('guest')) {
      setViewMode('guest');
      return;
    }

    setPending(true);
    try {
      const res = await addRole('guest');
      if (res.ok && (res.roles ?? []).includes('guest')) {
        setViewMode('guest');
        return;
      }

      const uid = userId ?? readUserId();
      if (!uid) throw new Error('no userid');
      const replace = await updateRolesApi(uid, ['guest']);
      if (replace.ok && (replace.roles ?? []).includes('guest')) {
        localStorage.setItem('roles', JSON.stringify(replace.roles ?? []));
        setRoles(replace.roles ?? []);
        setViewMode('guest');
        return;
      }

      const confirmRemove = confirm('El servidor no permitió añadir "guest". ¿Intentar eliminar "host" y quedarte solo como "guest"?');
      if (confirmRemove) {
        const rm = await removeRole('host');
        if (rm.ok && (rm.roles ?? []).includes('guest')) {
          setViewMode('guest');
          return;
        }
        alert('No fue posible quitar host. Revisa backend.');
      } else {
        alert('No se realizaron cambios.');
      }
    } catch (err) {
      console.error('handleConvertToGuest error', err);
      alert('Error inesperado. Revisa la consola.');
    } finally {
      setPending(false);
    }
  };

  const handleLogout = () => {
    const keys = [
      'authToken', 'userName', 'userData', 'roles', 'twoFactorRequired', 'qrCodeUrl',
      'twoFactorEnabled', 'twoFactorSecret', 'twoFactorTempToken', 'twoFactorCode',
      'postLoginRedirect', 'signupRole', 'userId', 'viewAs', 'activeRole'
    ];
    keys.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.clear(); } catch { }
    logoutUser();
    setRoles([]);
    setAuthOpen(false);
    setAuthTab('signup');
    setModalKey((k) => k + 1);
    setViewAs(null);
    saveActiveRole(null);
    router.push('/');
    try { router.refresh(); } catch { }
    window.dispatchEvent(new Event('auth:updated'));
  };

  const roleSet = new Set(roles.map((r) => r.toLowerCase()));
  const isHost = roleSet.has('host');
  const isAdmin = roleSet.has('admin');
  const isGuest = roleSet.has('guest');

  // ------------------ JSX ------------------
  return (
    <>
      {/* Envolver solo la parte que usa useSearchParams */}
      <Suspense fallback={null}>
        <NavbarWithSearchParams onAuthOpenChange={handleAuthOpenChange} />
      </Suspense>

      <nav className={`bg-blue-600 w-full flex justify-between items-center mx-auto px-8 transition-all duration-300 ${isListing ? 'py-2' : 'py-1'}`}>
        <div className="flex items-center">
          <Link href="/" className="block">
            <img src="/logo.png" alt="StayLite Logo" className={`w-30 h-auto object-contain transition-all ${isListing ? 'mt-0' : 'mt-2'}`} />
          </Link>
        </div>

        <div className="flex justify-center items-center space-x-8 ml-10 md:ml-30">
          {[{ src: '/alojamiento.png', label: 'Alojamientos' }, { src: '/experiencias.png', label: 'Experiencias' }, { src: '/servicio.png', label: 'Buen servicio' }].map((item) => (
            <div key={item.label} className="text-white text-center">
              <div className="flex justify-center items-center space-x-2">
                <img src={item.src} alt={item.label} className="w-6 h-6" />
                <span>{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          {token && (
            <button type="button" onClick={handleGoProfile} className="py-2 px-4 text-sm bg-white text-blue-700 rounded-full hover:bg-gray-200 transition">
              Ir al perfil
            </button>
          )}

          {token && (isHost) && (
            <button
              type="button"
              onClick={handleCreateListing}
              disabled={pending}
              className={`py-2 px-4 text-sm rounded-full ${pending ? 'opacity-60 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'} transition`}
            >
              Crear listing
            </button>
          )}

          {!token ? (
            <>
              <button type="button" onClick={() => { localStorage.setItem('signupRole', 'host'); setAuthTab('signup'); setAuthOpen(true); }} className="py-2 px-4 text-sm bg-white text-black rounded-full hover:bg-gray-200 transition">
                Convertirme en anfitrión
              </button>

              <button type="button" onClick={() => { setAuthTab('login'); setAuthOpen(true); }} className="py-2 px-3 bg-white text-blue-600 rounded-full shadow-md hover:bg-gray-200 transition" aria-label="Perfil / Iniciar sesión">
                <i className="fa fa-user text-[18px]" />
              </button>
            </>
          ) : (
            <>
              {isHost ? (
                <button
                  type="button"
                  onClick={() => setViewMode('host')}
                  className={`py-2 px-3 text-sm rounded-full border ${viewAs === 'host' ? 'bg-white text-black' : 'bg-transparent text-white'}`}
                >
                  Ver como anfitrión
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConvertToHost}
                  disabled={pending}
                  className={`py-2 px-4 text-sm rounded-full ${pending ? 'opacity-60 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'} transition`}
                >
                  Convertirme en anfitrión
                </button>
              )}

              {isGuest ? (
                <button
                  type="button"
                  onClick={() => setViewMode('guest')}
                  className={`py-2 px-3 text-sm rounded-full border ${viewAs === 'guest' ? 'bg-white text-black' : 'bg-transparent text-white'}`}
                >
                  Ver como huésped
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConvertToGuest}
                  disabled={pending}
                  className={`py-2 px-4 text-sm rounded-full ${pending ? 'opacity-60 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'} transition`}
                >
                  Convertirme en huésped
                </button>
              )}
            </>
          )}

          {token && (
            <button type="button" onClick={handleLogout} className="py-2 px-4 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition">
              Cerrar sesión
            </button>
          )}
        </div>
      </nav>

      {!isListing && (
        <div className="bg-blue-600 w-full flex justify-center -mt-10 md:-mt-12 pb-6">
          <SearchBar onSearch={onSearch} />
        </div>
      )}

      <HostAuthModal
        key={modalKey}
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('authOpen');
            url.searchParams.delete('tab');
            router.replace(url.pathname + url.search);
          }
          setRoles(readRoles());
          setUserId(readUserId());
          resetAuthState();
        }}
        setIsAuthenticated={(v) => {
          if (!v) {
            setToken(null);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userName');
          } else {
            const t = localStorage.getItem('authToken');
            const n = localStorage.getItem('userName') ?? undefined;
            if (t) setToken(t);
            if (n) setName(n);
          }
        }}
        setUserName={(value: React.SetStateAction<string | null>) => {
          const current = typeof window !== 'undefined' ? localStorage.getItem('userName') : null;
          const resolved =
            typeof value === 'function'
              ? (value as (prev: string | null) => string | null)(current)
              : value;

          if (resolved) localStorage.setItem('userName', resolved);
          else localStorage.removeItem('userName');

          setName(resolved ?? '');
        }}
      />
    </>
  );
};

export default Navbar;
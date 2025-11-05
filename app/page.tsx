'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import ListingCard from './components/Listing/ListingCard';
import { useRouter } from 'next/navigation';
import { Navbar } from './components/NavBar/NavBar';
import type { OnSearchFn } from './components/types/search';

function NavbarSkeleton() {
  return (
    <nav className="bg-blue-600 w-full flex justify-between items-center mx-auto px-8 py-1">
      <div className="flex items-center">
        <div className="w-32 h-10 bg-white/20 rounded animate-pulse" />
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-24 h-8 bg-white/20 rounded-full animate-pulse" />
        <div className="w-10 h-10 bg-white/20 rounded-full animate-pulse" />
      </div>
    </nav>
  );
}

// ---------- Roles tipados y utilidades ----------
export const ROLES = ['host', 'guest', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const isRole = (s: unknown): s is Role =>
  typeof s === 'string' && (ROLES as readonly string[]).includes(String(s).toLowerCase());

const normalizeRoles = (input: unknown): Role[] => {
  const arr = Array.isArray(input) ? input : [input];
  const roles = arr
    .filter((v): v is string | number => v != null)
    .map(String)
    .map((s) => s.trim().toLowerCase())
    .filter(isRole);
  return Array.from(new Set(roles));
};
// ------------------------------------------------

const LS = {
  ROLES: 'roles',
  ACTIVE_ROLE: 'activeRole',
  VIEW_AS: 'viewAs',
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  USER_ID: 'userId',
} as const;

function parseJwt(token?: string | null) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readRoles(): Role[] {
  try {
    const raw = localStorage.getItem(LS.ROLES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return normalizeRoles(parsed);
  } catch {
    return [];
  }
}

function readActiveRole(): Role | null {
  try {
    const v = localStorage.getItem(LS.ACTIVE_ROLE);
    if (v && isRole(v)) return v as Role;
    const fallback = localStorage.getItem(LS.VIEW_AS);
    if (fallback && isRole(fallback)) return fallback as Role;
    return null;
  } catch {
    return null;
  }
}

function readUserId(): string | null {
  try {
    const direct = localStorage.getItem(LS.USER_ID);
    if (direct && String(direct).trim()) return String(direct).trim();

    const udRaw = localStorage.getItem(LS.USER_DATA);
    if (udRaw) {
      try {
        const ud = JSON.parse(udRaw);
        const candidates = [ud?.id, ud?._id, ud?.userId];
        for (const c of candidates) {
          if (c && String(c).trim()) return String(c).trim();
        }
        if (typeof ud === 'object') {
          for (const k of Object.keys(ud)) {
            const v = ud[k];
            if (typeof v === 'string' && v.length >= 6 && /^[a-z0-9-_.]+$/i.test(v)) {
              return v;
            }
            if (typeof v === 'object' && (v?.id || v?._id)) {
              return String(v.id ?? v._id);
            }
          }
        }
      } catch { }
    }

    const token = localStorage.getItem(LS.AUTH_TOKEN) || null;
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        if (payload.sub) return String(payload.sub);
        if (payload.id) return String(payload.id);
        if (payload.userId) return String(payload.userId);
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ---------- API_BASE desde env ----------
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
    ? process.env.NEXT_PUBLIC_API_URL
    : '';

const HomePage = () => {
  const [lodgings, setLodgings] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isHostView, setIsHostView] = useState(false);
  const router = useRouter();

  const recomputeMode = useCallback(() => {
    const roles = readRoles();
    const active = readActiveRole();
    const hostPresent = roles.includes('host');
    const hostView = hostPresent && active === 'host';
    setIsHostView(hostView);
  }, []);

  useEffect(() => {
    recomputeMode();
    const onChange = () => recomputeMode();
    window.addEventListener('storage', onChange);
    window.addEventListener('role:changed', onChange as EventListener);
    window.addEventListener('view:changed', onChange as EventListener);
    window.addEventListener('auth:updated', onChange as EventListener);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('role:changed', onChange as EventListener);
      window.removeEventListener('view:changed', onChange as EventListener);
      window.removeEventListener('auth:updated', onChange as EventListener);
    };
  }, [recomputeMode]);

  const fetchHostLodgingsFallback = async (hostId: string, token: string | null) => {
    const candidates = [
      `${API_BASE}/lodgings/${hostId}/my-lodgings`,
      `${API_BASE}/lodgings?ownerId=${hostId}`,
      `${API_BASE}/lodgings?hostId=${hostId}`,
      `${API_BASE}/users/${hostId}/lodgings`,
    ];

    for (const url of candidates) {
      try {
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) continue;
        const data = await r.json();
        if (Array.isArray(data)) return data;
      } catch { }
    }

    // fallback final
    try {
      const r = await fetch(`${API_BASE}/lodgings`);
      if (!r.ok) throw new Error('Fetch all lodgings failed');
      const all = await r.json();
      if (!Array.isArray(all)) return [];
      const plausibleFields = ['ownerId', 'hostId', 'userId', 'createdBy', 'owner'];
      return all.filter((item: any) =>
        plausibleFields.some(f => {
          const v = item?.[f];
          if (!v) return false;
          if (String(v) === hostId) return true;
          if (typeof v === 'object' && (v.id === hostId || v._id === hostId)) return true;
          return false;
        })
      );
    } catch {
      return [];
    }
  };

  const fetchLodgings = useCallback(async () => {
    try {
      if (isHostView) {
        const hostId = readUserId();
        if (!hostId) {
          setLodgings([]);
          setSearchResults([]);
          return;
        }
        const token = localStorage.getItem(LS.AUTH_TOKEN) || null;
        const list = await fetchHostLodgingsFallback(hostId, token);
        setLodgings(list);
        setSearchResults(list);
      } else {
        const r = await fetch(`${API_BASE}/lodgings`);
        if (!r.ok) throw new Error(`Fetch public lodgings failed: ${r.status}`);
        const data = await r.json();
        const active = Array.isArray(data) ? data.filter(l => l?.isActive ?? true) : [];
        setLodgings(active);
        setSearchResults(active);
      }
    } catch {
      setLodgings([]);
      setSearchResults([]);
    }
  }, [isHostView]);

  useEffect(() => {
    fetchLodgings();
  }, [fetchLodgings, isHostView]);

  const handleSearch: OnSearchFn = async (
    destination,
    checkIn,
    checkOut,
    guests,
    _addr,
    amenities,
    pricePerNight
  ) => {
    try {
      const token = localStorage.getItem(LS.AUTH_TOKEN) || null;

      // Si no hay ningún filtro, restauramos todos los alojamientos
      const noFilters =
        !destination?.trim() &&
        !checkIn &&
        !checkOut &&
        (!guests || guests <= 0) &&
        !amenities?.trim() &&
        (!pricePerNight || pricePerNight <= 0);

      if (noFilters) {
        setSearchResults(lodgings); // reset
        return;
      }

      const params = new URLSearchParams();
      if (checkIn) params.append('checkIn', checkIn);
      if (checkOut) params.append('checkOut', checkOut);
      if (guests) params.append('guests', guests.toString());
      if (destination) params.append('destination', destination);
      if (amenities) params.append('amenities', amenities);
      if (pricePerNight && pricePerNight > 0) params.append('maxPrice', pricePerNight.toString());

      const res = await fetch(`${API_BASE}/bookings/search?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        console.error('Error fetching listings:', res.status, await res.text());
        setSearchResults([]); // vaciar resultados en caso de error
        return;
      }

      const listings = await res.json();
      setSearchResults(listings);
    } catch (error) {
      console.error('Error searching listings:', error);
      setSearchResults([]);
    }
  };


  return (
    <div>
      <Suspense fallback={<NavbarSkeleton />}>
        <Navbar onSearch={handleSearch} />
      </Suspense>
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-semibold mb-6">
          {isHostView ? 'Mis alojamientos' : 'Alojamientos populares'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {searchResults.length > 0 ? (
            searchResults.map(lodging => (
              <ListingCard
                key={lodging.id ?? lodging._id}
                title={lodging.title}
                location={lodging.location?.city}
                pricePerNight={lodging.pricePerNight}
                images={lodging.images}
                id={lodging.id ?? lodging._id}
                ownerId={
                  lodging.ownerId ??
                  lodging.hostId ??
                  lodging.owner?.id ??
                  lodging.owner?._id ??
                  lodging.createdBy ??
                  lodging.userId ??
                  null
                }
                onAction={() => router.push(`/listing/${lodging.id ?? lodging._id}`)}
              />
            ))
          ) : (
            <p className="col-span-full text-center">
              {isHostView ? 'No tienes alojamientos creados todavía.' : 'No se encontraron resultados.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;

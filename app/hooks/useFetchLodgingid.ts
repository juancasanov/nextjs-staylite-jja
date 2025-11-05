'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Lodging = any;

type Options = {
  ownerMode?: boolean; // si true, fuerza a probar endpoints privados antes que el público
};

const LS = {
  AUTH: 'authToken',
  ROLES: 'roles',
  ACTIVE_ROLE: 'activeRole',
} as const;

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || localStorage.getItem(LS.AUTH);
}

function readRoles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS.ROLES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr
      .map((r: any) => String(r ?? '').trim().toLowerCase())
      .filter(Boolean);
  } catch {
    const raw = localStorage.getItem(LS.ROLES);
    return raw ? raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  }
}

export default function useFetchLodging(id?: string, options?: Options) {
  const [lodging, setLodging] = useState<Lodging | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? '',
    []
  );

  const roles = useMemo(() => readRoles(), []);
  const token = useMemo(() => readToken(), []);
  const canOwnerFetch = useMemo(() => {
    const isOwnerRole = roles.includes('host') || roles.includes('admin');
    return Boolean(token) && (isOwnerRole || options?.ownerMode);
  }, [roles, token, options?.ownerMode]);

  const fetchJSON = async (url: string, auth?: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) headers.Authorization = `Bearer ${auth}`;
    const res = await fetch(url, { headers, signal: abortRef.current?.signal, cache: 'no-store' });
    return res;
  };

  const tryEndpoints = async () => {
    if (!id) throw new Error('ID inválido');

    // Orden de prueba
    const candidates: Array<{ url: string; auth?: string | null; label: string }> = [];



    candidates.push({
      url: `${apiBase}/lodgings/${encodeURIComponent(String(id))}`,
      auth: null,
      label: 'public',
    });

    for (const c of candidates) {
      try {
        const res = await fetchJSON(c.url, c.auth ?? null);
        if (res.ok) {
          const data = await res.json();
          return data;
        }
        // Si es un 404/401/403 probamos siguiente; otros códigos reportamos
        if (![401, 403, 404].includes(res.status)) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
      } catch (e) {
        // Si abortado, relanza para cortar
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        // Continuar con el siguiente candidate
      }
    }

    // Si todos fallaron, forzamos error 404
    const err = new Error('No se encontró el alojamiento (o no tienes acceso).');
    (err as any).code = 404;
    throw err;
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setLodging(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const data = await tryEndpoints();

      // Normaliza isActive por si el backend usa otro nombre
      const normalized = {
        ...data,
        isActive: typeof data?.isActive === 'boolean'
          ? data.isActive
          : (typeof data?.active === 'boolean' ? data.active : true),
      };

      setLodging(normalized);
      setLoading(false);
    } catch (e: any) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e?.message || 'Error al cargar alojamiento');
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, apiBase, canOwnerFetch]);

  return { lodging, loading, error, refetch: run };
}

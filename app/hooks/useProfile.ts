// app/hooks/useProfile.ts

import { useState, useEffect, useCallback } from 'react';
import { UseProfileReturn, User } from '../interfaces/user';

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

function getUserId(): string | null {
  try {
    // Estrategia 1: Leer directamente
    const directId = localStorage.getItem('userId');
    if (directId && directId.trim()) {
      console.log('userId encontrado directamente:', directId);
      return directId.trim();
    }

    // Estrategia 2: Leer del userData
    const userDataRaw = localStorage.getItem('userData');
    if (userDataRaw) {
      try {
        const userData = JSON.parse(userDataRaw);
        const possibleIds = [
          userData?.id,
          userData?._id,
          userData?.userId,
          userData?.sub,
        ];
        
        for (const id of possibleIds) {
          if (id && String(id).trim()) {
            const userId = String(id).trim();
            console.log('userId encontrado en userData:', userId);
            // Guardarlo en localStorage para futuras llamadas
            localStorage.setItem('userId', userId);
            return userId;
          }
        }
      } catch (err) {
        console.error('Error parseando userData:', err);
      }
    }

    const token = localStorage.getItem('authToken');
    if (token) {
      const payload = parseJwt(token);
      console.log('🔍 Payload del JWT:', payload);
      
      if (payload) {
        const possibleIds = [
          payload.sub,      
          payload.id,
          payload.userId,
          payload.user_id,
          payload.uid,
        ];

        for (const id of possibleIds) {
          if (id && String(id).trim()) {
            const userId = String(id).trim();
            console.log(' userId extraído del JWT:', userId);
            localStorage.setItem('userId', userId);
            return userId;
          }
        }
      }
    }

    console.error(' No se pudo encontrar userId en ninguna estrategia');
    return null;
  } catch (err) {
    console.error(' Error obteniendo userId:', err);
    return null;
  }
}

export const useProfile = (): UseProfileReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Obtener el userId usando la función auxiliar
      const userId = getUserId();
      
      // 2. Validar que existe el userId
      if (!userId) {
        throw new Error(
          'No se encontró el ID de usuario. Por favor inicia sesión nuevamente. ' +
          'Verifica la consola para más detalles.'
        );
      }

      // 3. Obtener el token de autenticación
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('No se encontró el token de autenticación. Por favor inicia sesión.');
      }

      console.log(' Haciendo fetch del perfil para userId:', userId);
      console.log(' URL completa:', `${API_BASE}/auth/${userId}`);
      console.log(' Token (primeros 50 chars):', token?.substring(0, 50) + '...');

      // 4. Hacer la petición al backend
      const response = await fetch(`${API_BASE}/auth/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log(' Response status:', response.status);
      console.log(' Response ok:', response.ok);

      // 5. Validar que la respuesta sea exitosa
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
        }
        
        if (response.status === 404) {
          throw new Error('Usuario no encontrado.');
        }

        const errorText = await response.text();
        throw new Error(`Error al cargar el perfil: ${response.status} - ${errorText}`);
      }

      // 6. Parsear la respuesta JSON
      const userData: User = await response.json();
      console.log(' Perfil cargado exitosamente:', userData);

      // 7. Guardar los datos en el estado
      setUser(userData);
      
      // 8. Actualizar localStorage con datos frescos
      localStorage.setItem('userData', JSON.stringify(userData));
      localStorage.setItem('userId', userData.id);
      
    } catch (err) {
      console.error('❌ Error fetching user profile:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error desconocido al cargar el perfil');
      }
      
      // Si hay error de autenticación, limpiar localStorage
      if (err instanceof Error && err.message.includes('Sesión expirada')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userData');
      }
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const refetch = async () => {
    await fetchUserProfile();
  };

  return {
    user,
    loading,
    error,
    refetch,
  };
};
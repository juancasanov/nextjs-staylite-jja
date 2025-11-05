// app/hooks/useProfileData.ts

import { useState, useEffect, useCallback } from 'react';
import { Lodging } from '../interfaces/lodging';
import { Booking } from '../interfaces/user';

/**
 * Custom hook para cargar alojamientos y reservas del usuario
 * 
 * @param userId - ID del usuario
 * @param userRoles - Array de roles del usuario
 * @returns lodgings, bookings, loading, error
 */
export const useProfileData = (userId: string | null, userRoles: string[] = []) => {
  const [lodgings, setLodgings] = useState<Lodging[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingLodgings, setLoadingLodgings] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  /**
   * Función para obtener los alojamientos del host
   */
  const fetchLodgings = useCallback(async () => {
    if (!userId || !userRoles.includes('host')) {
      setLodgings([]);
      return;
    }

    setLoadingLodgings(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      
      // Intentar diferentes endpoints posibles
      const endpoints = [
        `${API_BASE}/lodgings/${userId}/my-lodgings`,
        `${API_BASE}/users/${userId}/lodgings`,
        `${API_BASE}/lodgings?ownerId=${userId}`,
        `${API_BASE}/lodgings?hostId=${userId}`,
      ];

      let lodgingsData: Lodging[] = [];

      for (const endpoint of endpoints) {
        try {
          console.log('Intentando fetch lodgings desde:', endpoint);
          
          const response = await fetch(endpoint, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (response.ok) {
            const data = await response.json();
            
            // Verificar si la respuesta es un array
            if (Array.isArray(data)) {
              lodgingsData = data;
              console.log('Lodgings cargados desde:', endpoint, '→', data.length, 'alojamientos');
              break;
            }
          }
        } catch (err) {
          console.log(' Endpoint falló:', endpoint);
          continue;
        }
      }

      // Si ningún endpoint funcionó, intentar filtrar de todos los lodgings
      if (lodgingsData.length === 0) {
        console.log(' Intentando filtrar de /lodgings...');
        try {
          const response = await fetch(`${API_BASE}/lodgings`);
          if (response.ok) {
            const allLodgings = await response.json();
            if (Array.isArray(allLodgings)) {
              // Filtrar por ownerId, hostId, etc.
              lodgingsData = allLodgings.filter((lodging: any) => {
                const possibleOwnerFields = [
                  lodging.ownerId,
                  lodging.hostId,
                  lodging.userId,
                  lodging.owner?.id,
                  lodging.host?.id,
                ];
                return possibleOwnerFields.some(field => field === userId);
              });
              console.log('Filtrados', lodgingsData.length, 'alojamientos propios');
            }
          }
        } catch (err) {
          console.error(' Error filtrando lodgings:', err);
        }
      }

      setLodgings(lodgingsData);
    } catch (err) {
      console.error(' Error fetching lodgings:', err);
      setError('Error al cargar los alojamientos');
    } finally {
      setLoadingLodgings(false);
    }
  }, [userId, userRoles, API_BASE]);

  /**
   * Función para obtener las reservas del guest
   */
  const fetchBookings = useCallback(async () => {
    if (!userId || !userRoles.includes('guest')) {
      setBookings([]);
      return;
    }

    setLoadingBookings(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      
      // Intentar diferentes endpoints posibles
      const endpoints = [
        `${API_BASE}/users/${userId}/bookings`,
        `${API_BASE}/bookings?userId=${userId}`,
        `${API_BASE}/bookings/user/${userId}`,
      ];

      let bookingsData: Booking[] = [];

      for (const endpoint of endpoints) {
        try {
          console.log('Intentando fetch bookings desde:', endpoint);
          
          const response = await fetch(endpoint, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (response.ok) {
            const data = await response.json();
            
            if (Array.isArray(data)) {
              bookingsData = data;
              console.log(' Bookings cargados desde:', endpoint, '→', data.length, 'reservas');
              break;
            }
          }
        } catch (err) {
          console.log(' Endpoint falló:', endpoint);
          continue;
        }
      }

      // Si ningún endpoint funcionó, intentar filtrar de todas las reservas
      if (bookingsData.length === 0) {
        console.log(' Intentando filtrar de /bookings...');
        try {
          const response = await fetch(`${API_BASE}/bookings`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (response.ok) {
            const allBookings = await response.json();
            if (Array.isArray(allBookings)) {
              bookingsData = allBookings.filter((booking: any) => 
                booking.userId === userId || booking.user?.id === userId
              );
              console.log(' Filtradas', bookingsData.length, 'reservas propias');
            }
          }
        } catch (err) {
          console.error(' Error filtrando bookings:', err);
        }
      }

      setBookings(bookingsData);
    } catch (err) {
      console.error(' Error fetching bookings:', err);
      setError('Error al cargar las reservas');
    } finally {
      setLoadingBookings(false);
    }
  }, [userId, userRoles, API_BASE]);

  /**
   * Cargar datos cuando cambia el userId o roles
   */
  useEffect(() => {
    if (userId) {
      if (userRoles.includes('host')) {
        fetchLodgings();
      }
      if (userRoles.includes('guest')) {
        fetchBookings();
      }
    }
  }, [userId, userRoles, fetchLodgings, fetchBookings]);

  return {
    lodgings,
    bookings,
    loading: loadingLodgings || loadingBookings,
    loadingLodgings,
    loadingBookings,
    error,
    refetchLodgings: fetchLodgings,
    refetchBookings: fetchBookings,
  };
};
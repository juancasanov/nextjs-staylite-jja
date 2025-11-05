// app/hooks/useOccupiedDates.ts

import { useState, useEffect } from 'react';

interface DateRange {
  checkIn: string;
  checkOut: string;
}

interface UseOccupiedDatesReturn {
  occupiedDates: DateRange[];
  loading: boolean;
  isDateRangeAvailable: (checkIn: string, checkOut: string) => boolean;
}

/**
 * Hook para obtener las fechas ocupadas de un alojamiento
 * 
 * @param lodgingId - ID del alojamiento
 * @returns fechas ocupadas y función para validar disponibilidad
 */
export const useOccupiedDates = (lodgingId: string | null): UseOccupiedDatesReturn => {
  const [occupiedDates, setOccupiedDates] = useState<DateRange[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  useEffect(() => {
    const fetchOccupiedDates = async () => {
      if (!lodgingId) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('authToken');

        console.log(' Obteniendo fechas ocupadas para lodging:', lodgingId);

        const endpoints = [
          `${API_BASE}/lodgings/${lodgingId}/bookings`,
          `${API_BASE}/bookings?lodgingId=${lodgingId}`,
          `${API_BASE}/bookings`,
        ];

        let allBookings: any[] = [];

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data)) {
                allBookings = data;
                console.log(' Bookings obtenidos desde:', endpoint);
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }

        const lodgingBookings = allBookings.filter((booking: any) => {
          const bookingLodgingId = booking.lodgingId || booking.lodging?.id;
          return bookingLodgingId === lodgingId && booking.status === 'confirmed';
        });

        // Extraer rangos de fechas
        const occupied = lodgingBookings.map((booking: any) => ({
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
        }));

        console.log(' Fechas ocupadas:', occupied);
        setOccupiedDates(occupied);
      } catch (err) {
        console.error('Error fetching occupied dates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOccupiedDates();
  }, [lodgingId, API_BASE]);

  const isDateRangeAvailable = (checkIn: string, checkOut: string): boolean => {
    const requestedStart = new Date(checkIn);
    const requestedEnd = new Date(checkOut);

    for (const occupied of occupiedDates) {
      const occupiedStart = new Date(occupied.checkIn);
      const occupiedEnd = new Date(occupied.checkOut);

      // Verificar si hay solapamiento
      const overlaps =
        (requestedStart >= occupiedStart && requestedStart < occupiedEnd) ||
        (requestedEnd > occupiedStart && requestedEnd <= occupiedEnd) ||
        (requestedStart <= occupiedStart && requestedEnd >= occupiedEnd);

      if (overlaps) {
        console.log('Fechas no disponibles - solapamiento detectado');
        return false;
      }
    }

    console.log(' Fechas disponibles');
    return true;
  };

  return {
    occupiedDates,
    loading,
    isDateRangeAvailable,
  };
};
// app/hooks/useUserBooking.ts

import { useState, useEffect } from 'react';

interface UserBooking {
  id: string;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  lodgingId: string;
}

interface UseUserBookingReturn {
  userBooking: UserBooking | null;
  loading: boolean;
  error: string | null;
  hasBooking: boolean;
}

/**
 * Hook para verificar si el usuario tiene una reserva para un alojamiento específico
 * 
 * @param lodgingId - ID del alojamiento
 * @returns información de la reserva del usuario
 */
export const useUserBooking = (lodgingId: string | null): UseUserBookingReturn => {
  const [userBooking, setUserBooking] = useState<UserBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  useEffect(() => {
    const fetchUserBooking = async () => {
      if (!lodgingId) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
          setLoading(false);
          return;
        }

        console.log('🔍 Verificando si el usuario tiene reserva para lodging:', lodgingId);

        // Intentar obtener las reservas del usuario
        const endpoints = [
          `${API_BASE}/users/${userId}/bookings`,
          `${API_BASE}/bookings?userId=${userId}`,
          `${API_BASE}/bookings`,
        ];

        let allBookings: any[] = [];

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              headers: { Authorization: `Bearer ${token}` },
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

        // Filtrar reservas del usuario para este alojamiento
        const userLodgingBooking = allBookings.find((booking: any) => {
          const bookingLodgingId = booking.lodgingId || booking.lodging?.id;
          const bookingUserId = booking.userId || booking.user?.id;
          
          return (
            bookingLodgingId === lodgingId &&
            bookingUserId === userId &&
            booking.status !== 'cancelled' // Ignorar reservas canceladas
          );
        });

        if (userLodgingBooking) {
          console.log('Usuario ya tiene una reserva:', userLodgingBooking);
          setUserBooking({
            id: userLodgingBooking.id,
            checkIn: userLodgingBooking.checkIn,
            checkOut: userLodgingBooking.checkOut,
            status: userLodgingBooking.status,
            lodgingId: lodgingId,
          });
        } else {
          console.log('ℹ️ Usuario no tiene reserva para este alojamiento');
          setUserBooking(null);
        }
      } catch (err) {
        console.error(' Error fetching user booking:', err);
        setError('Error al verificar reservas');
      } finally {
        setLoading(false);
      }
    };

    fetchUserBooking();
  }, [lodgingId, API_BASE]);

  return {
    userBooking,
    loading,
    error,
    hasBooking: userBooking !== null,
  };
};
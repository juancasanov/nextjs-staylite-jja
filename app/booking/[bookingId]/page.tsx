'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';

interface BookingDetail {
  id: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  lodging: {
    id: string;
    title: string;
    description?: string;
    pricePerNight: number;
    images?: string[];
    location?: {
      city?: string;
      country?: string;
      address?: string;
    };
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
    ? process.env.NEXT_PUBLIC_API_URL
    : '';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_BASE}/bookings/${bookingId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          throw new Error('No se pudo cargar la reserva');
        }

        const data = await response.json();
        setBooking(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar la reserva');
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  const handleDeleteBooking = async () => {
    setDeleting(true);
    
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('No estás autenticado. Por favor inicia sesión.');
      }

      console.log('Eliminando booking:', bookingId);

      const response = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('No tienes permiso para eliminar esta reserva.');
        }
        if (response.status === 404) {
          throw new Error('La reserva no existe.');
        }
        throw new Error('Error al eliminar la reserva.');
      }

      console.log('Reserva eliminada exitosamente');
      router.push('/profile');

    } catch (err: any) {
      console.error('Error eliminando booking:', err);
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '⏳ Pendiente de pago' },
      confirmed: { bg: 'bg-green-100', text: 'text-green-700', label: '✓ Confirmada' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: '✗ Cancelada' },
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-[#155dfc] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Cargando reserva...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white shadow-lg rounded-2xl p-8 max-w-lg border border-red-200">
          <h3 className="text-lg font-semibold text-red-700 mb-2">Error</h3>
          <p className="text-gray-600">{error || 'Reserva no encontrada'}</p>
          <button
            onClick={() => router.push('/profile')}
            className="mt-4 px-6 py-2 bg-[#155dfc] text-white font-semibold rounded-xl hover:bg-blue-600 transition"
          >
            Volver al perfil
          </button>
        </div>
      </div>
    );
  }

  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const totalPrice = nights * booking.lodging.pricePerNight;
  const statusBadge = getStatusBadge(booking.status);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              ← Volver
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Detalle de la Reserva</h1>
          </div>

          {/* Botón de eliminar */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar reserva
          </button>
        </div>

        {/* Estado de la reserva */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">ID de reserva</p>
              <p className="font-mono text-sm text-gray-700">{booking.id}</p>
            </div>
            <span className={`px-4 py-2 rounded-full font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.label}
            </span>
          </div>

          {booking.status === 'pending' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ Esta reserva está pendiente de pago. Completa el pago para confirmarla.
              </p>
              <button
                onClick={() => router.push(`/payment?bookingId=${booking.id}`)}
                className="mt-3 px-4 py-2 bg-[#155dfc] text-white font-semibold rounded-lg hover:bg-blue-600 transition"
              >
                Ir a pagar
              </button>
            </div>
          )}
        </div>

        {/* Información del alojamiento */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Alojamiento</h2>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Imagen */}
            <div className="relative w-full md:w-64 h-48 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              {booking.lodging.images && booking.lodging.images.length > 0 ? (
                <Image
                  src={booking.lodging.images[0]}
                  alt={booking.lodging.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 mb-2">{booking.lodging.title}</h3>
              <p className="text-gray-600 mb-2">
                📍 {booking.lodging.location?.city}, {booking.lodging.location?.country}
              </p>
              {booking.lodging.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{booking.lodging.description}</p>
              )}
              <button
                onClick={() => router.push(`/listing/${booking.lodging.id}`)}
                className="mt-3 text-[#155dfc] hover:text-blue-600 font-semibold text-sm"
              >
                Ver alojamiento →
              </button>
            </div>
          </div>
        </div>

        {/* Detalles de la estadía */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Detalles de la Estadía</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Check-in</p>
              <p className="font-semibold text-gray-800">{formatDate(booking.checkIn)}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 mb-1">Check-out</p>
              <p className="font-semibold text-gray-800">{formatDate(booking.checkOut)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Duración</p>
              <p className="font-semibold text-gray-800">{nights} {nights === 1 ? 'noche' : 'noches'}</p>
            </div>

            {booking.guests && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Huéspedes</p>
                <p className="font-semibold text-gray-800">{booking.guests} {booking.guests === 1 ? 'persona' : 'personas'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Resumen de precio */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen de Precio</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>${booking.lodging.pricePerNight.toLocaleString()} x {nights} {nights === 1 ? 'noche' : 'noches'}</span>
              <span>${totalPrice.toLocaleString()}</span>
            </div>
            
            <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-[#155dfc]">${totalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Información de reserva */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Información de la Reserva</h2>
          
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-semibold">Fecha de reserva:</span> {formatDate(booking.createdAt)}</p>
            {booking.user && (
              <>
                <p><span className="font-semibold">Huésped:</span> {booking.user.name}</p>
                <p><span className="font-semibold">Email:</span> {booking.user.email}</p>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
              ¿Eliminar reserva?
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Esta acción no se puede deshacer. La reserva será eliminada permanentemente.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteBooking}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Lodging } from '../interfaces/lodging';
import { Booking, LodgingStats } from '../interfaces/user';

interface UseLodgingStatsOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export const useLodgingStats = (
    lodgingId: string | null,
    options: UseLodgingStatsOptions = {}
) => {
    const { autoRefresh = false, refreshInterval = 30000 } = options;

    const [lodging, setLodging] = useState<Lodging | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [stats, setStats] = useState<LodgingStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const API_BASE =
        process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
            ? process.env.NEXT_PUBLIC_API_URL
            : '';

    const createHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }, []);

    const calculateStats = useCallback((bookingsData: Booking[], lodgingData: Lodging): LodgingStats => {
        const totalBookings = bookingsData.length;
        const pendingBookings = bookingsData.filter(b => b.status === 'pending').length;
        const confirmedBookings = bookingsData.filter(b => b.status === 'confirmed').length;
        const cancelledBookings = bookingsData.filter(b => b.status === 'cancelled').length;

        // Calcular ingresos totales (solo confirmadas)
        const totalRevenue = bookingsData
            .filter(b => b.status === 'confirmed')
            .reduce((sum, booking) => {
                const checkIn = new Date(booking.checkIn);
                const checkOut = new Date(booking.checkOut);
                const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                return sum + (nights * lodgingData.pricePerNight);
            }, 0);

        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const recentConfirmed = bookingsData.filter(b => {
            const checkIn = new Date(b.checkIn);
            return b.status === 'confirmed' && checkIn >= thirtyDaysAgo;
        });

        let occupiedDays = 0;
        recentConfirmed.forEach(booking => {
            const checkIn = new Date(booking.checkIn);
            const checkOut = new Date(booking.checkOut);
            const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
            occupiedDays += nights;
        });

        const occupancyRate = Math.min(100, Math.round((occupiedDays / 30) * 100));

        const recentBookings = [...bookingsData]
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 10);

        return {
            totalBookings,
            pendingBookings,
            confirmedBookings,
            cancelledBookings,
            totalRevenue,
            occupancyRate,
            recentBookings,
        };
    }, []);

    const fetchLodgingStats = useCallback(async (showLoading = true) => {
        if (!lodgingId) {
            setError('ID de alojamiento no válido');
            setLoading(false);
            return;
        }

        if (showLoading) {
            setLoading(true);
        }
        setError(null);

        try {
            const timestamp = new Date().getTime();
            const headers = createHeaders();

            console.log('🏠 Obteniendo datos del alojamiento:', lodgingId);

            const lodgingResponse = await fetch(
                `${API_BASE}/lodgings/${lodgingId}?_t=${timestamp}`,
                {
                    method: 'GET',
                    headers
                }
            );

            if (!lodgingResponse.ok) {
                throw new Error('No se pudo cargar el alojamiento');
            }

            const lodgingData: Lodging = await lodgingResponse.json();
            setLodging(lodgingData);
            console.log('✅ Alojamiento cargado:', lodgingData);

            console.log('📅 Obteniendo reservas del alojamiento...');

            const bookingEndpoints = [
                `${API_BASE}/bookings/lodging/${lodgingId}?_t=${timestamp}`, 
                `${API_BASE}/lodgings/${lodgingId}/bookings?_t=${timestamp}`,
            ];

            let bookingsData: Booking[] = [];

            // Intentar cada endpoint
            for (const endpoint of bookingEndpoints) {
                try {
                    console.log('🔍 Intentando:', endpoint);

                    const response = await fetch(endpoint, {
                        method: 'GET',
                        headers
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (Array.isArray(data)) {
                            bookingsData = data;
                            console.log(' Reservas cargadas desde:', endpoint, '→', data.length, 'reservas');
                            break;
                        }
                    }
                } catch (err) {
                    console.log('Endpoint falló:', endpoint, err);
                    continue;
                }
            }

            // Fallback: filtrar de todas las reservas
            if (bookingsData.length === 0) {
                console.log('Intentando obtener todas las reservas y filtrar...');
                try {
                    const response = await fetch(
                        `${API_BASE}/bookings?_t=${timestamp}`,
                        {
                            method: 'GET',
                            headers
                        }
                    );

                    if (response.ok) {
                        const allBookings = await response.json();
                        if (Array.isArray(allBookings)) {
                            bookingsData = allBookings.filter((booking: any) =>
                                booking.lodgingId === lodgingId ||
                                booking.lodging?.id === lodgingId
                            );
                            console.log('Filtradas', bookingsData.length, 'reservas del alojamiento');
                        }
                    }
                } catch (err) {
                    console.error('Error filtrando reservas:', err);
                }
            }

            setBookings(bookingsData);

            // 3. Calcular estadísticas
            const calculatedStats = calculateStats(bookingsData, lodgingData);
            setStats(calculatedStats);
            setLastUpdate(new Date());
            console.log('Estadísticas calculadas:', calculatedStats);

        } catch (err) {
            console.error('Error fetching lodging stats:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Error al cargar las estadísticas');
            }
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [lodgingId, API_BASE, calculateStats, createHeaders]);

    // Cargar datos inicialmente
    useEffect(() => {
        fetchLodgingStats(true);
    }, [fetchLodgingStats]);

    // Auto-refresh si está habilitado
    useEffect(() => {
        if (!autoRefresh || !lodgingId) return;

        console.log(` Auto-refresh habilitado cada ${refreshInterval / 1000}s`);

        const intervalId = setInterval(() => {
            console.log('Refrescando estadísticas automáticamente...');
            fetchLodgingStats(false);
        }, refreshInterval);

        return () => {
            console.log('Deteniendo auto-refresh');
            clearInterval(intervalId);
        };
    }, [autoRefresh, refreshInterval, lodgingId, fetchLodgingStats]);

    /**
     * Función pública para refrescar manualmente
     */
    const refetch = useCallback(() => {
        console.log('Refrescando manualmente...');
        return fetchLodgingStats(true);
    }, [fetchLodgingStats]);

    return {
        lodging,
        bookings,
        stats,
        loading,
        error,
        lastUpdate,
        refetch,
    };
};
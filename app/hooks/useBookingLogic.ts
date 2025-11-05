import { useEffect, useState, useCallback } from 'react'; 
import { format, addDays } from 'date-fns';
import type { DateRange as RDPDateRange } from 'react-day-picker';

type UseBookingLogicParams = {
  listingId?: string | string[];
  propPrice?: number;
  increaseFromDay?: number;
  onClose: () => void;
  onBooked?: (bookingId: string) => void;
};

export function useBookingLogic({
  listingId,
  propPrice,
  increaseFromDay = 1,
  onClose,
  onBooked,
}: UseBookingLogicParams) {
  const resolvedListingId = Array.isArray(listingId) ? listingId[0] : listingId;

  const API_BASE =
    (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== '')
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  const [range, setRange] = useState<RDPDateRange | undefined>(undefined);
  const [guests, setGuests] = useState(1);

  const [pricePerNight, setPricePerNight] = useState<number | null>(propPrice ?? null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const [totalPrice, setTotalPrice] = useState(0);
  const [nightsWithIncrease, setNightsWithIncrease] = useState(0);
  const [error, setError] = useState('');
  const [navigating, setNavigating] = useState(false);

  const [disabledRanges, setDisabledRanges] = useState<{ from: Date; to: Date }[]>([]);

  const computeTotalWithIncreases = useCallback(
    (from?: Date, to?: Date, price?: number | null, rawIncreaseFromDay?: number | string) => {
      if (!from || !to || price == null) return { total: 0, nightsWithIncrease: 0, nights: 0 };

      const increaseFromDayNum = Number(rawIncreaseFromDay ?? NaN);
      const useDayOfMonth = !Number.isNaN(increaseFromDayNum);

      let total = 0;
      let nightsInc = 0;

      let current = new Date(from);
      current.setHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setHours(0, 0, 0, 0);

      let nights = 0;
      while (current < end) {
        nights += 1;

        const dayOfMonth = current.getDate();
        const applies = useDayOfMonth ? (dayOfMonth > increaseFromDayNum) : false;

        const nightlyPrice = applies ? price * 2 : price;
        total += nightlyPrice;
        if (applies) nightsInc += 1;

        current = addDays(current, 1);
      }

      return { total: Math.round(total), nightsWithIncrease: nightsInc, nights };
    },
    []
  );

  // FETCH: precio del alojamiento
  useEffect(() => {
    if (propPrice != null) {
      setPricePerNight(propPrice);
      if (range?.from && range?.to) {
        const { total, nightsWithIncrease } = computeTotalWithIncreases(range.from, range.to, propPrice);
        setTotalPrice(total);
        setNightsWithIncrease(nightsWithIncrease);
      }
      return;
    }

    if (!resolvedListingId) {
      setPricePerNight(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchListing = async () => {
      try {
        setLoadingPrice(true);
        setError('');
        const res = await fetch(`${API_BASE}/api/lodgings/${encodeURIComponent(resolvedListingId)}`, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = `Error al cargar el precio (status ${res.status})`;
          try {
            const d = await res.json();
            if (d?.message) msg = d.message;
          } catch {}
          throw new Error(msg);
        }

        const data = await res.json();
        const price =
          typeof data.pricePerNight === 'number'
            ? data.pricePerNight
            : (typeof data.price === 'number' ? data.price : null);

        if (!cancelled) {
          if (price == null) {
            setError('No se encontró el precio del alojamiento.');
            setPricePerNight(null);
          } else {
            setPricePerNight(price);
            if (range?.from && range?.to) {
              const { total, nightsWithIncrease } = computeTotalWithIncreases(range.from, range.to, price);
              setTotalPrice(total);
              setNightsWithIncrease(nightsWithIncrease);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name !== 'AbortError') {
            console.error('Error fetching listing price:', err);
            setError(err.message || 'No se pudo cargar el precio del alojamiento.');
            setPricePerNight(null);
          }
        }
      } finally {
        if (!cancelled) setLoadingPrice(false);
      }
    };

    fetchListing();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [API_BASE, resolvedListingId, propPrice, range, computeTotalWithIncreases]);

  useEffect(() => {
    if (!resolvedListingId) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchBookings = async () => {
      try {
        const res = await fetch(`${API_BASE}/bookings/lodging/${encodeURIComponent(resolvedListingId)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Error fetching bookings: ${res.status}`);
        const data = await res.json();

        if (!cancelled && Array.isArray(data)) {
          const ranges = data.map((booking: any) => ({
            from: new Date(booking.checkIn),
            to: new Date(booking.checkOut),
          }));
          setDisabledRanges(ranges);
        }
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    };

    fetchBookings();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [API_BASE, resolvedListingId]);

  const onRangeSelect = (selected: RDPDateRange | undefined) => {
    setRange(selected);
    setError('');
    if (selected && selected.from && selected.to && pricePerNight != null) {
      const { total, nightsWithIncrease } = computeTotalWithIncreases(selected.from, selected.to, pricePerNight);
      setTotalPrice(total);
      setNightsWithIncrease(nightsWithIncrease);
    } else {
      setTotalPrice(0);
      setNightsWithIncrease(0);
    }
  };

  const handleGoToPayment = async (router: { push: (p: string) => Promise<void> }) => {
    if (navigating) return;
    setError('');

    if (!resolvedListingId) {
      setError('No se pudo identificar el alojamiento.');
      return;
    }
    if (!range || !range.from || !range.to) {
      setError('Selecciona fecha de entrada y salida.');
      return;
    }
    if (pricePerNight == null) {
      setError('Aún no se ha cargado el precio del alojamiento.');
      return;
    }
    if (totalPrice <= 0) {
      setError('Selecciona un rango válido para calcular el precio.');
      return;
    }

    setNavigating(true);

    const pending = {
      lodgingId: resolvedListingId,
      checkIn: format(range.from, 'yyyy-MM-dd'),
      checkOut: format(range.to, 'yyyy-MM-dd'),
      guests,
      pricePerNight,
      totalPrice,
      nightsWithIncrease,
      createdAt: new Date().toISOString(),
    };

    const payloadServer = {
      lodgingId: resolvedListingId,
      checkIn: pending.checkIn,
      checkOut: pending.checkOut,
    };

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

      if (!token) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('pendingBooking', JSON.stringify(pending));
          }
        } catch (e) {
          console.warn('No se pudo guardar pendingBooking en localStorage', e);
        }
        localStorage.setItem('postLoginRedirect', `/payment`);
        localStorage.setItem('signupRole', 'guest');
        onClose();
        await router.push(`/?authOpen=1&tab=signup`);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadServer),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMsg = `Error al crear la reserva (status ${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
        } catch {}
        setError(errMsg);
        return;
      }

      const data = await res.json();
      const bookingId = data?.id;
      if (!bookingId) {
        setError('Respuesta inesperada del servidor al crear la reserva.');
        return;
      }

      try {
        if (typeof window !== 'undefined') {
          const pendingPayment = { bookingId, ...pending };
          localStorage.setItem('pendingPayment', JSON.stringify(pendingPayment));
        }
      } catch (e) {
        console.warn('No se pudo guardar pendingPayment en localStorage', e);
      }

      onClose();
      if (onBooked) onBooked(bookingId);

    } catch (err: any) {
      console.error('Error al crear booking / ir a pago:', err);
      if (err?.name === 'AbortError') {
        setError('La solicitud tardó demasiado. Intenta nuevamente.');
      } else {
        setError('Ocurrió un error al preparar el pago. Intenta de nuevo.');
      }
    } finally {
      setNavigating(false);
    }
  };

  const checkInStr = range?.from ? format(range.from, 'yyyy-MM-dd') : '';
  const checkOutStr = range?.to ? format(range.to, 'yyyy-MM-dd') : '';

  return {
    range,
    guests,
    pricePerNight,
    loadingPrice,
    totalPrice,
    nightsWithIncrease,
    error,
    navigating,
    checkInStr,
    checkOutStr,
    disabledRanges, 

    setGuests,
    setRange: onRangeSelect,
    computeTotalWithIncreases,
    handleGoToPayment,
    setError,
    setPricePerNight,
  };
}

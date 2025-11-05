import { useEffect, useMemo, useState } from 'react';

type BookingLocal = {
  bookingId?: string;
  lodgingId?: string;
  title?: string;
  checkIn?: string;
  checkOut?: string;
  pricePerNight?: number;
  guests?: number;
  totalPrice?: number;
  nightsWithIncrease?: number;
  createdAt?: string;
};

type BookingApi = {
  id: string;
  checkIn: string;
  checkOut: string;
  lodging: { id: string; title: string; pricePerNight?: number };
  user?: any;
};

type PayResponse = {
  orderId: string;
  payuOrderId?: string;
  payuPaymentUrl?: string;
  transactionId?: string;
};

type Currency = 'COP' | 'USD';
type PaymentMethod =
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PSE'
  | 'CASH'
  | 'NEQUI'
  | 'BANCOLOMBIA'
  | 'GOOGLE_PAY';

const PAYMENT_METHODS: PaymentMethod[] = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PSE',
  'CASH',
  'NEQUI',
  'BANCOLOMBIA',
  'GOOGLE_PAY',
];

export default function usePaymentLogic(bookingIdFromQuery?: string, apiBaseIn?: string) {
  const API_BASE =
    (typeof process !== 'undefined' && (apiBaseIn ?? (process.env.NEXT_PUBLIC_API_BASE_URL || '')).trim())
    || '';

  const [localBooking, setLocalBooking] = useState<BookingLocal | null>(null);
  const [bookingApi, setBookingApi] = useState<BookingApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRes, setPaymentRes] = useState<PayResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [currency, setCurrency] = useState<Currency>('COP');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PSE');

  const parseISO = (s?: string) => (s ? new Date(s) : null);
  const diffDays = (a?: string, b?: string) => {
    const d1 = parseISO(a);
    const d2 = parseISO(b);
    if (!d1 || !d2) return 0;
    const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((t2 - t1) / msPerDay);
    return Math.max(diff, 0);
  };

  // calcular amount
  const amount = useMemo(() => {
    if (typeof localBooking?.totalPrice === 'number' && localBooking.totalPrice > 0) {
      return localBooking.totalPrice;
    }
    const pricePerNight =
      typeof localBooking?.pricePerNight === 'number'
        ? localBooking.pricePerNight
        : (typeof bookingApi?.lodging?.pricePerNight === 'number'
          ? bookingApi!.lodging.pricePerNight!
          : 0);

    const nights = localBooking?.nightsWithIncrease && localBooking.nightsWithIncrease > 0
      ? localBooking.nightsWithIncrease
      : diffDays(
        localBooking?.checkIn ?? bookingApi?.checkIn,
        localBooking?.checkOut ?? bookingApi?.checkOut
      );

    const a = Number(pricePerNight) * Number(nights || 0);
    return isFinite(a) ? a : 0;
  }, [localBooking, bookingApi]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const c = (localStorage.getItem('currency') || '').toUpperCase();
      if (c === 'COP' || c === 'USD') setCurrency(c as Currency);

      const pm = (localStorage.getItem('paymentMethod') || '').toUpperCase() as PaymentMethod;
      if (PAYMENT_METHODS.includes(pm)) setPaymentMethod(pm);
    }

    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('pendingPayment') ?? localStorage.getItem('pendingBooking');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (!bookingIdFromQuery || String(parsed.bookingId) === String(bookingIdFromQuery))) {
            setLocalBooking(parsed);
            setShowModal(true);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo leer pendingPayment/localStorage:', e);
    }

    if (!bookingIdFromQuery) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/bookings/${encodeURIComponent(bookingIdFromQuery)}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Booking no encontrado (status ${r.status})`);
        return r.json();
      })
      .then((data: BookingApi) => {
        setBookingApi(data);
        setShowModal(true);
      })
      .catch((e) => setError(e?.message || 'Error al cargar booking'))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [API_BASE, bookingIdFromQuery]);

  const effective = useMemo(() => {
    return {
      title: localBooking?.title ?? bookingApi?.lodging?.title ?? 'Alojamiento',
      checkIn: localBooking?.checkIn ?? bookingApi?.checkIn,
      checkOut: localBooking?.checkOut ?? bookingApi?.checkOut,
      pricePerNight:
        localBooking?.pricePerNight ?? bookingApi?.lodging?.pricePerNight ?? null,
      guests: localBooking?.guests ?? 1,
      totalPrice: localBooking?.totalPrice ?? null,
      bookingId: localBooking?.bookingId ?? bookingApi?.id ?? bookingIdFromQuery,
    };
  }, [localBooking, bookingApi, bookingIdFromQuery]);

  const handleCreatePayment = async (): Promise<PayResponse | null> => {
    if (!effective.bookingId) {
      setError('Falta bookingId para crear la orden.');
      return null;
    }
    if (creating) return null;

    setCreating(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

      if (!amount || amount <= 0) {
        throw new Error('El monto (amount) calculado debe ser mayor que 0.');
      }

      const body = { bookingId: String(effective.bookingId), amount, currency, paymentMethod };

      const res = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let message = `Error ${res.status}`;
        try {
          const err = await res.json();
          if (err?.message) message = Array.isArray(err.message) ? err.message.join(', ') : err.message;
        } catch { }
        throw new Error(message);
      }

      const data: PayResponse = await res.json();
      setPaymentRes(data);

      if (data.payuPaymentUrl) {
        const w = window.open('', '_blank', 'noopener,noreferrer');
        if (w) w.location.href = data.payuPaymentUrl;
      }

      return data; // 🔹 Devuelve el PayResponse
    } catch (e: any) {
      console.error('Error crear payment:', e);
      setError(e?.message || 'Error al crear pago');
      return null;
    } finally {
      setCreating(false);
    }
  };


  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currency', currency);
      localStorage.setItem('paymentMethod', paymentMethod);
    }
  }, [currency, paymentMethod]);

  return {
    localBooking,
    setLocalBooking,
    bookingApi,
    loading,
    creating,
    error,
    paymentRes,
    showModal,
    setShowModal,

    currency,
    setCurrency,
    paymentMethod,
    setPaymentMethod,

    amount,
    effective,

    handleCreatePayment,
  } as const;
}

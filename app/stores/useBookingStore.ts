import {create} from 'zustand';
import { format, addDays } from 'date-fns';

type Store = {
  range: { from: Date; to: Date } | undefined;
  guests: number;
  pricePerNight: number | null;
  loadingPrice: boolean;
  totalPrice: number;
  nightsWithIncrease: number;
  error: string;
  navigating: boolean;
  disabledRanges: { from: Date; to: Date }[];
  setRange: (range: { from: Date; to: Date } | undefined) => void;
  setGuests: (guests: number) => void;
  setPricePerNight: (price: number | null) => void;
  setLoadingPrice: (loading: boolean) => void;
  setTotalPrice: (total: number) => void;
  setNightsWithIncrease: (nights: number) => void;
  setError: (error: string) => void;
  setNavigating: (navigating: boolean) => void;
  setDisabledRanges: (ranges: { from: Date; to: Date }[]) => void;
  computeTotalWithIncreases: (
    from: Date | undefined,
    to: Date | undefined,
    price: number | null,
    increaseFromDay?: number | string
  ) => { total: number; nightsWithIncrease: number; nights: number };
  fetchListingPrice: (listingId: string) => Promise<void>;
  fetchBookings: (listingId: string) => Promise<void>;
  isDateRangeAvailable: (checkIn: string, checkOut: string) => boolean;
};

export const useBookingStore = create<Store>((set) => ({
  range: undefined,
  guests: 1,
  pricePerNight: null,
  loadingPrice: false,
  totalPrice: 0,
  nightsWithIncrease: 0,
  error: '',
  navigating: false,
  disabledRanges: [],

  setRange: (range) => set({ range }),
  setGuests: (guests) => set({ guests }),
  setPricePerNight: (price) => set({ pricePerNight: price }),
  setLoadingPrice: (loading) => set({ loadingPrice: loading }),
  setTotalPrice: (total) => set({ totalPrice: total }),
  setNightsWithIncrease: (nights) => set({ nightsWithIncrease: nights }),
  setError: (error) => set({ error }),
  setNavigating: (navigating) => set({ navigating }),
  setDisabledRanges: (ranges) => set({ disabledRanges: ranges }),

  // Método para calcular el total con los aumentos
  computeTotalWithIncreases: (from, to, price, increaseFromDay = 1) => {
    if (!from || !to || price == null) return { total: 0, nightsWithIncrease: 0, nights: 0 };

    const increaseFromDayNum = Number(increaseFromDay);
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

  // Fetch para el precio del alojamiento
  fetchListingPrice: async (listingId) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
    set({ loadingPrice: true, error: '' });

    try {
      const res = await fetch(`${API_BASE}/api/lodgings/${encodeURIComponent(listingId)}`, { method: 'GET' });

      if (!res.ok) throw new Error(`Error al cargar el precio (status ${res.status})`);

      const data = await res.json();
      const price = typeof data.pricePerNight === 'number' ? data.pricePerNight : data.price || null;

      if (price == null) {
        set({ error: 'No se encontró el precio del alojamiento.', pricePerNight: null });
      } else {
        set({ pricePerNight: price });
        const { total, nightsWithIncrease } = useBookingStore.getState().computeTotalWithIncreases(
          undefined,
          undefined,
          price
        );
        set({ totalPrice: total, nightsWithIncrease });
      }
    } catch (err: any) {
      console.error('Error fetching listing price:', err);
      set({ error: err.message || 'No se pudo cargar el precio del alojamiento.', pricePerNight: null });
    } finally {
      set({ loadingPrice: false });
    }
  },

  // Fetch para las reservas
  fetchBookings: async (listingId) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
    try {
      const res = await fetch(`${API_BASE}/bookings/lodging/${encodeURIComponent(listingId)}`);
      if (!res.ok) throw new Error(`Error fetching bookings: ${res.status}`);
      const data = await res.json();

      const ranges = data.map((booking: any) => ({
        from: new Date(booking.checkIn),
        to: new Date(booking.checkOut),
      }));
      set({ disabledRanges: ranges });
    } catch (err) {
      console.error(err);
    }
  },

  isDateRangeAvailable: (checkIn, checkOut) => {
    return true;
  },
}));

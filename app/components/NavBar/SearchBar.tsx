'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import type { OnSearchFn } from '../types/search';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SearchBarProps {
  onSearch: OnSearchFn;
}

export const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState<number>(1);
  const [amenities, setAmenities] = useState('');
  const [pricePerNight, setPricePerNight] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [openCalendar, setOpenCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCheckIn(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
    setCheckOut(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
  }, [range]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setOpenCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  const handleSearch = async () => {
    const maxPriceNum = pricePerNight.trim() === '' ? null : Number(pricePerNight);

    // Detectar si no hay filtros: resetear búsqueda
    const noFilters =
      !destination?.trim() &&
      !checkIn &&
      !checkOut &&
      (!guests || guests <= 0) &&
      !amenities?.trim() &&
      (!maxPriceNum || maxPriceNum <= 0);

    if (noFilters) {
      setResults([]);
      onSearch('', '', '', 1, '', '', 0);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (checkIn) params.append('checkIn', checkIn);
      if (checkOut) params.append('checkOut', checkOut);
      if (guests && guests > 0) params.append('guests', guests.toString());
      if (destination) params.append('destination', destination);
      if (amenities) params.append('amenities', amenities);
      if (maxPriceNum !== null) params.append('maxPrice', maxPriceNum.toString());

      const res = await fetch(`${API_BASE}/bookings/search?${params.toString()}`);
      if (!res.ok) throw new Error('Error al buscar listings');

      const listings = await res.json();
      setResults(listings);
      onSearch(destination, checkIn, checkOut, guests, '', amenities, maxPriceNum ?? 0, listings);
    } catch (error) {
      console.error(error);
      onSearch(destination, checkIn, checkOut, guests, '', amenities, maxPriceNum ?? 0, []);
    }
  };

  const handleClearSearch = () => {
    setDestination('');
    setCheckIn('');
    setCheckOut('');
    setGuests(1);
    setAmenities('');
    setPricePerNight('');
    setRange(undefined);
    onSearch('', '', '', 1, '', '', 0); // reset resultados
  };

  return (
    <div className="relative w-full flex justify-center items-center p-8">
      <div className="bar w-4/5 sm:w-[650px] bg-white shadow-lg rounded-full flex justify-between items-center p-2 relative">
        {/* Ubicación */}
        <div className="location flex flex-col items-center w-[13%] px-2">
          <p className="text-xs text-gray-600">Ubicación</p>
          <input
            type="text"
            placeholder="¿A dónde vas?"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="bg-transparent border-none text-[11px] md:text-xs placeholder-gray-500 w-full text-center focus:outline-none"
          />
        </div>

        {/* Check-in */}
        <div className="check-in flex flex-col items-center w-[13%] px-2">
          <p className="text-xs text-gray-600">Check-in</p>
          <button
            type="button"
            onClick={() => setOpenCalendar(true)}
            className="bg-transparent border-none text-[11px] md:text-xs placeholder-gray-500 w-full text-center focus:outline-none py-1"
          >
            {checkIn || 'Fecha de entrada'}
          </button>
        </div>

        {/* Check-out */}
        <div className="check-out flex flex-col items-center w-[13%] px-2">
          <p className="text-xs text-gray-600">Check-out</p>
          <button
            type="button"
            onClick={() => setOpenCalendar(true)}
            className="bg-transparent border-none text-[11px] md:text-xs placeholder-gray-500 w-full text-center focus:outline-none py-1"
          >
            {checkOut || 'Fecha de salida'}
          </button>
        </div>

        {/* Huéspedes */}
        <div className="guests flex flex-col items-center w-[13%] px-2 relative">
          <p className="text-xs text-gray-600">Huéspedes</p>
          <input
            type="number"
            min={1}
            placeholder="Capacidad"
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="bg-transparent border-none text-[11px] md:text-xs placeholder-gray-500 w-full text-center focus:outline-none"
          />
        </div>

        {/* Amenities */}
        <div className="amenities flex flex-col items-center w-[13%] px-2">
          <p className="text-xs text-gray-600">Servicios</p>
          <input
            type="text"
            placeholder="wifi, piscina..."
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            className="bg-transparent border-none text-[11px] md:text-xs placeholder-gray-500 w-full text-center focus:outline-none"
          />
        </div>

        {/* Precio máximo */}
        <div className="price-per-night flex flex-col justify-center w-[22%] md:w-[18%] px-3">
          <label className="text-xs text-gray-600">Precio máx/noche</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej: 180000"
            value={pricePerNight}
            onChange={(e) => {
              const onlyNums = e.target.value.replace(/[^\d]/g, '');
              setPricePerNight(onlyNums);
            }}
            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
            className="bg-transparent border-none text-[11px] md:text-xs placeholder-gray-500 w-full text-left focus:outline-none"
          />
        </div>

        {/* Botón de búsqueda */}
        <button
          type="button"
          onClick={handleSearch}
          className="search-icon flex justify-center items-center w-[5%] px-2"
          aria-label="Buscar"
        >
          <span className="bg-red-600 text-white text-xs p-2 rounded-full">
            <FaSearch className="text-xs" />
          </span>
        </button>

        {/* Botón Limpiar */}
        <button
          type="button"
          onClick={handleClearSearch}
          className="ml-2 px-4 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
        >
          Limpiar
        </button>
      </div>

      {/* Calendario */}
      {openCalendar && (
        <div
          ref={calendarRef}
          className="absolute top-[95%] left-1/2 -translate-x-1/2 z-50 bg-white p-4 rounded-xl shadow-2xl"
        >
          <DayPicker
            mode="range"
            selected={range}
            onSelect={(r) => {
              setRange(r);
              if (r?.from && r?.to && r.from.getTime() !== r.to.getTime()) {
                setOpenCalendar(false);
              }
            }}
            numberOfMonths={2}
            locale={es}
            disabled={{ before: new Date() }}
            weekStartsOn={1}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              className="text-[11px] md:text-xs px-3 py-1 rounded hover:bg-gray-100"
              onClick={() => setRange(undefined)}
            >
              Limpiar
            </button>
            <button
              className="text-[11px] md:text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setOpenCalendar(false)}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

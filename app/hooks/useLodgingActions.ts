'use client';

import { useState } from 'react';
import axios from 'axios';

const LS = {
  AUTH: 'authToken',
};

const convertToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

const validateFile = (file: File) => ['image/jpeg', 'image/png'].includes(file.type);

export const useLodgingActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  const uploadImages = async (files: File[]): Promise<string[]> => {
    if (!files?.length) return [];

    try {
      setLoading(true);
      const base64Images = await Promise.all(
        files.filter(validateFile).map(file => convertToBase64(file))
      );

      const API_KEYIMG = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
      const uploadedUrls: string[] = [];

      for (const base64 of base64Images) {
        const formData = new FormData();
        formData.append('image', base64.split(',')[1]);

        const res = await axios.post(
          `https://api.imgbb.com/1/upload?key=${API_KEYIMG}`,
          formData
        );

        if (res.data?.data?.url) {
          uploadedUrls.push(res.data.data.url);
        } else {
          throw new Error('No se obtuvo URL de la imagen');
        }
      }

      return uploadedUrls;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error subiendo imágenes');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateLodging = async (id: string, data: any) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem(LS.AUTH) ?? '';
      const res = await fetch(`${API_BASE}/lodgings/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el alojamiento');
      return await res.json();
    } catch (err: any) {
      setError(err?.message || 'Error actualizando alojamiento');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deactivateLodging = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem(LS.AUTH) ?? '';
      const res = await fetch(`${API_BASE}/lodgings/${id}/deactivate`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo desactivar el alojamiento');
      return await res.json();
    } catch (err: any) {
      setError(err?.message || 'Error desactivando alojamiento');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeLodging = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem(LS.AUTH) ?? '';
      const res = await fetch(`${API_BASE}/lodgings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo eliminar el alojamiento');
      return await res.json();
    } catch (err: any) {
      setError(err?.message || 'Error eliminando alojamiento');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    uploadImages,
    updateLodging,
    deactivateLodging,
    removeLodging,
  };
};

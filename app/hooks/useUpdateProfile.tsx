// app/hooks/useUpdateProfile.ts

import { useState } from 'react';
import { UpdateUserDTO, User } from '../interfaces/user';

interface UseUpdateProfileReturn {
  updateProfile: (userId: string, data: UpdateUserDTO) => Promise<User>;
  loading: boolean;
  error: string | null;
  success: boolean;
  clearMessages: () => void;
}

/**
 * Hook para actualizar el perfil del usuario
 */
export const useUpdateProfile = (): UseUpdateProfileReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  /**
   * Función para actualizar el perfil
   */
  const updateProfile = async (userId: string, data: UpdateUserDTO): Promise<User> => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No se encontró el token de autenticación');
      }

      console.log(' Enviando actualización de perfil:', {
        userId,
        data: { ...data, password: data.password ? '***' : undefined }
      });

      const response = await fetch(`${API_BASE}/auth/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      console.log(' Response status:', response.status);

      if (!response.ok) {
        // Intentar obtener mensaje de error del servidor
        let errorMessage = `Error al actualizar: ${response.status}`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = Array.isArray(errorData.message) 
              ? errorData.message.join(', ')
              : errorData.message;
          }
        } catch {
          // Si no se puede parsear el error, usar el mensaje por defecto
        }

        throw new Error(errorMessage);
      }

      const updatedUser: User = await response.json();
      console.log(' Perfil actualizado exitosamente:', updatedUser);

      // Actualizar localStorage con los nuevos datos
      localStorage.setItem('userData', JSON.stringify(updatedUser));
      localStorage.setItem('userId', updatedUser.id);

      setSuccess(true);
      return updatedUser;

    } catch (err) {
      console.error(' Error actualizando perfil:', err);
      
      let errorMessage = 'Error al actualizar el perfil';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw err;

    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(false);
  };

  return {
    updateProfile,
    loading,
    error,
    success,
    clearMessages,
  };
};
// app/profile/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/hooks/useProfile';
import { useUpdateProfile } from '@/app/hooks/useUpdateProfile';
import { UpdateUserDTO } from '@/app/interfaces/user';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, loading: loadingProfile, refetch } = useProfile();
  const { updateProfile, loading: updating, error, success } = useUpdateProfile();

  const [formData, setFormData] = useState<UpdateUserDTO>({
    name: '',
    email: '',
    password: '',
  });
  
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ''
      ? process.env.NEXT_PUBLIC_API_URL
      : '';
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
      });
    }
  }, [user]);


  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token && !loadingProfile) {
      router.push('/');
    }
  }, [router, loadingProfile]);


  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push('/profile');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const validateForm = (): string | null => {
    if (!formData.name || formData.name.trim().length < 2) {
      return 'El nombre debe tener al menos 2 caracteres';
    }

    if (!formData.email || !formData.email.includes('@')) {
      return 'El email no es válido';
    }

    // Si está cambiando la contraseña
    if (formData.password) {
      if (formData.password.length < 8) {
        return 'La contraseña debe tener al menos 8 caracteres';
      }
      if (formData.password !== confirmPassword) {
        return 'Las contraseñas no coinciden';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar
    const validation = validateForm();
    if (validation) {
      setValidationError(validation);
      return;
    }

    setValidationError(null);

    if (!user?.id) {
      setValidationError('No se encontró información del usuario');
      return;
    }

    try {
      // Preparar datos a enviar
      const dataToSend: UpdateUserDTO = {
        name: formData.name?.trim(),
        email: formData.email?.trim(),
      };

      // Solo incluir password si el usuario lo cambió
      if (formData.password && formData.password.trim()) {
        dataToSend.password = formData.password;
      }

      // Actualizar perfil
      await updateProfile(user.id, dataToSend);
      
      // Refrescar datos del perfil
      await refetch();

      // Limpiar campos de contraseña
      setFormData(prev => ({ ...prev, password: '' }));
      setConfirmPassword('');

    } catch (err) {
      // El error ya está manejado por el hook
      console.error('Error en handleSubmit:', err);
    }
  };

  // Loading inicial
  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-16 bg-gray-50">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-[90%] max-w-2xl border border-gray-100">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-[#155dfc] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">Cargando perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayError = validationError || error;

  return (
    <div className="min-h-screen py-16 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4">
        
        {/* Encabezado */}
        <div className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/profile')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              ← Volver
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Editar Perfil</h1>
          </div>
          <p className="text-gray-600">Actualiza tu información personal</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-8 border border-gray-100">
          
          {/* Avatar (solo visual) */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full border-4 border-[#155dfc] bg-blue-100 flex items-center justify-center shadow-md">
              <span className="text-3xl font-bold text-[#155dfc]">
                {formData.name?.charAt(0).toUpperCase() || user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Mensajes de éxito/error */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">¡Perfil actualizado exitosamente!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">Redirigiendo a tu perfil...</p>
            </div>
          )}

          {displayError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="font-semibold">{displayError}</span>
              </div>
            </div>
          )}

          <div className="space-y-6">
            
            {/* Nombre */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre completo *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name || ''}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setValidationError(null);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155dfc] focus:border-transparent transition"
                placeholder="Ej: Juan Pérez"
                required
                disabled={updating}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Correo electrónico *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email || ''}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setValidationError(null);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155dfc] focus:border-transparent transition"
                placeholder="tu@email.com"
                required
                disabled={updating}
              />
            </div>

            {/* Separador */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Cambiar contraseña (opcional)
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Deja estos campos vacíos si no deseas cambiar tu contraseña
              </p>
            </div>

            {/* Nueva contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setValidationError(null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155dfc] focus:border-transparent transition pr-12"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  disabled={updating}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {formData.password && formData.password.length > 0 && formData.password.length < 8 && (
                <p className="text-xs text-red-500 mt-1">
                  La contraseña debe tener al menos 8 caracteres
                </p>
              )}
            </div>

            {/* Confirmar contraseña */}
            {formData.password && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmar nueva contraseña
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#155dfc] focus:border-transparent transition"
                  placeholder="Repite la nueva contraseña"
                  disabled={updating}
                />
                {confirmPassword && formData.password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    Las contraseñas no coinciden
                  </p>
                )}
              </div>
            )}

            {/* Roles (solo lectura) */}
            <div className="border-t border-gray-200 pt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tus roles
              </label>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full"
                  >
                    {role === 'host' ? '🏠 Host' : role === 'guest' ? '👤 Guest' : '👑 ' + role}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Los roles solo pueden ser modificados por un administrador
              </p>
            </div>

          </div>

          {/* Botones */}
          <div className="flex gap-4 mt-8">
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              disabled={updating}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#155dfc] text-white font-semibold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={updating}
            >
              {updating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
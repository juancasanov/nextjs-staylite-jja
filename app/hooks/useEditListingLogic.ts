import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useFetchLodging from '@/app/hooks/useFetchLodgingid';
import { LodgingForm } from '@/app/interfaces/lodging';
import { useLodgingActions } from '@/app/hooks/useLodgingActions';

const LS = {
  ACTIVE: 'activeRole',
  VIEWAS: 'viewAs',
  PREV: 'prevActiveRole',
  AUTH: 'authToken',
} as const;

const numberFields = ['pricePerNight', 'capacity', 'rooms', 'beds', 'baths'];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => { reader.abort(); reject(new Error('Error leyendo archivo')); };
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

const normalizeServerMessages = async (res: Response) => {
  try {
    const body = await res.json().catch(() => null);
    if (!body) return [`Error ${res.status}`];
    if (Array.isArray(body.message)) return body.message.map(String);
    if (typeof body.message === 'string') return body.message.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
    if (body.errors && typeof body.errors === 'object') {
      const out: string[] = [];
      for (const k of Object.keys(body.errors)) {
        const v = (body as any).errors[k];
        if (Array.isArray(v)) out.push(...v.map(String)); else out.push(String(v));
      }
      return out.length ? out : [JSON.stringify(body)];
    }
    return [JSON.stringify(body)];
  } catch { return [`Error ${res.status}`]; }
};

const validateFormData = (data: LodgingForm, finalImages: string[]) => {
  const errors: string[] = [];
  if (typeof data.title !== 'string' || data.title.trim() === '') errors.push('El título debe ser una cadena de texto.');
  if (typeof data.description !== 'string' || data.description.trim() === '') errors.push('La descripción debe ser una cadena de texto.');
  if (typeof data.pricePerNight !== 'number' || Number.isNaN(data.pricePerNight)) errors.push('El precio por noche debe ser un número.');
  else if (data.pricePerNight < 0) errors.push('El precio por noche no puede ser negativo.');
  const intFields: Array<{ name: keyof LodgingForm; value: any; min: number }> = [
    { name: 'capacity', value: data.capacity, min: 1 },
    { name: 'rooms', value: data.rooms, min: 1 },
    { name: 'beds', value: data.beds, min: 1 },
    { name: 'baths', value: data.baths, min: 0 },
  ];
  for (const f of intFields) {
    if (typeof f.value !== 'number' || Number.isNaN(f.value) || !Number.isInteger(f.value)) errors.push(`El campo ${String(f.name)} debe ser un número entero.`);
    else if (f.value < f.min) errors.push(`El campo ${String(f.name)} no puede ser menor que ${f.min}.`);
  }
  if (!Array.isArray(data.amenities)) errors.push('Las comodidades deben ser un arreglo.');
  else for (const a of data.amenities) { if (typeof a !== 'string' || a.trim() === '') { errors.push('Cada comodidad debe ser una cadena de texto no vacía.'); break; } }
  if (typeof data.city !== 'string' || data.city.trim() === '') errors.push('La ciudad debe ser una cadena de texto válida.');
  if (typeof data.address !== 'string' || data.address.trim() === '') errors.push('La dirección debe ser una cadena de texto válida.');
  if (typeof data.coordinates !== 'object' || data.coordinates == null || typeof (data.coordinates as any).lat !== 'number' || typeof (data.coordinates as any).lng !== 'number') errors.push('La ubicación debe incluir coordenadas válidas (lat y lng).');
  if (!Array.isArray(finalImages)) errors.push('Las imágenes deben ser un arreglo.');
  else if (finalImages.length === 0) errors.push('Las imágenes no deben estar vacías.');
  else for (const img of finalImages) { if (typeof img !== 'string' || img.trim() === '') { errors.push('Cada imagen debe ser una URL o cadena (no vacía).'); break; } }
  return errors;
};

export default function useEditListingLogic(listingId?: string | string[]) {
  const router = useRouter();
  const resolvedListingId = Array.isArray(listingId) ? listingId[0] : listingId;

  const { lodging, loading, error } = useFetchLodging(resolvedListingId as string);
  const { uploadImages } = useLodgingActions();

  const [formData, setFormData] = useState<LodgingForm>({
    title: '',
    description: '',
    pricePerNight: 0,
    capacity: 1,
    rooms: 1,
    beds: 1,
    baths: 1,
    amenities: [],
    city: '',
    address: '',
    coordinates: { lat: 0, lng: 0 },
    images: [],
  });

  const originalRef = useRef<LodgingForm | null>(null);
  const [newAmenity, setNewAmenity] = useState('');
  const [newImages, setNewImages] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localActive, setLocalActive] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lodging) {
      const initial: LodgingForm = {
        title: lodging.title ?? '',
        description: lodging.description ?? '',
        pricePerNight: typeof lodging.pricePerNight === 'number' ? lodging.pricePerNight : 0,
        capacity: lodging.capacity ?? 1,
        rooms: lodging.rooms ?? 1,
        beds: lodging.beds ?? 1,
        baths: lodging.baths ?? 1,
        amenities: lodging.amenities ?? [],
        city: lodging.location?.city ?? '',
        address: lodging.location?.address ?? '',
        coordinates: lodging.location?.coordinates ?? { lat: 0, lng: 0 },
        images: lodging.images ?? [],
      };
      setFormData(initial);
      originalRef.current = JSON.parse(JSON.stringify(initial));
      if (typeof lodging.isActive === 'boolean') setLocalActive(lodging.isActive);
    }
  }, [lodging]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    const parsedValue = numberFields.includes(name) && value !== '' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: parsedValue } as any));
  };

  const handleAddAmenity = () => {
    const trimmed = newAmenity.trim();
    if (trimmed && !formData.amenities.includes(trimmed)) {
      setFormData(prev => ({ ...prev, amenities: [...prev.amenities, trimmed] }));
      setNewAmenity('');
    }
  };

  const handleRemoveAmenity = (amenity: string) =>
    setFormData(prev => ({ ...prev, amenities: prev.amenities.filter(a => a !== amenity) }));

  const handleImageUpload = (files: FileList | null) => {
    if (files) {
      const filesArray = Array.from(files);
      const validFiles = filesArray.filter(file => {
        if (!file.type.startsWith('image/')) { setErrorMessage(['Solo se pueden subir imágenes.']); return false; }
        if (file.size > 5 * 1024 * 1024) { setErrorMessage(['El archivo es demasiado grande (máx 5MB).']); return false; }
        return true;
      });
      if (validFiles.length > 0) { setErrorMessage(null); setNewImages(prev => [...prev, ...validFiles]); }
    }
  };

  const handleRemoveNewImage = (index: number) => setNewImages(prev => prev.filter((_, i) => i !== index));
  const handleRemoveExistingImage = (index: number) =>
    setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));

  const handleSubmit = async () => {
    setErrorMessage(null);
    try {
      const token = (typeof window !== 'undefined' && (localStorage.getItem(LS.AUTH) || localStorage.getItem('authToken'))) || '';
      if (!token) { setErrorMessage(['No autenticado. Por favor, inicia sesión.']); return; }
      if (!originalRef.current) { setErrorMessage(['No se pudo comparar cambios. Recarga la página e intenta de nuevo.']); return; }

      setIsSubmitting(true);

      let newImageStrings: string[] = [];
      if (newImages.length > 0) {
        try {
          if (typeof uploadImages === 'function') {
            const maybe = await uploadImages(newImages);
            if (Array.isArray(maybe) && maybe.every(i => typeof i === 'string')) newImageStrings = maybe as string[];
            else newImageStrings = await Promise.all(newImages.map(f => fileToBase64(f)));
          } else {
            newImageStrings = await Promise.all(newImages.map(f => fileToBase64(f)));
          }
        } catch {
          setErrorMessage(['Error al procesar imágenes. Intenta nuevamente.']);
          setIsSubmitting(false);
          return;
        }
      }

      const finalImages = [...(formData.images ?? []), ...newImageStrings];
      const localErrors = validateFormData(formData, finalImages);
      if (localErrors.length > 0) {
        setErrorMessage(localErrors);
        setIsSubmitting(false);
        return;
      }

      const diff: any = {};
      const orig = originalRef.current;
      (['title','description','pricePerNight','capacity','rooms','beds','baths'] as const).forEach(k=>{
        if (JSON.stringify(orig[k]) !== JSON.stringify(formData[k])) diff[k] = formData[k];
      });
      const loc:any = {};
      if ((orig.city??'') !== (formData.city??'')) loc.city = formData.city;
      if ((orig.address??'') !== (formData.address??'')) loc.address = formData.address;
      const oc = orig.coordinates||{lat:0,lng:0}, nc = formData.coordinates||{lat:0,lng:0};
      const cd:any = {};
      if (oc.lat!==nc.lat) cd.lat = nc.lat;
      if (oc.lng!==nc.lng) cd.lng = nc.lng;
      if (Object.keys(cd).length) loc.coordinates = cd;
      if (Object.keys(loc).length) diff.location = loc;
      if (JSON.stringify(orig.amenities??[]) !== JSON.stringify(formData.amenities??[])) diff.amenities = formData.amenities;
      if (newImageStrings.length) diff.images = newImageStrings;

      if (Object.keys(diff).length === 0) {
        setOkMsg('Sin cambios');
        setTimeout(()=>setOkMsg(null), 1800);
        setIsSubmitting(false);
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiBase}/lodgings/${resolvedListingId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      });

      if (!res.ok) {
        const serverMsgs = await normalizeServerMessages(res);
        setErrorMessage(serverMsgs);
        setIsSubmitting(false);
        return;
      }

      const merged = { ...orig, ...diff };
      originalRef.current = JSON.parse(JSON.stringify(merged));
      setFormData(prev => ({ ...prev, ...diff }));
      setNewImages([]);
      setErrorMessage(null);
      setOkMsg('Cambios guardados');
      setTimeout(()=>setOkMsg(null), 1800);
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMessage([err?.message || 'Error actualizando listing']);
      setIsSubmitting(false);
    }
  };

  const handlePublishToggle = async () => {
    setErrorMessage(null);
    try {
      const token = (typeof window !== 'undefined' && (localStorage.getItem(LS.AUTH) || localStorage.getItem('authToken'))) || '';
      if (!token) { setErrorMessage(['Falta autenticación. Por favor inicia sesión.']); return; }
      if (!resolvedListingId) { setErrorMessage(['El ID del listing no está disponible.']); return; }

      const prev = localActive ?? Boolean(lodging?.isActive);
      setToggling(true);
      setLocalActive(!prev);

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      let res = await fetch(`${apiBase}/lodgings/${encodeURIComponent(String(resolvedListingId))}/changeActive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cache: 'no-store',
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/lodgings/${encodeURIComponent(String(resolvedListingId))}/changeActive`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        });
      }

      if (!res.ok) {
        setLocalActive(prev);
        let msg = `Error ${res.status}`;
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const body = await res.json();
            msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message || msg;
          } else {
            const text = await res.text();
            msg = text || msg;
          }
        } catch {}
        throw new Error(msg);
      }

      try {
        const data = await res.json();
        if (typeof data?.isActive === 'boolean') setLocalActive(data.isActive);
        setOkMsg(data?.isActive ? 'Activado' : 'Desactivado');
      } catch {
        setOkMsg(!prev ? 'Activado' : 'Desactivado');
      }
      setTimeout(()=>setOkMsg(null), 1800);
    } catch (err: any) {
      setErrorMessage([err?.message ?? 'No fue posible cambiar estado de publicación']);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    try {
      const token = (typeof window !== 'undefined' && (localStorage.getItem('authToken') || localStorage.getItem(LS.AUTH))) || '';
      if (!token) { setErrorMessage(['Falta autenticación. Por favor inicia sesión.']); return; }
      if (!resolvedListingId) { setErrorMessage(['El ID del listing no está disponible.']); return; }

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const url = `${apiBase}/lodgings/${resolvedListingId}`;

      const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.text();
        setErrorMessage([`No fue posible eliminar el listing (${res.status}): ${body || 'Error desconocido'}`]);
        return;
      }
      router.push('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage([msg || 'Error desconocido al eliminar el listing.']);
    }
  };

  const handleBack = () => {
    const role = localStorage.getItem(LS.ACTIVE) || 'client';
    if (role === 'client') router.push('/client/listings');
    else if (role === 'admin') router.push('/admin/listings');
    else router.push('/');
  };

  const activeForUI = (localActive ?? Boolean(lodging?.isActive));

  return {
    lodging, loading, error,

    formData, setFormData, originalRef,

    newAmenity, setNewAmenity, newImages, setNewImages,
    errorMessage, setErrorMessage, isSubmitting, toggling, okMsg, setOkMsg, localActive, setLocalActive,

    handleChange, handleAddAmenity, handleRemoveAmenity,
    handleImageUpload, handleRemoveNewImage, handleRemoveExistingImage,
    handleSubmit, handlePublishToggle, handleDelete, handleBack,

    activeForUI,
  };
}

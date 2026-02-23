import axios from 'axios';

const getServerIP = () => {
    // Si hay una variable de entorno definida, la usamos
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Si estamos en localhost, tratamos de usar localhost para el backend también
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'https://localhost:8000';
        }
        return `https://${hostname}:8000`;
    }
    return 'https://localhost:8000';
};

export const API_URL = getServerIP();
// console.log('API_URL configurada en:', API_URL); // Eliminado por seguridad en producción

export const api = axios.create({
    baseURL: API_URL,
});

// Interceptor para añadir el token a cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor para manejar errores de respuesta (especialmente 401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Manejo de errores silencioso para privacidad
        if (error.response && error.response.status === 401) {
            // Solo logeamos advertencias, no errores de red completos
            console.warn('Sesión expirada o no autorizada. Redirigiendo...');
            localStorage.removeItem('token');
            window.location.href = '/login';
        }

        // Si no hay respuesta (Network Error), silenciamos el log por defecto de Axios
        // pero permitimos que el componente que llamó a la API maneje el error.
        return Promise.reject(error);
    }
);

export const loginUser = (formData: FormData) => api.post('/token', formData);

export const getAsociaciones = () => api.get('/asociaciones/');
export const crearAsociacion = (data: { nombre: string }) => api.post('/asociaciones/', data);

export const getIntegrantes = (params?: { skip?: number, limit?: number, search?: string, id_asociacion?: number }) =>
    api.get('/integrantes/', { params });
export const crearIntegrante = (data: {
    dni: string,
    nombres: string,
    apellidos: string,
    id_asociacion: number,
    tiene_foto?: boolean,
    face_descriptor?: number[]
}) => api.post('/integrantes/', data);

export const actualizarIntegrante = (id: number, data: {
    dni?: string,
    nombres?: string,
    apellidos?: string,
    id_asociacion?: number,
    tiene_foto?: boolean,
    face_descriptor?: number[]
}) => api.put(`/integrantes/${id}`, data);

export const eliminarIntegrante = (id: number) => api.delete(`/integrantes/${id}`);

export const actualizarFaceDescriptor = (id: number, face_descriptor: number[]) =>
    api.put(`/integrantes/${id}/face`, { face_descriptor });

export const registrarAsistencia = (data: { id_integrante: number, turno: string }) =>
    api.post('/asistencias/', data);

export const getAsistencias = () => api.get('/asistencias/');

export const getCursos = () => api.get('/cursos/');
export const crearCurso = (data: { nombre: string, fecha: string }) => api.post('/cursos/', data);
export const getReporteAsistencia = (fecha: string, turno?: string) =>
    api.get(`/asistencias/reporte/`, { params: { fecha, turno } });

export const bulkUpload = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/integrantes/bulk-upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const bulkPhotosUpload = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/integrantes/bulk-photos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const subirFotoIndividual = (dni: string, file: Blob) => {
    const formData = new FormData();
    formData.append('file', file, `${dni}.jpg`);
    return api.post(`/integrantes/upload-photo/${dni}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const getAuthenticatedFotoUrl = (dni: string) => {
    const token = localStorage.getItem('token');
    return `${API_URL}/fotos/${dni}.jpg${token ? `?token=${token}` : ''}`;
};

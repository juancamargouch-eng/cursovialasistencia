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
console.log('API_URL configurada en:', API_URL);

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

export const loginUser = (formData: FormData) => api.post('/token', formData);

export const getAsociaciones = () => api.get('/asociaciones/');
export const crearAsociacion = (data: { nombre: string }) => api.post('/asociaciones/', data);

export const getIntegrantes = () => api.get('/integrantes/');
export const crearIntegrante = (data: {
    dni: string,
    nombres: string,
    apellidos: string,
    id_asociacion: number,
    tiene_foto?: boolean,
    face_descriptor?: number[]
}) => api.post('/integrantes/', data);

export const actualizarIntegrante = (id: number, data: {
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
    api.post('/asistencia/', data);

export const getAsistencias = () => api.get('/asistencias/');

export const getCursos = () => api.get('/cursos/');
export const crearCurso = (data: { nombre: string, fecha: string }) => api.post('/cursos/', data);
export const getReporteAsistencia = (fecha: string) => api.get(`/reporte-asistencia/?fecha=${fecha}`);

export const bulkUpload = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk-upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const bulkPhotosUpload = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk-photos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

export const subirFotoIndividual = (dni: string, file: Blob) => {
    const formData = new FormData();
    formData.append('file', file, `${dni}.jpg`);
    return api.post(`/upload-photo/${dni}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

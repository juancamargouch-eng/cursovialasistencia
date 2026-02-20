export interface Asociacion {
    id: number;
    nombre: string;
    fecha_registro: string;
}

export interface Integrante {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    id_asociacion: number;
    tiene_foto: boolean;
    face_descriptor?: number[];
}

export interface Asistencia {
    id: number;
    id_integrante: number;
    dni_integrante: string;
    fecha: string;
    turno: string;
    nombres: string;
    apellidos: string;
    tiene_foto: boolean;
    nombre_asociacion: string;
}

from datetime import datetime
from typing import List, Optional
from jose import JWTError
from pydantic import BaseModel

class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserSchema(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Esquemas para Asociacion
class AsociacionBase(BaseModel):
    nombre: str

class AsociacionCreate(AsociacionBase):
    pass

class AsociacionSchema(AsociacionBase):
    id: int
    fecha_registro: datetime

    class Config:
        from_attributes = True

# Esquemas para Integrante
class IntegranteBase(BaseModel):
    dni: str
    nombres: str
    apellidos: str
    id_asociacion: int

class IntegranteCreate(IntegranteBase):
    tiene_foto: Optional[bool] = False
    foto_url: Optional[str] = None
    face_descriptor: Optional[List[float]] = None

class IntegranteUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    id_asociacion: Optional[int] = None
    tiene_foto: Optional[bool] = None
    foto_url: Optional[str] = None
    face_descriptor: Optional[List[float]] = None

class IntegranteUpdateFace(BaseModel):
    face_descriptor: List[float]

class IntegranteSchema(IntegranteBase):
    id: int
    tiene_foto: bool
    foto_url: Optional[str] = None
    face_descriptor: Optional[List[float]] = None

    class Config:
        from_attributes = True

# Esquemas para Asistencia
class AsistenciaBase(BaseModel):
    id_integrante: int
    turno: str

class AsistenciaCreate(AsistenciaBase):
    pass

class AsistenciaSchema(AsistenciaBase):
    id: int
    fecha: datetime

    class Config:
        from_attributes = True

class AsistenciaDetalle(AsistenciaSchema):
    dni_integrante: str
    nombres: str
    apellidos: str
    nombre_asociacion: str
    tiene_foto: bool

# Esquemas para Curso
class CursoBase(BaseModel):
    nombre: str
    fecha: datetime

class CursoCreate(CursoBase):
    pass

class CursoSchema(CursoBase):
    id: int
    fecha_registro: datetime

    class Config:
        from_attributes = True

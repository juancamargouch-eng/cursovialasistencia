from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

class Asociacion(Base):
    __tablename__ = "asociaciones"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, index=True, nullable=False)
    fecha_registro = Column(DateTime, default=datetime.now)

    integrantes = relationship("Integrante", back_populates="asociacion")

class Integrante(Base):
    __tablename__ = "integrantes"

    id = Column(Integer, primary_key=True, index=True)
    dni = Column(String, index=True)
    nombres = Column(String, nullable=False)
    apellidos = Column(String, nullable=False)
    id_asociacion = Column(Integer, ForeignKey("asociaciones.id"))
    tiene_foto = Column(Boolean, default=False)
    foto_url = Column(String, nullable=True)
    # Guardamos el face descriptor como un JSON (Array de 128 floats)
    face_descriptor = Column(JSON, nullable=True)

    asociacion = relationship("Asociacion", back_populates="integrantes")
    asistencias = relationship("Asistencia", back_populates="integrante")

    __table_args__ = (UniqueConstraint('dni', 'id_asociacion', name='uq_dni_asociacion'),)

class Asistencia(Base):
    __tablename__ = "asistencias"

    id = Column(Integer, primary_key=True, index=True)
    id_integrante = Column(Integer, ForeignKey("integrantes.id"))
    fecha = Column(DateTime, default=datetime.now)
    turno = Column(String)  # Mañana, Tarde, Noche

    integrante = relationship("Integrante", back_populates="asistencias")

class Curso(Base):
    __tablename__ = "cursos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    fecha = Column(DateTime, nullable=False)
    fecha_registro = Column(DateTime, default=datetime.now)

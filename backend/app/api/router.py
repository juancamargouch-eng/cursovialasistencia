from fastapi import APIRouter
from app.api.endpoints import auth, integrantes, asociaciones, asistencias, cursos

api_router = APIRouter()

api_router.include_router(auth.router, tags=["Autenticación"])
api_router.include_router(integrantes.router, prefix="/integrantes", tags=["Integrantes"])
api_router.include_router(asociaciones.router, prefix="/asociaciones", tags=["Asociaciones"])
api_router.include_router(asistencias.router, prefix="/asistencias", tags=["Asistencia"])
api_router.include_router(cursos.router, prefix="/cursos", tags=["Cursos"])

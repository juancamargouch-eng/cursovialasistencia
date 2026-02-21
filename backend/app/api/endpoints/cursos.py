from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db import session, models
from app.schemas import base as schemas
from app.core.dependencies import get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.CursoSchema)
def crear_curso(
    curso: schemas.CursoCreate, 
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    nuevo_curso = models.Curso(nombre=curso.nombre, fecha=curso.fecha)
    db.add(nuevo_curso)
    db.commit()
    db.refresh(nuevo_curso)
    return nuevo_curso

@router.get("/", response_model=List[schemas.CursoSchema])
def listar_cursos(db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Curso).order_by(models.Curso.fecha.desc()).all()

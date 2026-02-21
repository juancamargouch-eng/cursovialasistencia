from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import session, models
from app.schemas import base as schemas
from app.core.dependencies import get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.AsociacionSchema)
def crear_asociacion(asociacion: schemas.AsociacionBase, db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    db_asociacion = models.Asociacion(nombre=asociacion.nombre)
    db.add(db_asociacion)
    db.commit()
    db.refresh(db_asociacion)
    return db_asociacion

@router.get("/", response_model=List[schemas.AsociacionSchema])
def listar_asociaciones(search: Optional[str] = None, db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Asociacion)
    if search:
        search_filter = f"%{search}%"
        text_filters = models.Asociacion.nombre.like(search_filter)
        if search.isdigit():
            query = query.filter(text_filters | (models.Asociacion.id == int(search)))
        else:
            query = query.filter(text_filters)
    return query.all()

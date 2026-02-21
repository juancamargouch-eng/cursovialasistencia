from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import date, datetime
from app.db import session, models
from app.schemas import base as schemas
from app.core.dependencies import get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.AsistenciaSchema)
def registrar_asistencia(
    asistencia: schemas.AsistenciaCreate, 
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == asistencia.id_integrante).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    
    hoy = datetime.now().date()
    ya_marcado = db.query(models.Asistencia).filter(
        models.Asistencia.id_integrante == asistencia.id_integrante,
        models.Asistencia.turno == asistencia.turno,
        func.date(models.Asistencia.fecha) == hoy
    ).first()

    if ya_marcado:
        raise HTTPException(
            status_code=400, 
            detail=f"YA MARCÓ ASISTENCIA EN EL TURNO {asistencia.turno.upper()}. QUE PASE EL SIGUIENTE."
        )

    nueva_asistencia = models.Asistencia(
        id_integrante=asistencia.id_integrante,
        turno=asistencia.turno
    )
    db.add(nueva_asistencia)
    db.commit()
    db.refresh(nueva_asistencia)
    return nueva_asistencia

@router.get("/", response_model=List[schemas.AsistenciaDetalle])
def listar_asistencias(db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    asistencias = db.query(models.Asistencia).all()
    resultado = []
    for a in asistencias:
        resultado.append({
            "id": a.id,
            "id_integrante": a.id_integrante,
            "dni_integrante": a.integrante.dni,
            "fecha": a.fecha,
            "turno": a.turno,
            "nombres": a.integrante.nombres,
            "apellidos": a.integrante.apellidos,
            "nombre_asociacion": a.integrante.asociacion.nombre,
            "tiene_foto": a.integrante.tiene_foto
        })
    return resultado

@router.get("/reporte/", tags=["Reportes"])
def reporte_asistencia(fecha: date, turno: str = None, db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    integrantes = db.query(models.Integrante).all()
    
    query_asistencias = db.query(models.Asistencia).filter(
        func.date(models.Asistencia.fecha) == fecha
    )
    
    if turno:
        query_asistencias = query_asistencias.filter(models.Asistencia.turno == turno)
        
    asistencias_dia = query_asistencias.all()
    
    # Mapeo de id_integrante -> [lista de asistencias]
    mapa_asistencias = {}
    for a in asistencias_dia:
        if a.id_integrante not in mapa_asistencias:
            mapa_asistencias[a.id_integrante] = []
        mapa_asistencias[a.id_integrante].append({
            "turno": a.turno,
            "hora": a.fecha.strftime("%H:%M:%S")
        })
    
    reporte = []
    for inte in integrantes:
        asistencias_inte = mapa_asistencias.get(inte.id, [])
        reporte.append({
            "id": inte.id,
            "dni": inte.dni,
            "nombres": inte.nombres,
            "apellidos": inte.apellidos,
            "id_asociacion": inte.id_asociacion,
            "empresa": inte.asociacion.nombre,
            "tiene_foto": inte.tiene_foto,
            "asistio": len(asistencias_inte) > 0,
            "detalles_asistencia": asistencias_inte # Lista con turnos y horas
        })
    return reporte

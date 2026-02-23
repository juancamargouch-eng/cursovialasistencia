from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional, Any
import os
import pandas as pd
import io
import zipfile
from PIL import Image
from app.db import session, models
from app.schemas import base as schemas
from app.core.dependencies import get_current_user
from app.utils.s3 import storage

router = APIRouter()

@router.post("/", response_model=schemas.IntegranteSchema)
def crear_integrante(
    integrante: schemas.IntegranteCreate, 
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Limpiar DNI y asegurar id_asociacion válido
    dni = integrante.dni.zfill(8)
    id_asoc = integrante.id_asociacion if (integrante.id_asociacion and integrante.id_asociacion > 0) else 1
    
    # Búsqueda global por DNI
    persona_existente = db.query(models.Integrante).filter(models.Integrante.dni == dni).first()
    
    # CASO: Emparejamiento Automático
    # Si no se especificó asociación (id_asociacion <= 1 o 0) y el DNI ya existe,
    # simplemente actualizamos los datos faciales del registro existente más antiguo/principal.
    # CASO: Emparejamiento Automático o Asociación General
    # Si es asociación General (1) y el DNI ya existe, actualizamos registros faciales.
    if id_asoc <= 1 and persona_existente:
        if integrante.nombres and persona_existente.nombres == "POR COMPLETAR": 
            persona_existente.nombres = integrante.nombres
        if integrante.apellidos and persona_existente.apellidos == "POR COMPLETAR": 
            persona_existente.apellidos = integrante.apellidos
        
        if integrante.face_descriptor: 
            persona_existente.face_descriptor = integrante.face_descriptor
        if integrante.tiene_foto is not None: 
            persona_existente.tiene_foto = integrante.tiene_foto
        
        db.commit()
        db.refresh(persona_existente)
        return persona_existente

    # CASO: Registro en Asociación Específica
    db_integrante = db.query(models.Integrante).filter(
        models.Integrante.dni == dni,
        models.Integrante.id_asociacion == id_asoc
    ).first()
    
    if db_integrante:
        # Si ya existe en esta asociación, actualizar
        if integrante.nombres: db_integrante.nombres = integrante.nombres
        if integrante.apellidos: db_integrante.apellidos = integrante.apellidos
        if integrante.face_descriptor: db_integrante.face_descriptor = integrante.face_descriptor
        if integrante.tiene_foto is not None: db_integrante.tiene_foto = integrante.tiene_foto
        db.commit()
        db.refresh(db_integrante)
        return db_integrante
    
    # Si no existe en esta asociación, crear nuevo registro (soporta multi-asociación)
    # Heredamos face_descriptor y tiene_foto si ya existen en el sistema para esta persona
    nuevo_integrante = models.Integrante(
        dni=dni,
        nombres=integrante.nombres,
        apellidos=integrante.apellidos,
        id_asociacion=id_asoc,
        tiene_foto=persona_existente.tiene_foto if persona_existente else integrante.tiene_foto,
        face_descriptor=persona_existente.face_descriptor if persona_existente else integrante.face_descriptor
    )
    db.add(nuevo_integrante)
    db.commit()
    db.refresh(nuevo_integrante)
    return nuevo_integrante

@router.get("/", response_model=schemas.PaginatedIntegrantes)
def listar_integrantes(
    skip: int = 0, 
    limit: int = 50, 
    search: Optional[str] = None,
    id_asociacion: Optional[int] = None,
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Integrante)
    
    if id_asociacion:
        query = query.filter(models.Integrante.id_asociacion == id_asociacion)
    
    if search:
        search_filter = f"%{search}%"
        # Filtros de texto
        text_filters = (
            (models.Integrante.dni.like(search_filter)) |
            (models.Integrante.nombres.like(search_filter)) |
            (models.Integrante.apellidos.like(search_filter))
        )
        
        # Si es un número, también buscamos por ID exacto
        if search.isdigit():
            query = query.filter(text_filters | (models.Integrante.id == int(search)))
        else:
            query = query.filter(text_filters)
    
    total = query.count()
    items = query.order_by(models.Integrante.apellidos.asc()).offset(skip).limit(limit).all()
    
    return {"total": total, "items": items}

@router.put("/{id}", response_model=schemas.IntegranteSchema)
def actualizar_integrante(
    id: int, 
    integrante: schemas.IntegranteUpdate, 
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == id).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    
    if integrante.nombres is not None:
        db_integrante.nombres = integrante.nombres
    if integrante.apellidos is not None:
        db_integrante.apellidos = integrante.apellidos
    if integrante.id_asociacion is not None:
        db_integrante.id_asociacion = integrante.id_asociacion
    if integrante.tiene_foto is not None:
        db_integrante.tiene_foto = integrante.tiene_foto
    if integrante.face_descriptor is not None:
        db_integrante.face_descriptor = integrante.face_descriptor
    if integrante.dni is not None and integrante.dni != db_integrante.dni:
        db_integrante.dni = integrante.dni.zfill(8)
    
    db.commit()
    db.refresh(db_integrante)
    return db_integrante

@router.delete("/{id}", tags=["Integrantes"])
def eliminar_integrante(id: int, db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == id).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    db.delete(db_integrante)
    db.commit()
    return {"message": "Integrante eliminado exitosamente"}

@router.put("/{id}/face", response_model=schemas.IntegranteSchema)
def actualizar_face_descriptor(
    id: int, 
    data: schemas.IntegranteUpdateFace, 
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == id).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    
    db_integrante.face_descriptor = data.face_descriptor
    db_integrante.tiene_foto = True
    db.commit()
    db.refresh(db_integrante)
    return db_integrante

@router.post("/bulk-upload/", tags=["Mantenimiento"])
async def carga_masiva(
    file: UploadFile = File(...), 
    db: Session = Depends(session.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        required_cols = ['AP_ALUMNO', 'NO_ALUMNO', 'EMPRESA', 'NRO_DOCUM']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Falta la columna requerida: {col}")

        stats = {"creados": 0, "empresas_nuevas": 0, "omitidos": 0, "errores": 0}
        
        for _, row in df.iterrows():
            try:
                apellidos = str(row['AP_ALUMNO']).strip().upper()
                nombres = str(row['NO_ALUMNO']).strip().upper()
                nombre_empresa = str(row['EMPRESA']).strip().upper()
                dni_raw = str(row['NRO_DOCUM']).split('.')[0].strip()
                dni = dni_raw.zfill(8)
                
                if len(dni) > 11:
                    dni = dni[:11]
                
                if not dni or dni == '00000000' or dni == 'NAN':
                    stats["errores"] += 1
                    continue

                db_asoc = db.query(models.Asociacion).filter(models.Asociacion.nombre == nombre_empresa).first()
                if not db_asoc:
                    db_asoc = models.Asociacion(nombre=nombre_empresa)
                    db.add(db_asoc)
                    db.commit()
                    db.refresh(db_asoc)
                    stats["empresas_nuevas"] += 1
                
                db_inte = db.query(models.Integrante).filter(
                    models.Integrante.dni == dni, 
                    models.Integrante.id_asociacion == db_asoc.id
                ).first()

                if not db_inte:
                    persona_existente = db.query(models.Integrante).filter(models.Integrante.dni == dni).first()
                    nuevo_inte = models.Integrante(
                        dni=dni,
                        nombres=nombres,
                        apellidos=apellidos,
                        id_asociacion=db_asoc.id,
                        tiene_foto=persona_existente.tiene_foto if persona_existente else False,
                        face_descriptor=persona_existente.face_descriptor if persona_existente else None
                    )
                    db.add(nuevo_inte)
                    db.commit()
                    stats["creados"] += 1
                else:
                    stats["omitidos"] += 1
            except Exception as e:
                print(f"Error procesando fila: {e}")
                stats["errores"] += 1

        return {"message": "Proceso de carga completado", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo Excel: {str(e)}")

@router.post("/bulk-photos/", tags=["Mantenimiento"])
async def carga_masiva_fotos(file: UploadFile = File(...), db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    try:
        contents = await file.read()
        zip_path = io.BytesIO(contents)
        stats = {"procesados": 0, "actualizados": 0, "no_encontrados": 0, "errores": 0}
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for file_info in zip_ref.infolist():
                if file_info.is_dir() or "__MACOSX" in file_info.filename: continue
                filename = os.path.basename(file_info.filename)
                if not filename.lower().endswith(('.png', '.jpg', '.jpeg')): continue
                
                dni = os.path.splitext(filename)[0].zfill(8)
                db_integrantes = db.query(models.Integrante).filter(models.Integrante.dni == dni).all()
                if not db_integrantes:
                    stats["no_encontrados"] += 1
                    continue
                
                stats["procesados"] += 1
                try:
                    with zip_ref.open(file_info) as source:
                        image_data = source.read()
                        object_name = f"fotos/{dni}.jpg"
                        s3_url = storage.upload_file(image_data, object_name)
                        if s3_url:
                            for inte in db_integrantes:
                                inte.tiene_foto = True
                                inte.foto_url = s3_url
                            db.commit()
                            stats["actualizados"] += 1
                        else:
                            stats["errores"] += 1
                except Exception as e:
                    print(f"Error subiendo foto {dni} a S3: {e}")
                    stats["errores"] += 1

        return {"message": "Carga de fotos completada", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo ZIP: {str(e)}")

@router.post("/upload-photo/{dni}", tags=["Mantenimiento"])
async def subir_foto_individual(dni: str, file: UploadFile = File(...), db: Session = Depends(session.get_db), current_user: models.User = Depends(get_current_user)):
    try:
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ['.jpg', '.jpeg', '.png']:
            raise HTTPException(status_code=400, detail="Soporte visual limitado a JPG o PNG")
        
        dni_clean = dni.zfill(8)
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        img_byte_arr = img_byte_arr.getvalue()

        object_name = f"fotos/{dni_clean}.jpg"
        s3_url = storage.upload_file(img_byte_arr, object_name)
        if not s3_url:
            raise HTTPException(status_code=500, detail="Error al subir la imagen al servidor de almacenamiento")

        db.query(models.Integrante).filter(models.Integrante.dni == dni_clean).update({
            "tiene_foto": True,
            "foto_url": s3_url
        })
        db.commit()
        return {"message": f"Foto de {dni_clean} guardada en S3 exitosamente", "url": s3_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando subida a S3: {str(e)}")

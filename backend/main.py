from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import date, datetime
import os
import pandas as pd
import io
import zipfile
from PIL import Image
import models, schemas, auth_utils
from database import engine, get_db
from s3_utils import storage
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

# Asegurar que existe la carpeta de subidas
UPLOAD_DIR = "uploads/fotos"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

# Crear las tablas en la base de datos
models.Base.metadata.create_all(bind=engine)

# Crear usuario administrador por defecto si no existe
def create_admin_user():
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        hashed_password = auth_utils.get_password_hash("admin123")
        admin_user = models.User(
            username="admin",
            hashed_password=hashed_password,
            full_name="Administrador Sistema",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
    db.close()

create_admin_user()

# Asegurar que existe la carpeta de subidas
UPLOAD_DIR = "uploads/fotos"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

# Crear las tablas en la base de datos
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CursoVial - API de Control de Asistencia")

# Endpoint para servir fotos (Redirección a S3 o Proxy)
@app.get("/fotos/{filename}", tags=["Fotos"])
async def serve_foto(filename: str, db: Session = Depends(get_db)):
    dni = filename.split('.')[0]
    # Buscar en la BD la URL real
    integrante = db.query(models.Integrante).filter(models.Integrante.dni == dni).first()
    if integrante and integrante.foto_url:
        return RedirectResponse(url=integrante.foto_url)
    
    # Fallback si no hay foto_url pero si tiene_foto (usar estructura por defecto en S3)
    if integrante and integrante.tiene_foto:
        s3_url = storage.get_file_url(f"fotos/{dni}.jpg")
        return RedirectResponse(url=s3_url)

    raise HTTPException(status_code=404, detail="Foto no encontrada")

# Configuración de CORS
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/token", response_model=schemas.Token, tags=["Autenticación"])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth_utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth_utils.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/bulk-upload/", tags=["Mantenimiento"])
async def carga_masiva(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # Leer el contenido del archivo
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Validar columnas requeridas
        required_cols = ['AP_ALUMNO', 'NO_ALUMNO', 'EMPRESA', 'NRO_DOCUM']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Falta la columna requerida: {col}")

        stats = {"creados": 0, "empresas_nuevas": 0, "omitidos": 0, "errores": 0}
        
        for _, row in df.iterrows():
            try:
                # Limpiar y validar datos
                apellidos = str(row['AP_ALUMNO']).strip().upper()
                nombres = str(row['NO_ALUMNO']).strip().upper()
                nombre_empresa = str(row['EMPRESA']).strip().upper()
                
                # CORRECCIÓN: Tratar DNI como string y rellenar con ceros (zfill)
                dni_raw = str(row['NRO_DOCUM']).split('.')[0].strip() # Manejar si viene como float de Excel
                dni = dni_raw.zfill(8) # Padding a 8 dígitos para DNI común, o dejar igual si es > 8
                
                if len(dni) > 11:
                    dni = dni[:11] # Truncar a 11 según requerimiento
                
                if not dni or dni == '00000000' or dni == 'NAN':
                    stats["errores"] += 1
                    continue

                # 1. Gestionar Empresa (Asociación)
                db_asoc = db.query(models.Asociacion).filter(models.Asociacion.nombre == nombre_empresa).first()
                if not db_asoc:
                    db_asoc = models.Asociacion(nombre=nombre_empresa)
                    db.add(db_asoc)
                    db.commit()
                    db.refresh(db_asoc)
                    stats["empresas_nuevas"] += 1
                
                # 2. Gestionar Integrante (Unicidad por DNI + Empresa)
                db_inte = db.query(models.Integrante).filter(
                    models.Integrante.dni == dni, 
                    models.Integrante.id_asociacion == db_asoc.id
                ).first()

                if not db_inte:
                    # Buscar si esta persona ya tiene foto/descriptor en OTRA empresa para sincronizar
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

        return {
            "message": "Proceso de carga completado",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo Excel: {str(e)}")

@app.post("/bulk-photos/", tags=["Mantenimiento"])
async def carga_masiva_fotos(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        zip_path = io.BytesIO(contents)
        
        stats = {"procesados": 0, "actualizados": 0, "no_encontrados": 0, "errores": 0}
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for file_info in zip_ref.infolist():
                if file_info.is_dir(): continue
                if "__MACOSX" in file_info.filename: continue
                
                filename = os.path.basename(file_info.filename)
                if not filename.lower().endswith(('.png', '.jpg', '.jpeg')): continue
                
                dni_raw = os.path.splitext(filename)[0]
                dni = dni_raw.zfill(8) # Padding de ceros para coincidir con DB
                
                # Buscar todos los registros de este DNI (en distintas empresas)
                db_integrantes = db.query(models.Integrante).filter(models.Integrante.dni == dni).all()
                if not db_integrantes:
                    stats["no_encontrados"] += 1
                    continue
                
                stats["procesados"] += 1
                
                try:
                    # Leer la imagen del ZIP
                    with zip_ref.open(file_info) as source:
                        image_data = source.read()
                        
                        # Subir a S3
                        object_name = f"fotos/{dni}.jpg"
                        s3_url = storage.upload_file(image_data, object_name)
                        
                        if s3_url:
                            # Marcar todos los registros con este DNI
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

        return {
            "message": "Carga de fotos completada",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el archivo ZIP: {str(e)}")

@app.post("/upload-photo/{dni}", tags=["Mantenimiento"])
async def subir_foto_individual(dni: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        # Validar extensión
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ['.jpg', '.jpeg', '.png']:
            raise HTTPException(status_code=400, detail="Soporte visual limitado a JPG o PNG")
        
        dni_clean = dni.zfill(8)
        contents = await file.read()
        
        # Procesar con PIL para estandarizar
        image = Image.open(io.BytesIO(contents))
        image = image.convert("RGB")
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        img_byte_arr = img_byte_arr.getvalue()

        # Subir a S3
        object_name = f"fotos/{dni_clean}.jpg"
        s3_url = storage.upload_file(img_byte_arr, object_name)
        
        if not s3_url:
            raise HTTPException(status_code=500, detail="Error al subir la imagen al servidor de almacenamiento")

        # Actualizar base de datos
        db.query(models.Integrante).filter(models.Integrante.dni == dni_clean).update({
            "tiene_foto": True,
            "foto_url": s3_url
        })
        db.commit()

        return {"message": f"Foto de {dni_clean} guardada en S3 exitosamente", "url": s3_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando subida a S3: {str(e)}")

# --- ENDPOINTS DE ASOCIACIONES ---

@app.post("/asociaciones/", response_model=schemas.AsociacionSchema, tags=["Asociaciones"])
def crear_asociacion(asociacion: schemas.AsociacionCreate, db: Session = Depends(get_db)):
    db_asociacion = models.Asociacion(nombre=asociacion.nombre)
    db.add(db_asociacion)
    db.commit()
    db.refresh(db_asociacion)
    return db_asociacion

@app.get("/asociaciones/", response_model=List[schemas.AsociacionSchema], tags=["Asociaciones"])
def listar_asociaciones(db: Session = Depends(get_db)):
    return db.query(models.Asociacion).all()

# --- ENDPOINTS DE INTEGRANTES ---

@app.post("/integrantes/", response_model=schemas.IntegranteSchema, tags=["Integrantes"])
def crear_integrante(integrante: schemas.IntegranteCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Padding DNI
    dni = integrante.dni.zfill(8)
    
    # Verificar si ya existe el DNI en ESTA asociación
    db_integrante = db.query(models.Integrante).filter(
        models.Integrante.dni == dni,
        models.Integrante.id_asociacion == integrante.id_asociacion
    ).first()
    
    if db_integrante:
        raise HTTPException(status_code=400, detail="Este DNI ya está registrado en esta empresa")
    
    # Sincronizar foto/descriptor si ya existe en otra empresa
    persona_existente = db.query(models.Integrante).filter(models.Integrante.dni == dni).first()
    
    nuevo_integrante = models.Integrante(
        dni=dni,
        nombres=integrante.nombres,
        apellidos=integrante.apellidos,
        id_asociacion=integrante.id_asociacion,
        tiene_foto=persona_existente.tiene_foto if persona_existente else integrante.tiene_foto,
        face_descriptor=persona_existente.face_descriptor if persona_existente else integrante.face_descriptor
    )
    db.add(nuevo_integrante)
    db.commit()
    db.refresh(nuevo_integrante)
    return nuevo_integrante

@app.get("/integrantes/", response_model=List[schemas.IntegranteSchema], tags=["Integrantes"])
def listar_integrantes(db: Session = Depends(get_db)):
    return db.query(models.Integrante).all()

@app.put("/integrantes/{id}", response_model=schemas.IntegranteSchema, tags=["Integrantes"])
def actualizar_integrante(id: int, integrante: schemas.IntegranteUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
    
    db.commit()
    db.refresh(db_integrante)
    return db_integrante

@app.delete("/integrantes/{id}", tags=["Integrantes"])
def eliminar_integrante(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == id).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    
    # También se eliminarán las asistencias relacionadas debido a la integridad referencial si está configurada,
    # o podrías eliminarlas manualmente aquí si no hay ON DELETE CASCADE.
    # En este caso, SQLAlchemy las manejará si el modelo está configurado o lanzará error de FK.
    try:
        db.delete(db_integrante)
        db.commit()
        return {"message": "Integrante eliminado exitosamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se puede eliminar el integrante porque tiene asistencias registradas")

@app.put("/integrantes/{id}/face", response_model=schemas.IntegranteSchema, tags=["Integrantes"])
def actualizar_descriptor_facial(id: int, data: schemas.IntegranteUpdateFace, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Buscamos el integrante específico
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == id).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    
    # SINCRONIZACIÓN: Actualizamos el descriptor para TODOS los registros con el mismo DNI
    dni = db_integrante.dni
    db.query(models.Integrante).filter(models.Integrante.dni == dni).update({
        "face_descriptor": data.face_descriptor,
        "tiene_foto": True
    })
    
    db.commit()
    db.refresh(db_integrante)
    return db_integrante

# --- ENDPOINTS DE CURSOS ---

@app.post("/cursos/", response_model=schemas.CursoSchema, tags=["Cursos"])
def crear_curso(curso: schemas.CursoCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    nuevo_curso = models.Curso(nombre=curso.nombre, fecha=curso.fecha)
    db.add(nuevo_curso)
    db.commit()
    db.refresh(nuevo_curso)
    return nuevo_curso

@app.get("/cursos/", response_model=List[schemas.CursoSchema], tags=["Cursos"])
def listar_cursos(db: Session = Depends(get_db)):
    return db.query(models.Curso).order_by(models.Curso.fecha.desc()).all()

@app.get("/reporte-asistencia/", tags=["Reportes"])
def reporte_asistencia(fecha: date, db: Session = Depends(get_db)):
    """
    Retorna una lista de todos los integrantes con su estado de asistencia (Presente/Faltante)
    para una fecha específica.
    """
    # 1. Obtener todos los integrantes con su asociación
    integrantes = db.query(models.Integrante).all()
    
    # 2. Obtener IDs de integrantes que asistieron ese día
    asistencias_dia = db.query(models.Asistencia.id_integrante).filter(
        func.date(models.Asistencia.fecha) == fecha
    ).all()
    
    asistentes_ids = {a.id_integrante for a in asistencias_dia}
    
    reporte = []
    for inte in integrantes:
        reporte.append({
            "id": inte.id,
            "dni": inte.dni,
            "nombres": inte.nombres,
            "apellidos": inte.apellidos,
            "empresa": inte.asociacion.nombre,
            "tiene_foto": inte.tiene_foto,
            "asistio": inte.id in asistentes_ids
        })
    
    return reporte

# --- ENDPOINTS DE ASISTENCIA ---

from sqlalchemy import func

@app.post("/asistencia/", response_model=schemas.AsistenciaSchema, tags=["Asistencia"])
def registrar_asistencia(asistencia: schemas.AsistenciaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verificar si el integrante existe
    db_integrante = db.query(models.Integrante).filter(models.Integrante.id == asistencia.id_integrante).first()
    if not db_integrante:
        raise HTTPException(status_code=404, detail="Integrante no encontrado")
    
    # Verificar si ya marcó asistencia hoy en este turno
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

@app.get("/asistencias/", response_model=List[schemas.AsistenciaDetalle], tags=["Asistencia"])
def listar_asistencias(db: Session = Depends(get_db)):
    asistencias = db.query(models.Asistencia).all()
    resultado = []
    for a in asistencias:
        resultado.append({
            "id": a.id,
            "id_integrante": a.id_integrante,
            "dni_integrante": a.integrante.dni, # Recuperamos DNI del integrante
            "fecha": a.fecha,
            "turno": a.turno,
            "nombres": a.integrante.nombres,
            "apellidos": a.integrante.apellidos,
            "nombre_asociacion": a.integrante.asociacion.nombre,
            "tiene_foto": a.integrante.tiene_foto
        })
    return resultado

if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv
    load_dotenv()
    
    # Prioridad: PORT (PaaS) > API_PORT (.env original) > 8000 (Default)
    port = int(os.getenv("PORT") or os.getenv("API_PORT") or 8000)
    host = os.getenv("HOST") or os.getenv("API_HOST") or "0.0.0.0"
    
    # SSL config (opcional en producción si hay reverse proxy)
    ssl_key = "key.pem" if os.path.exists("key.pem") else None
    ssl_cert = "cert.pem" if os.path.exists("cert.pem") else None
    
    uvicorn.run(
        "main:app", 
        host=host, 
        port=port, 
        reload=False,
        ssl_keyfile=ssl_key,
        ssl_certfile=ssl_cert
    )

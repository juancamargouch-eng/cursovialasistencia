import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.responses import RedirectResponse
from app.api.router import api_router
from app.db import session, models
from app.core import config, security
from app.utils.s3 import storage

# Asegurar que existe la carpeta de subidas (solo para compatibilidad local)
UPLOAD_DIR = "uploads/fotos"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

# Crear las tablas en la base de datos
models.Base.metadata.create_all(bind=session.engine)

# Inicializar aplicación
app = FastAPI(title=config.PROJECT_NAME)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir Router de la API
from app.core.dependencies import get_current_user

app.include_router(api_router)

# Endpoint para servir fotos (Redirección SEGURA a S3)
@app.get("/fotos/{filename}", tags=["Fotos"])
async def serve_foto(
    filename: str, 
    db: Session = Depends(session.get_db),
    current_user: models.User = Depends(get_current_user)
):
    dni = filename.split('.')[0]
    integrante = db.query(models.Integrante).filter(models.Integrante.dni == dni).first()
    
    if integrante:
        # Generar URL prefirmada (vínculo temporal seguro directo de S3)
        s3_url = storage.generate_presigned_url(f"fotos/{dni}.jpg")
        if s3_url:
            return RedirectResponse(url=s3_url)

    raise HTTPException(status_code=404, detail="Foto no encontrada o acceso denegado")

# Crear usuario administrador por defecto si no existe
def create_admin_user():
    db = next(session.get_db())
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        hashed_password = security.get_password_hash("admin123")
        admin_user = models.User(
            username="admin",
            hashed_password=hashed_password,
            full_name="Administrador Sistema",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
    db.close()

@app.on_event("startup")
async def startup_event():
    create_admin_user()

if __name__ == "__main__":
    import uvicorn
    # SSL config
    ssl_key = "key.pem" if os.path.exists("key.pem") else None
    ssl_cert = "cert.pem" if os.path.exists("cert.pem") else None
    
    uvicorn.run(
        "app.main:app", 
        host=config.HOST, 
        port=config.PORT, 
        reload=False,
        ssl_keyfile=ssl_key,
        ssl_certfile=ssl_cert
    )

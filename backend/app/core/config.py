import os
from dotenv import load_dotenv

load_dotenv()

# Configuración General
PROJECT_NAME = "CursoVial - API de Control de Asistencia"
SECRET_KEY = os.getenv("SECRET_KEY", "TU_CLAVE_SECRETA_SUPER_SEGURA")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 día

# Base de Datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://usuario:password@localhost:5432/nombre_db")

# Servidor
PORT = int(os.getenv("PORT") or os.getenv("API_PORT") or 8000)
HOST = os.getenv("HOST") or os.getenv("API_HOST") or "0.0.0.0"

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# S3 / Linode Objects
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL")
REGION = os.getenv("REGION", "us-lax-1")

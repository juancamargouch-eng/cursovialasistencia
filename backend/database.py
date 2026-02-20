import os
from dotenv import load_dotenv
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

# Cargar variables de entorno
load_dotenv()

# URL de la base de datos desde entorno (Obligatorio configurar en .env)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://usuario:password@localhost:5432/nombre_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

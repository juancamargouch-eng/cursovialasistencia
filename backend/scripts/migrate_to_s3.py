from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Importaciones relativas ahora que está en scripts/
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import models
from app.utils.s3 import storage
from app.core import config

def migrate():
    load_dotenv()
    engine = create_engine(config.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    integrantes = db.query(models.Integrante).all()
    upload_dir = "uploads/fotos"

    print(f"Iniciando migración de {len(integrantes)} integrantes...")

    for i in integrantes:
        if i.tiene_foto and not i.foto_url:
            local_path = os.path.join(upload_dir, f"{i.dni}.jpg")
            if os.path.exists(local_path):
                print(f"Subiendo foto de {i.dni}...")
                with open(local_path, "rb") as f:
                    content = f.read()
                    url = storage.upload_file(content, f"fotos/{i.dni}.jpg")
                    if url:
                        i.foto_url = url
                        db.commit()
                        print(f"Migrado: {i.dni} -> {url}")
            else:
                print(f"Foto local no encontrada para {i.dni}")

    db.close()
    print("Migración finalizada.")

if __name__ == "__main__":
    migrate()

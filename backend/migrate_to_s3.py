import os
import io
from sqlalchemy import text
from database import engine, SessionLocal
import models
from s3_utils import storage
from PIL import Image

def migrate():
    print("🚀 Iniciando migración de fotos a S3 (Linode Objects)...")
    db = SessionLocal()
    
    # 1. Asegurar que la columna foto_url exista (Parche manual de BD)
    try:
        print("🛠️ Verificando esquema de base de datos...")
        with engine.begin() as conn:
            # PostgreSQL syntax to add column if not exists
            conn.execute(text("ALTER TABLE integrantes ADD COLUMN IF NOT EXISTS foto_url VARCHAR;"))
            conn.commit()
            print("✅ Columna foto_url verificada/creada.")
    except Exception as e:
        print(f"⚠️ Nota: Error al verificar columna (podría ya existir): {e}")

    # 2. Obtener todos los integrantes que tienen foto local
    UPLOAD_DIR = "uploads/fotos"
    if not os.path.exists(UPLOAD_DIR):
        print("❌ No se encontró la carpeta local de fotos. Nada que migrar.")
        return

    integrantes_con_foto = db.query(models.Integrante).filter(models.Integrante.tiene_foto == True).all()
    print(f"📸 Se encontraron {len(integrantes_con_foto)} integrantes marcados con foto en la BD.")

    migrados = 0
    errores = 0

    for inte in integrantes_con_foto:
        foto_path = os.path.join(UPLOAD_DIR, f"{inte.dni}.jpg")
        
        # Si no existe como .jpg, intentar como .png o .jpeg (formatos que permitía el backend antes)
        if not os.path.exists(foto_path):
            for ext in ['.png', '.jpeg', '.JPG']:
                alt_path = os.path.join(UPLOAD_DIR, f"{inte.dni}{ext}")
                if os.path.exists(alt_path):
                    foto_path = alt_path
                    break
        
        if os.path.exists(foto_path):
            try:
                print(f"📤 Subiendo foto de {inte.nombres} ({inte.dni})...")
                
                # Procesar con PIL para estandarizar a JPEG
                with open(foto_path, "rb") as f:
                    image = Image.open(f)
                    image = image.convert("RGB")
                    img_byte_arr = io.BytesIO()
                    image.save(img_byte_arr, format='JPEG')
                    data = img_byte_arr.getvalue()

                object_name = f"fotos/{inte.dni}.jpg"
                s3_url = storage.upload_file(data, object_name)

                if s3_url:
                    inte.foto_url = s3_url
                    db.commit()
                    migrados += 1
                else:
                    errores += 1
            except Exception as e:
                print(f"❌ Error migrando {inte.dni}: {e}")
                errores += 1
        else:
            print(f"❓ Foto física no encontrada para DNI {inte.dni}")

    db.close()
    print(f"\n✨ Migración finalizada:")
    print(f"✅ Migrados con éxito: {migrados}")
    print(f"❌ Errores: {errores}")
    print(f"📂 Carpeta local '{UPLOAD_DIR}' conservada por seguridad.")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    migrate()

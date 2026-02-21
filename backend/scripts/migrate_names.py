import models
from database import engine, SessionLocal
from sqlalchemy import text

def migrate():
    print("Iniciando migración manual de la tabla 'integrantes'...")
    with engine.connect() as conn:
        # 1. Verificar si la columna antigua existe
        try:
            # PostgreSQL syntax to rename or add columns
            conn.execute(text("ALTER TABLE integrantes RENAME COLUMN nombre_completo TO nombres;"))
            print("Columna 'nombre_completo' renombrada a 'nombres'.")
        except Exception as e:
            print(f"Nota: No se pudo renombrar 'nombre_completo' (quizás ya se hizo o no existe): {e}")

        # 2. Agregar la columna 'apellidos' si no existe
        try:
            conn.execute(text("ALTER TABLE integrantes ADD COLUMN apellidos VARCHAR;"))
            conn.execute(text("UPDATE integrantes SET apellidos = 'N/A' WHERE apellidos IS NULL;"))
            conn.execute(text("ALTER TABLE integrantes ALTER COLUMN apellidos SET NOT NULL;"))
            print("Columna 'apellidos' agregada exitosamente.")
        except Exception as e:
            print(f"Nota: No se pudo agregar 'apellidos' (quizás ya existe): {e}")
        
        conn.commit()
    print("Migración completada.")

if __name__ == "__main__":
    migrate()

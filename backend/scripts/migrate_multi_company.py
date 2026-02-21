import models
from database import engine, SessionLocal
from sqlalchemy import text

def migrate():
    print("Iniciando migración para soporte de múltiples empresas y IDs únicos...")
    
    with engine.connect() as conn:
        # 1. Crear tabla temporal o agregar columnas
        print("Agregando columna 'id' a la tabla 'integrantes'...")
        try:
            # Agregar ID autoincremental
            conn.execute(text("ALTER TABLE integrantes ADD COLUMN IF NOT EXISTS id SERIAL;"))
            print("Columna 'id' agregada.")
        except Exception as e:
            print(f"Error al agregar ID: {e}")

        # 2. Actualizar la tabla de asistencias
        print("Actualizando tabla 'asistencias'...")
        try:
            # Agregar columna id_integrante
            conn.execute(text("ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS id_integrante INTEGER;"))
            
            # Vincular asistencias existentes con el nuevo ID de integrante basado en el DNI
            # Como actualmente el DNI es único, esto es seguro
            conn.execute(text("""
                UPDATE asistencias 
                SET id_integrante = integrantes.id 
                FROM integrantes 
                WHERE asistencias.dni_integrante = integrantes.dni;
            """))
            print("Vínculos de asistencia actualizados.")
        except Exception as e:
            print(f"Error al actualizar asistencias: {e}")

        # 3. Cambiar Restricciones
        print("Cambiando restricciones de clave primaria...")
        try:
            # Eliminar FK antigua en asistencias
            # Nota: Necesitamos el nombre de la restricción, usualmente es 'asistencias_dni_integrante_fkey'
            conn.execute(text("ALTER TABLE asistencias DROP CONSTRAINT IF EXISTS asistencias_dni_integrante_fkey;"))
            
            # Eliminar PK antigua en integrantes
            conn.execute(text("ALTER TABLE integrantes DROP CONSTRAINT IF EXISTS integrantes_pkey;"))
            
            # Establecer nueva PK en integrantes
            conn.execute(text("ALTER TABLE integrantes ADD PRIMARY KEY (id);"))
            
            # Establecer nueva FK en asistencias
            conn.execute(text("ALTER TABLE asistencias ADD CONSTRAINT asistencias_id_integrante_fkey FOREIGN KEY (id_integrante) REFERENCES integrantes(id);"))
            
            print("Restricciones actualizadas exitosamente.")
        except Exception as e:
            print(f"Error al cambiar restricciones: {e}")

        # 4. Asegurar que el DNI no sea único globalmente pero sí por empresa (opcional pero recomendado)
        try:
            # Primero quitamos cualquier índice único antiguo sobre DNI si existe
            conn.execute(text("DROP INDEX IF EXISTS ix_integrantes_dni;"))
            # Creamos un índice común para búsquedas rápidas por DNI
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_integrantes_dni ON integrantes (dni);"))
            # Creamos restricción única por (dni, id_asociacion)
            conn.execute(text("ALTER TABLE integrantes ADD CONSTRAINT uq_dni_asociacion UNIQUE (dni, id_asociacion);"))
            print("Índices de DNI actualizados.")
        except Exception as e:
            print(f"Nota sobre índices: {e}")

        conn.commit()
    
    print("Migración completada con éxito.")

if __name__ == "__main__":
    migrate()

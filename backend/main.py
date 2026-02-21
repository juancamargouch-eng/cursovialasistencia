import os
import uvicorn
from app.core import config
from app.main import app

if __name__ == "__main__":
    # SSL config (opcional en producción si hay reverse proxy)
    ssl_key = "key.pem" if os.path.exists("key.pem") else None
    ssl_cert = "cert.pem" if os.path.exists("cert.pem") else None
    
    print(f"Iniciando {config.PROJECT_NAME} en {config.HOST}:{config.PORT}...")
    
    uvicorn.run(
        "app.main:app", 
        host=config.HOST, 
        port=config.PORT, 
        reload=False,
        ssl_keyfile=ssl_key,
        ssl_certfile=ssl_cert
    )

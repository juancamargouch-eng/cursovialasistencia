import boto3
from botocore.exceptions import ClientError
from typing import Optional
from app.core import config

class S3Storage:
    def __init__(self):
        self.access_key = config.AWS_ACCESS_KEY_ID
        self.secret_key = config.AWS_SECRET_ACCESS_KEY
        self.bucket_name = config.AWS_STORAGE_BUCKET_NAME
        self.endpoint_url = config.AWS_S3_ENDPOINT_URL
        self.region = config.REGION

        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            endpoint_url=self.endpoint_url,
            region_name=self.region
        )

    def upload_file(self, file_content: bytes, object_name: str, content_type: str = "image/jpeg") -> Optional[str]:
        """Subir un archivo al bucket S3 con acceso privado."""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_content,
                ContentType=content_type
                # ACL eliminado: el archivo es privado por defecto
            )
            # Retornar el nombre del objeto para que la API maneje la URL prefirmada
            return object_name
        except ClientError as e:
            print(f"Error subiendo a S3: {e}")
            return None

    def generate_presigned_url(self, object_name: str, expiration: int = 3600) -> Optional[str]:
        """Generar una URL prefirmada temporal para visualización segura."""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"Error generando URL prefirmada: {e}")
            return None

    def delete_file(self, object_name: str) -> bool:
        # ... logic remains the same ...
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
            return True
        except ClientError as e:
            print(f"Error eliminando de S3: {e}")
            return False

    def get_file_url(self, object_name: str) -> str:
        """Retorna una URL prefirmada (segura) en lugar de la estática."""
        return self.generate_presigned_url(object_name)

storage = S3Storage()

import boto3
import os
from botocore.exceptions import ClientError
from typing import Optional

class S3Storage:
    def __init__(self):
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("AWS_STORAGE_BUCKET_NAME")
        self.endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL")
        self.region = os.getenv("REGION", "us-lax-1")

        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            endpoint_url=self.endpoint_url,
            region_name=self.region
        )

    def upload_file(self, file_content: bytes, object_name: str, content_type: str = "image/jpeg") -> Optional[str]:
        """Subir un archivo al bucket S3 y retornar la URL pública."""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_content,
                ContentType=content_type,
                ACL='public-read' # Hacemos que la foto sea accesible públicamente
            )
            # Construir URL (Para Linode es bucket.endpoint/object)
            # El endpoint suele venir como https://region.linodeobjects.com
            # La URL final sería https://bucket.region.linodeobjects.com/object
            domain = self.endpoint_url.replace("https://", "")
            return f"https://{self.bucket_name}.{domain}/{object_name}"
        except ClientError as e:
            print(f"Error subiendo a S3: {e}")
            return None

    def delete_file(self, object_name: str) -> bool:
        """Eliminar un archivo del bucket S3."""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
            return True
        except ClientError as e:
            print(f"Error eliminando de S3: {e}")
            return False

    def get_file_url(self, object_name: str) -> str:
        """Retorna la URL del objeto."""
        domain = self.endpoint_url.replace("https://", "")
        return f"https://{self.bucket_name}.{domain}/{object_name}"

storage = S3Storage()

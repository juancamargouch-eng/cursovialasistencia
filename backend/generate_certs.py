import os
import datetime
import ipaddress
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_self_signed_cert():
    print("Generando claves...")
    # Generate key
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    # Generate certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, u"PE"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Lima"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, u"Lima"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"CursoVial"),
        x509.NameAttribute(NameOID.COMMON_NAME, u"192.168.31.106"),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        # Our certificate will be valid for 10 years
        datetime.datetime.utcnow() + datetime.timedelta(days=3650)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName(u"localhost"),
            x509.IPAddress(ipaddress.IPv4Address("192.168.31.106")),
        ]),
        critical=False,
    ).sign(key, hashes.SHA256())
    
    # Write certificate and key to files
    with open("cert.pem", "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open("key.pem", "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    
    print("Certificado SSL generado exitosamente (cert.pem, key.pem)")

if __name__ == "__main__":
    # Check if cryptography is installed
    try:
        import cryptography
        generate_self_signed_cert()
    except ImportError:
        print("La libreria 'cryptography' no esta instalada. Instalando...")
        os.system("pip install cryptography")
        generate_self_signed_cert()

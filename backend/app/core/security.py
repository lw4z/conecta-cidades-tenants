import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Optional

import bcrypt
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import settings

_ALGORITHM = "HS256"

# Lazy-init Fernet singleton
_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.FIELD_ENCRYPTION_KEY.encode()
        _fernet = Fernet(key)
    return _fernet


def get_fernet() -> Fernet:
    return _get_fernet()


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ────────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


# ── Field encryption (Fernet) ──────────────────────────────────────────────────

def encrypt_field(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_field(cipher: str) -> str:
    return _get_fernet().decrypt(cipher.encode()).decode()


# ── API Key ────────────────────────────────────────────────────────────────────

def generate_api_key() -> str:
    return "ccat_" + secrets.token_hex(24)


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

from datetime import UTC, datetime
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlmodel import select

from app.core.database import get_db
from app.core.security import decode_access_token, hash_api_key
from app.models.tenant import ApiKey
from app.models.user import User


def get_current_user(
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = decode_access_token(access_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
    return user


def get_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> ApiKey:
    key_hash = hash_api_key(x_api_key)
    statement = select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
    api_key = db.exec(statement).first()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    api_key.last_used_at = datetime.now(UTC)
    db.add(api_key)
    db.commit()
    return api_key

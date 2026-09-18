from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlmodel import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import generate_api_key, hash_api_key
from app.models.tenant import ApiKey
from app.models.user import User
from app.schemas.tenant import ApiKeyCreate, ApiKeyCreatedRead, ApiKeyRead

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyRead])
def list_api_keys(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    keys = list(db.exec(select(ApiKey).order_by(ApiKey.id.desc())).all())
    return [ApiKeyRead.model_validate(k) for k in keys]


@router.post("", response_model=ApiKeyCreatedRead, status_code=status.HTTP_201_CREATED)
def create_api_key(
    data: ApiKeyCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    # Check duplicate name
    existing = db.exec(select(ApiKey).where(ApiKey.name == data.name)).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "VALIDATION_ERROR", "message": f"API Key name '{data.name}' já existe."}},
        )

    raw_key = generate_api_key()
    key_obj = ApiKey(
        name=data.name,
        key_hash=hash_api_key(raw_key),
        is_active=True,
        created_at=datetime.now(UTC),
    )
    db.add(key_obj)
    db.commit()
    db.refresh(key_obj)

    return ApiKeyCreatedRead(
        id=key_obj.id,
        name=key_obj.name,
        key=raw_key,
        is_active=key_obj.is_active,
        created_at=key_obj.created_at,
    )


@router.patch("/{key_id}/status", response_model=ApiKeyRead)
def toggle_api_key_status(
    key_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    key_obj = db.get(ApiKey, key_id)
    if key_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"API Key '{key_id}' não encontrada."}},
        )
    key_obj.is_active = not key_obj.is_active
    db.add(key_obj)
    db.commit()
    db.refresh(key_obj)
    return key_obj


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    key_obj = db.get(ApiKey, key_id)
    if key_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"API Key '{key_id}' não encontrada."}},
        )
    db.delete(key_obj)
    db.commit()

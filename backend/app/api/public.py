from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlmodel import select

from app.api.deps import get_api_key
from app.core.database import get_db
from app.models.tenant import ApiKey, Tenant
from app.services.tenant_service import serialize_tenant_to_v1_json

router = APIRouter(prefix="/api/v1", tags=["public"])


@router.get("/tenants")
def list_tenants_public(
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db),
):
    tenants = db.exec(select(Tenant).where(Tenant.is_active == True)).all()  # noqa: E712
    return [serialize_tenant_to_v1_json(t) for t in tenants]


@router.get("/tenants/{tenant_slug}")
def get_tenant_public(
    tenant_slug: str,
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db),
):
    tenant = db.exec(
        select(Tenant).where(
            Tenant.tenant_slug == tenant_slug,
            Tenant.is_active == True,  # noqa: E712
        )
    ).first()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "TENANT_NOT_FOUND",
                    "message": f"Tenant '{tenant_slug}' não encontrado ou inativo.",
                }
            },
        )
    return [serialize_tenant_to_v1_json(tenant)]

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlmodel import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import (
    PaginatedTenants,
    TenantCreate,
    TenantDetailRead,
    TenantListRead,
    TenantUpdate,
)
from app.services import tenant_service

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


@router.get("", response_model=PaginatedTenants)
def list_tenants(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    items, total = tenant_service.list_tenants(
        db, page=page, per_page=per_page, search=search, is_active=is_active
    )
    return PaginatedTenants(
        items=[TenantListRead.model_validate(i) for i in items],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=TenantDetailRead, status_code=status.HTTP_201_CREATED)
def create_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check duplicate slug
    existing = db.exec(select(Tenant).where(Tenant.tenant_slug == data.tenant_slug)).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "TENANT_SLUG_ALREADY_EXISTS", "message": f"Tenant slug '{data.tenant_slug}' já existe."}},
        )
    tenant = tenant_service.create_tenant(db, current_user, data)
    # Reload with decryption
    tenant = tenant_service.get_tenant(db, tenant.id)
    return tenant


# ── Export / Import (static routes BEFORE parameterized routes) ───────────────

@router.get("/export")
def export_tenants(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    data = tenant_service.export_all_tenants(db)
    return Response(
        content=json.dumps(data, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=tenants-export.json"},
    )


@router.post("/import")
def import_tenants(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = tenant_service.import_tenants(db, current_user, data)
    return summary


# ── Parameterized routes (must come after /export and /import) ───────────────

@router.get("/{tenant_id}", response_model=TenantDetailRead)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    tenant = tenant_service.get_tenant(db, tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"Tenant '{tenant_id}' não encontrado."}},
        )
    return tenant


@router.put("/{tenant_id}", response_model=TenantDetailRead)
def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"Tenant '{tenant_id}' não encontrado."}},
        )
    # Check slug uniqueness if changing
    if data.tenant_slug is not None and data.tenant_slug != tenant.tenant_slug:
        existing = db.exec(select(Tenant).where(Tenant.tenant_slug == data.tenant_slug)).first()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "TENANT_SLUG_ALREADY_EXISTS", "message": f"Tenant slug '{data.tenant_slug}' já existe."}},
            )
    tenant = tenant_service.update_tenant(db, tenant, current_user, data)
    # Reload with decryption
    tenant = tenant_service.get_tenant(db, tenant.id)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"Tenant '{tenant_id}' não encontrado."}},
        )
    tenant_service.delete_tenant(db, tenant)


@router.patch("/{tenant_id}/status", response_model=TenantDetailRead)
def toggle_tenant_status(
    tenant_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "TENANT_NOT_FOUND", "message": f"Tenant '{tenant_id}' não encontrado."}},
        )
    tenant = tenant_service.toggle_tenant_status(db, tenant)
    tenant = tenant_service.get_tenant(db, tenant.id)
    return tenant

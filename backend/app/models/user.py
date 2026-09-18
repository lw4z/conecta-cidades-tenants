from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    full_name: str = ""
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_login_at: Optional[datetime] = Field(default=None)

    created_tenants: list["Tenant"] = Relationship(  # noqa: F821
        back_populates="creator",
        sa_relationship_kwargs={"foreign_keys": "[Tenant.created_by_id]"},
    )
    updated_tenants: list["Tenant"] = Relationship(  # noqa: F821
        back_populates="updater",
        sa_relationship_kwargs={"foreign_keys": "[Tenant.updated_by_id]"},
    )

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlmodel import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, UserRead, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserRead)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.exec(select(User).where(User.username == body.username)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    user.last_login_at = datetime.now(UTC)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    response.set_cookie("access_token", token, httponly=True, samesite="lax")
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"detail": "ok"}


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserRead)
def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.password is not None:
        if not body.current_password or not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required")
        current_user.password_hash = hash_password(body.password)

    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.email is not None:
        current_user.email = body.email

    current_user.updated_at = datetime.now(UTC)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

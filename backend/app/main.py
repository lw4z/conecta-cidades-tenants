from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import select

from app.api.api_keys import router as api_keys_router
from app.api.auth import router as auth_router
from app.api.public import router as public_router
from app.api.tenants import router as tenants_router
from app.core.config import settings
from app.core.database import SessionLocal, create_db_and_tables
from app.core.limiter import limiter
from app.core.security import hash_password
from app.models.user import User
from slowapi.errors import RateLimitExceeded


def _bootstrap_admin() -> None:
    db = SessionLocal()
    try:
        existing = db.exec(select(User).where(User.username == settings.ADMIN_USERNAME)).first()
        if existing is None:
            user = User(
                username=settings.ADMIN_USERNAME,
                email=f"{settings.ADMIN_USERNAME}@localhost",
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                full_name="Administrator",
                is_active=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    _bootstrap_admin()
    yield


app = FastAPI(title="Conecta Cidades Tenants", lifespan=lifespan)

app.state.limiter = limiter
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ERROR_CODES_BY_STATUS = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    404: "TENANT_NOT_FOUND",
    409: "VALIDATION_ERROR",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
}


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    code = ERROR_CODES_BY_STATUS.get(exc.status_code, "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(exc.detail)}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    messages = []
    for err in exc.errors():
        loc = " → ".join(str(x) for x in err.get("loc", []))
        messages.append(f"{loc}: {err.get('msg', '')}")
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "; ".join(messages)}},
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Muitas tentativas. Aguarde um momento."}},
    )


app.include_router(auth_router)
app.include_router(tenants_router)
app.include_router(api_keys_router)
app.include_router(public_router)

# SPA: serve static assets + index.html catch-all for client-side routes
from fastapi.responses import FileResponse

static_dir = Path(__file__).parent / "static"


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str):
    # Try serving actual file (JS, CSS, images, favicon)
    file_path = static_dir / full_path
    if full_path and file_path.is_file():
        return FileResponse(str(file_path))
    # Fallback to index.html for SPA routes
    return FileResponse(str(static_dir / "index.html"))

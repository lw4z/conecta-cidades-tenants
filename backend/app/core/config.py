from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "change-me"
    FIELD_ENCRYPTION_KEY: str = "XrmQ9n3-P4dg9zkuVrHxMrZA2LpiYFu8myHKSzfVbXI="
    TENANTS_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./conecta_tenants.db"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: str = "http://localhost:5173"
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

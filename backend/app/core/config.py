from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

# backend/.env, found by absolute path so the app starts from any working directory
# (a bare ".env" is relative to where uvicorn is launched, e.g. the repo root).
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """App settings, read from environment variables (or backend/.env).

    The database settings and JWT_SECRET have no defaults on purpose: the app refuses to
    start without them rather than silently running with an insecure value.
    """

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    # Either one DATABASE_URL, or the separate DATABASE_* parts below (the URL wins if both are set).
    database_url: str | None = Field(None, alias="DATABASE_URL")
    database_user: str | None = Field(None, alias="DATABASE_USER")
    database_password: str | None = Field(None, alias="DATABASE_PASSWORD")
    database_host: str = Field("localhost", alias="DATABASE_HOST")
    database_port: int = Field(3306, alias="DATABASE_PORT")
    database_name: str | None = Field(None, alias="DATABASE_NAME")
    jwt_secret: str = Field(..., alias="JWT_SECRET", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(60 * 24 * 7, alias="ACCESS_TOKEN_MINUTES")

    # Comma-separated list, e.g. "http://localhost:5173,https://kelu.lk"
    cors_origins: str = Field("http://localhost:5173", alias="CORS_ORIGINS")
    # Set to true in production (HTTPS only). Off locally so the cookie works on http://localhost.
    cookie_secure: bool = Field(False, alias="COOKIE_SECURE")

    trial_days: int = 14

    # Google sign-in. The OAuth *client ID* (not a secret) from Google Cloud Console.
    # Unset = the Google button stays hidden and /auth/google answers 503.
    google_client_id: str | None = Field(None, alias="GOOGLE_CLIENT_ID")

    # Outgoing email (password-reset codes). Unset SMTP_HOST = dev mode: the email is
    # written to the server console instead of being sent. Never leave it unset in production.
    smtp_host: str | None = Field(None, alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT")
    smtp_user: str | None = Field(None, alias="SMTP_USER")
    smtp_password: str | None = Field(None, alias="SMTP_PASSWORD")
    smtp_starttls: bool = Field(True, alias="SMTP_STARTTLS")
    mail_from: str = Field("KELU <no-reply@kelu.lk>", alias="MAIL_FROM")

    reset_code_minutes: int = 15
    reset_code_max_attempts: int = 5
    reset_token_minutes: int = 10

    @model_validator(mode="after")
    def _build_database_url(self) -> "Settings":
        if self.database_url:
            return self
        if not (self.database_user and self.database_name):
            raise ValueError("Set DATABASE_URL, or DATABASE_USER + DATABASE_NAME (+ DATABASE_PASSWORD/HOST/PORT)")
        # URL.create escapes special characters (@ : / #) in the password for us.
        self.database_url = URL.create(
            "mysql+pymysql",
            username=self.database_user,
            password=self.database_password,
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

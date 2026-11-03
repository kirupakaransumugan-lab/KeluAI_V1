import re
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import BCRYPT_MAX_BYTES
from app.models.user import Medium, Role

COLOMBO = ZoneInfo("Asia/Colombo")
# How many years ahead a student may pick for their A/L exam (current year included).
EXAM_YEARS_AHEAD = 3

# Sri Lankan mobile numbers: 07X XXX XXXX locally, +94 7X XXX XXXX internationally.
_MOBILE_RE = re.compile(r"^(?:\+94|94|0)(7\d{8})$")


def normalize_sl_mobile(raw: str) -> str:
    """Return the number in E.164 form (+947XXXXXXXX) or raise ValueError."""
    digits = re.sub(r"[\s\-()]", "", raw)
    match = _MOBILE_RE.match(digits)
    if not match:
        raise ValueError("invalid_mobile")
    return f"+94{match.group(1)}"


def allowed_exam_years() -> range:
    this_year = datetime.now(COLOMBO).year
    return range(this_year, this_year + EXAM_YEARS_AHEAD + 1)


def _lower(v: str) -> str:
    return v.lower()


def _check_password_bytes(v: str) -> str:
    if len(v.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError("password_too_long")
    return v


class StudentProfileFields(BaseModel):
    """What KELU needs from every student, however they sign up (email or Google)."""

    mobile: str
    medium: Medium
    al_exam_year: int
    accept_terms: bool

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v: str) -> str:
        return normalize_sl_mobile(v)

    @field_validator("al_exam_year")
    @classmethod
    def _exam_year(cls, v: int) -> int:
        if v not in allowed_exam_years():
            raise ValueError("invalid_exam_year")
        return v

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("terms_required")
        return v


class RegisterRequest(StudentProfileFields):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("name_too_short")
        return v

    _lower_email = field_validator("email")(_lower)
    _password_bytes = field_validator("password")(_check_password_bytes)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: Role
    medium: Medium | None  # None for admins, who have no student profile
    al_exam_year: int | None
    trial_ends_at: datetime | None


class LoginRequest(BaseModel):
    email: EmailStr
    # No length rules here: login must accept whatever was valid at sign-up time.
    password: str = Field(min_length=1, max_length=256)

    _lower_email = field_validator("email")(_lower)


class AuthResponse(BaseModel):
    user: UserOut


class ProvidersOut(BaseModel):
    google_client_id: str | None


class GoogleSignInRequest(BaseModel):
    # The ID token (a JWT) that Google Identity Services gives the browser.
    credential: str = Field(min_length=1, max_length=4096)
    # Sent only by a first-time Google user, after the API answered "profile_required".
    profile: StudentProfileFields | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    _lower_email = field_validator("email")(_lower)


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")

    _lower_email = field_validator("email")(_lower)


class VerifyResetCodeResponse(BaseModel):
    reset_token: str


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(min_length=1, max_length=2048)
    new_password: str = Field(min_length=8)

    _password_bytes = field_validator("new_password")(_check_password_bytes)

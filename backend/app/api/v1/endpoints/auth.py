from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import ACCESS_COOKIE, get_current_user
from app.core.google_auth import GoogleTokenError, verify_google_id_token
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    GoogleSignInRequest,
    LoginRequest,
    ProvidersOut,
    RegisterRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserOut,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.services import auth_service, email_service, password_reset_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    # httpOnly: page scripts can't read the token, so an XSS bug can't steal it.
    # SameSite=Lax: the browser won't send it on cross-site POSTs (basic CSRF protection).
    response.set_cookie(
        ACCESS_COOKIE,
        create_access_token(user.id, user.role.value),
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = auth_service.register_student(db, data)
    except auth_service.EmailTakenError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail={"code": "email_taken", "field": "email"}
        ) from None
    _set_session_cookie(response, user)
    return AuthResponse(user=auth_service.to_user_out(user))


def _refuse_disabled(user) -> None:
    # Only after the password (or Google) check, so it can't reveal which emails exist.
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "account_disabled"})


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = auth_service.authenticate(db, data.email, data.password)
    if user is None:
        # Same answer for "no such email" and "wrong password", so it can't be used
        # to discover which emails have accounts.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "invalid_credentials"})
    _refuse_disabled(user)
    _set_session_cookie(response, user)
    return AuthResponse(user=auth_service.to_user_out(user))


@router.get("/providers", response_model=ProvidersOut)
def providers() -> ProvidersOut:
    """Which social logins are switched on, so the frontend needs no extra config."""
    return ProvidersOut(google_client_id=get_settings().google_client_id)


@router.post("/google", response_model=AuthResponse)
def google(data: GoogleSignInRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    client_id = get_settings().google_client_id
    if not client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "google_disabled"})
    try:
        identity = verify_google_id_token(data.credential, client_id)
    except GoogleTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "google_invalid"}) from None

    try:
        user = auth_service.google_sign_in(db, identity, data.profile)
    except auth_service.ProfileRequiredError as exc:
        # 428: "send this again with a profile". The frontend shows a short form,
        # prefilled with what Google told us, then resends the same credential.
        raise HTTPException(
            status.HTTP_428_PRECONDITION_REQUIRED,
            detail={"code": "profile_required", "full_name": exc.identity.full_name, "email": exc.identity.email},
        ) from None
    except auth_service.EmailTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "email_taken"}) from None
    _refuse_disabled(user)
    _set_session_cookie(response, user)
    return AuthResponse(user=auth_service.to_user_out(user))


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    data: ForgotPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)
) -> dict[str, str]:
    result = password_reset_service.request_code(db, data.email)
    if result:
        user, code = result
        subject, body = password_reset_service.reset_email(user, code)
        background.add_task(email_service.send_email, user.email, subject, body)
    # Identical answer whether or not the email has an account (no account discovery).
    return {"status": "sent_if_exists"}


@router.post("/password/verify", response_model=VerifyResetCodeResponse)
def verify_reset_code(data: VerifyResetCodeRequest, db: Session = Depends(get_db)) -> VerifyResetCodeResponse:
    try:
        token = password_reset_service.verify_code(db, data.email, data.code)
    except password_reset_service.InvalidCodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": "invalid_code", "field": "code"}) from None
    return VerifyResetCodeResponse(reset_token=token)


@router.post("/password/reset", response_model=AuthResponse)
def reset_password(data: ResetPasswordRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = password_reset_service.reset_password(db, data.reset_token, data.new_password)
    except password_reset_service.InvalidResetTokenError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": "reset_expired"}) from None
    # Fresh session for this browser; every older session is now rejected.
    _set_session_cookie(response, user)
    return AuthResponse(user=auth_service.to_user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return auth_service.to_user_out(user)


@router.patch("/me", response_model=UserOut)
def update_me(data: UpdateProfileRequest, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)) -> UserOut:
    return auth_service.to_user_out(auth_service.update_profile(db, user, data))


@router.post("/password/change", response_model=AuthResponse)
def change_password(data: ChangePasswordRequest, response: Response, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)) -> AuthResponse:
    try:
        auth_service.change_password(db, user, data.current_password, data.new_password)
    except auth_service.WrongPasswordError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail={"code": "wrong_password", "field": "current_password"}) from None
    # Other sessions are now rejected; this browser gets a fresh one.
    _set_session_cookie(response, user)
    return AuthResponse(user=auth_service.to_user_out(user))


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(data: DeleteAccountRequest, response: Response, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)) -> None:
    try:
        auth_service.delete_account(db, user, data.confirm_email, data.password)
    except auth_service.AdminAccountError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "admin_account"}) from None
    except auth_service.ConfirmationMismatchError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail={"code": "confirm_mismatch", "field": "confirm_email"}) from None
    except auth_service.WrongPasswordError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            detail={"code": "wrong_password", "field": "password"}) from None
    response.delete_cookie(ACCESS_COOKIE, path="/api")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/api")

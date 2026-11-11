"""Microsoft sign-in: check the ID token MSAL.js gets in the browser (personal Microsoft
accounts and work/school accounts, via the multi-tenant "common" endpoint)."""
from functools import lru_cache

import jwt

from app.core.social_identity import SocialIdentity

MICROSOFT_KEYS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
# Every personal Microsoft account (Outlook, Hotmail, Live) belongs to this one tenant.
CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"


class MicrosoftTokenError(Exception):
    pass


class MicrosoftEmailUnverified(MicrosoftTokenError):
    """A valid token, but Microsoft doesn't vouch for its email (some work/school accounts)."""


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(MICROSOFT_KEYS_URL, cache_keys=True)


def verify_microsoft_id_token(credential: str, client_id: str) -> SocialIdentity:
    """Signature, expiry, audience and issuer are verified. The issuer depends on the account's
    tenant, so it is checked against the token's own `tid` (the signature covers both).

    The email must be verified, because an existing KELU account with that email gets linked.
    A work/school tenant admin can put any address in a user's `email` claim; trusting that is
    how "nOAuth" account takeovers happen. Microsoft verifies the emails of personal accounts,
    and marks verified domains on work accounts with the optional `xms_edov` claim.
    """
    try:
        key = _jwks().get_signing_key_from_jwt(credential).key
        claims = jwt.decode(credential, key, algorithms=["RS256"], audience=client_id,
                            options={"require": ["exp", "iss", "aud", "sub", "tid"]})
    except jwt.PyJWTError as exc:
        raise MicrosoftTokenError(str(exc)) from None

    tid = claims["tid"]
    if claims["iss"] != f"https://login.microsoftonline.com/{tid}/v2.0":
        raise MicrosoftTokenError("wrong issuer")

    personal = tid == CONSUMER_TENANT
    email = claims.get("email") or (claims.get("preferred_username") if personal else None)
    verified = personal or claims.get("xms_edov") in (True, 1, "1", "true", "True")
    if not email or "@" not in email or not verified:
        raise MicrosoftEmailUnverified("no verified email")
    email = email.strip().lower()
    return SocialIdentity(sub=claims["sub"], email=email, full_name=claims.get("name") or email.split("@")[0])

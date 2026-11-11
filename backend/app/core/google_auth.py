from functools import lru_cache

import jwt

from app.core.social_identity import SocialIdentity

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"]


class GoogleTokenError(Exception):
    pass


GoogleIdentity = SocialIdentity   # the name the Google code and its tests have always used


@lru_cache
def _jwks() -> jwt.PyJWKClient:
    # Caches Google's public keys; refetches when a token names a key it hasn't seen.
    return jwt.PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True)


def verify_google_id_token(credential: str, client_id: str) -> GoogleIdentity:
    """Check the ID token from Google Identity Services and return who it belongs to.

    Signature, expiry, issuer and audience are all verified: the audience check is what
    stops a token minted for some other website from logging in here.
    """
    try:
        key = _jwks().get_signing_key_from_jwt(credential).key
        claims = jwt.decode(credential, key, algorithms=["RS256"], audience=client_id, issuer=GOOGLE_ISSUERS)
    except jwt.PyJWTError as exc:
        raise GoogleTokenError(str(exc)) from None

    if not claims.get("email") or claims.get("email_verified") is not True:
        raise GoogleTokenError("email not verified")
    email = claims["email"].lower()
    return GoogleIdentity(sub=claims["sub"], email=email, full_name=claims.get("name") or email.split("@")[0])

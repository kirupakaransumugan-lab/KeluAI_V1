from dataclasses import dataclass


@dataclass(frozen=True)
class SocialIdentity:
    """Who a verified Google or Microsoft ID token belongs to. `email` is always one the
    provider has verified the person owns: account linking by email depends on it."""

    sub: str            # the provider's stable id for this person (emails can change; this can't)
    email: str
    full_name: str

"""Server-side admin tasks that must not be reachable over HTTP.

    python -m app.manage make-admin student@example.com

Run from backend/ so .env is found. The account must already exist (sign up
first); after that, this admin can promote others via PATCH /api/v1/admin/users/{id}/role.
"""
import argparse
import sys

from app.core.database import SessionLocal
from app.models.user import Role
from app.repositories import user_repository


def make_admin(email: str) -> None:
    with SessionLocal() as db:
        user = user_repository.get_by_email(db, email)
        if user is None:
            sys.exit(f"No account with email {email}. Sign up first, then run this again.")
        user.role = Role.admin
        db.commit()
        print(f"{user.email} (id {user.id}) is now an admin.")


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.manage")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("make-admin", help="promote an existing account to admin")
    sp.add_argument("email")
    args = ap.parse_args()
    if args.cmd == "make-admin":
        make_admin(args.email)


if __name__ == "__main__":
    main()

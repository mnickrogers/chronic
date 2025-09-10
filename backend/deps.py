from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.orm import Session

from .db import SessionLocal
from .auth import decode_token
from .models import User, Organization, OrgMembership


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias="access_token"),
):
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    payload = decode_token(access_token, scope="access")
    user_id = payload.get("sub")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_org(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # For v1 dev: the first org the user belongs to
    mem = db.query(OrgMembership).filter(OrgMembership.user_id == user.id).first()
    if not mem:
        raise HTTPException(status_code=400, detail="User not in an organization")
    org = db.get(Organization, mem.org_id)
    return org


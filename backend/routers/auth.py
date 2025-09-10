from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..db import engine
from ..models import Base, User, Organization, OrgMembership
from ..schemas import AuthSignupIn, AuthLoginIn, UserOut, OrganizationOut, SessionOut
from ..auth import hash_password, verify_password, create_token
from ..deps import get_db, get_current_user, get_current_org


router = APIRouter(prefix="/auth", tags=["auth"])


# Tables are created via Alembic migrations; no auto-create here.


@router.post("/signup", response_model=SessionOut)
def signup(data: AuthSignupIn, response: Response, db: Session = Depends(get_db)):
    exists = db.execute(select(User).where(User.email == data.email.lower())).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Email already in use")

    user = User(email=data.email.lower(), password_hash=hash_password(data.password), display_name=data.display_name)
    db.add(user)
    # Create personal org (dev)
    org = Organization(name=f"{data.display_name.split(' ')[0]}'s Org", primary_domain=None)
    db.add(org)
    db.flush()
    db.add(OrgMembership(org_id=org.id, user_id=user.id, role="owner"))
    db.commit()

    access = create_token(user.id, scope="access")
    response.set_cookie("access_token", access, httponly=True, samesite="lax")
    return SessionOut(user=user, org=org)


@router.post("/login", response_model=SessionOut)
def login(data: AuthLoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == data.email.lower())).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    # pick first org membership
    mem = db.execute(select(OrgMembership).where(OrgMembership.user_id == user.id)).scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=400, detail="User not in org")
    org = db.get(Organization, mem.org_id)
    access = create_token(user.id, scope="access")
    response.set_cookie("access_token", access, httponly=True, samesite="lax")
    return SessionOut(user=user, org=org)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}


@router.get("/me", response_model=SessionOut)
def me(user: User = Depends(get_current_user), org: Organization = Depends(get_current_org)):
    return SessionOut(user=user, org=org)

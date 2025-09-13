from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from ..db import engine
from ..models import Base, User, Organization, OrgMembership
from ..schemas import AuthSignupIn, AuthLoginIn, UserOut, OrganizationOut, SessionOut, MeUpdateIn
from ..auth import hash_password, verify_password, create_token
from ..deps import get_db, get_current_user, get_current_org


router = APIRouter(prefix="/auth", tags=["auth"])


# Tables are created via Alembic migrations; no auto-create here.


@router.post("/signup", response_model=SessionOut)
def signup(data: AuthSignupIn, response: Response, db: Session = Depends(get_db)):
    exists = db.execute(select(User).where(User.email == data.email.lower())).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Email already in use")

    display_name = f"{data.first_name} {data.last_name}".strip()
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        display_name=display_name or data.first_name or data.last_name or data.email.split('@')[0],
    )
    db.add(user)
    # Create personal org (dev)
    # Use first name for default org label where available
    org_label = (data.first_name or display_name or data.email.split('@')[0]).split(' ')[0]
    org = Organization(name=f"{org_label}'s Org", primary_domain=None)
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


@router.patch("/me", response_model=UserOut)
def update_me(
    data: MeUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    updated = False
    # Back-compat: allow display_name only updates
    if data.display_name is not None and (data.first_name is None and data.last_name is None):
        user.display_name = data.display_name
        # Opportunistically parse into first/last
        parts = [p for p in (data.display_name or '').strip().split(' ') if p]
        user.first_name = parts[0] if parts else user.first_name
        user.last_name = ' '.join(parts[1:]) if len(parts) > 1 else user.last_name
        updated = True

    if data.first_name is not None:
        user.first_name = data.first_name
        updated = True
    if data.last_name is not None:
        user.last_name = data.last_name
        updated = True

    # Theme update (validated by schema Literal)
    if data.theme is not None and data.theme != user.theme:
        user.theme = data.theme
        updated = True

    if updated:
        # Keep display_name in sync when either piece changed
        fn = (user.first_name or '').strip()
        ln = (user.last_name or '').strip()
        combined = f"{fn} {ln}".strip()
        user.display_name = combined or user.display_name
        db.add(user)
        db.commit()
        db.refresh(user)
    return UserOut.model_validate(user)

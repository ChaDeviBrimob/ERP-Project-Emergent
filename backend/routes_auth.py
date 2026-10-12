from datetime import timedelta
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr
import jwt
import os
from core import (db, NO_ID, now, now_iso, new_id, hash_password, verify_password, create_token,
                  public_user, get_current_user, require_admin)

router = APIRouter(prefix="/api")
COOKIE = dict(httponly=True, secure=True, samesite="none", path="/")
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleIn(BaseModel):
    session_id: str


class UserIn(BaseModel):
    email: EmailStr
    name: str
    role: str = "staff"
    password: Optional[str] = None


class UserPatch(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


def set_jwt_cookies(response: Response, user_id: str) -> str:
    access = create_token(user_id, "access", timedelta(hours=1))
    refresh = create_token(user_id, "refresh", timedelta(days=7))
    response.set_cookie("access_token", access, max_age=3600, **COOKIE)
    response.set_cookie("refresh_token", refresh, max_age=604800, **COOKIE)
    return access


@router.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident}, NO_ID)
    if att and att.get("count", 0) >= 5 and att.get("locked_until", "") > now_iso():
        raise HTTPException(429, "Terlalu banyak percobaan. Coba lagi 15 menit lagi.")
    user = await db.users.find_one({"email": email}, NO_ID)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        count = (att or {}).get("count", 0) + 1
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$set": {"count": count, "locked_until": (now() + timedelta(minutes=15)).isoformat()}},
            upsert=True)
        raise HTTPException(401, "Email atau password salah")
    if not user.get("active", True):
        raise HTTPException(403, "Akun dinonaktifkan. Hubungi Admin.")
    await db.login_attempts.delete_one({"identifier": ident})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login": now_iso()}})
    token = set_jwt_cookies(response, user["user_id"])
    return {"user": public_user(user), "token": token}


@router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Tidak ada refresh token")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Refresh token tidak valid")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Token salah")
    access = create_token(payload["sub"], "access", timedelta(hours=1))
    response.set_cookie("access_token", access, max_age=3600, **COOKIE)
    return {"ok": True}


@router.post("/auth/google/session")
async def google_session(body: GoogleIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Sesi Google tidak valid")
    data = r.json()
    user = await db.users.find_one({"email": data["email"].lower()}, NO_ID)
    if not user or not user.get("active", True):
        raise HTTPException(403, "Email Google ini belum terdaftar. Minta Admin menambahkan akun Anda.")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": data.get("picture")}})
    await db.user_sessions.insert_one({
        "user_id": user["user_id"], "session_token": data["session_token"],
        "expires_at": now() + timedelta(days=7), "created_at": now()})
    response.set_cookie("session_token", data["session_token"], max_age=604800, **COOKIE)
    user["picture"] = data.get("picture")
    return {"user": public_user(user), "token": data["session_token"]}


@router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/", secure=True, samesite="none")
    return {"ok": True}


@router.get("/users")
async def list_users(_=Depends(require_admin)):
    users = await db.users.find({}, NO_ID).sort("created_at", 1).to_list(500)
    return [public_user(u) for u in users]


@router.post("/users")
async def create_user(body: UserIn, _=Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if body.role not in ("admin", "staff"):
        raise HTTPException(400, "Role tidak valid")
    doc = {"user_id": new_id("user"), "email": email, "name": body.name, "role": body.role,
           "active": True, "picture": None, "created_at": now_iso(),
           "password_hash": hash_password(body.password) if body.password else ""}
    await db.users.insert_one(doc)
    return public_user(doc)


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserPatch, admin=Depends(require_admin)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "password"}
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, "Password minimal 6 karakter")
        upd["password_hash"] = hash_password(body.password)
        upd["password_updated_at"] = now_iso()
    if "email" in upd:
        upd["email"] = upd["email"].lower()
        if await db.users.find_one({"email": upd["email"], "user_id": {"$ne": user_id}}):
            raise HTTPException(400, "Email sudah dipakai user lain")
    if user_id == admin["user_id"] and (upd.get("active") is False or upd.get("role") == "staff"):
        raise HTTPException(400, "Tidak bisa menonaktifkan/menurunkan akun sendiri")
    await db.users.update_one({"user_id": user_id}, {"$set": upd})
    u = await db.users.find_one({"user_id": user_id}, NO_ID)
    if not u:
        raise HTTPException(404, "User tidak ditemukan")
    return public_user(u)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    if user_id == admin["user_id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"ok": True}

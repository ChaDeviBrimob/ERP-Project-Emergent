import os
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_ALGORITHM = "HS256"
NO_ID = {"_id": 0}


def now():
    return datetime.now(timezone.utc)


def now_iso():
    return now().isoformat()


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bool(h) and bcrypt.checkpw(p.encode(), h.encode())


def create_token(user_id: str, kind: str, delta: timedelta) -> str:
    payload = {"sub": user_id, "type": kind, "exp": now() + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("user_id", "email", "name", "role", "picture", "active", "created_at")}


async def _user_from_session(token: str):
    s = await db.user_sessions.find_one({"session_token": token}, NO_ID)
    if not s:
        return None
    exp = s["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now():
        return None
    return await db.users.find_one({"user_id": s["user_id"]}, NO_ID)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    session_token = request.cookies.get("session_token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = token or auth[7:]
        session_token = session_token or auth[7:]
    user = None
    if token:
        try:
            payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = await db.users.find_one({"user_id": payload["sub"]}, NO_ID)
        except jwt.InvalidTokenError:
            user = None
    if not user and session_token:
        user = await _user_from_session(session_token)
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    return public_user(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Hanya Admin")
    return user


async def notify(kind: str, title: str, message: str, link: str = ""):
    await db.notifications.insert_one({
        "id": new_id("ntf"), "type": kind, "title": title, "message": message,
        "link": link, "read": False, "created_at": now_iso(),
    })

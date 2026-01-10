from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from pydantic import BaseModel
from app_logger.logger import log_event
from fastapi import Request
from time import time

from .mongo import users_collection
from auth.mongo import api_keys_collection
from .auth_utils import (
    hash_password,
    verify_password,
    create_session,
    get_current_user,
    calculate_session_duration,
    _session_key,
    redis_client
)
from auth.api_key_utils import generate_api_key, hash_api_key
from bson import ObjectId



router = APIRouter()

# ===== REQUEST SCHEMAS =====
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str

# ===== REGISTER =====
@router.post("/register")
def register(data: RegisterRequest):
    log_event("logs_auth", {
        "event": "registration_attempt",
        "username": data.username,
        "email": data.email,
        "ip": "unknown",  # Will be filled from request object
        "timestamp": int(time())
    })
    
    if users_collection.find_one({
        "$or": [{"username": data.username}, {"email": data.email}]
    }):
        log_event("logs_auth", {
            "event": "registration_failed_duplicate",
            "username": data.username,
            "email": data.email,
            "reason": "user_already_exists"
        })
        raise HTTPException(400, "User already exists")

    user_doc = {
        "username": data.username,
        "email": data.email,
        "password": hash_password(data.password),
        "upload_limit": 50, # Default limit
        "created_at": int(time())
    }

    user_id = users_collection.insert_one(user_doc).inserted_id

    # 🔐 AUTO-GENERATE API KEY (FORMAT BASED)
    raw_key = generate_api_key(
        user_id=str(user_id),
        username=data.username
    )

    api_keys_collection.insert_one({
        "user_id": str(user_id),
        "raw_key": raw_key,          # 👈 REAL API KEY
        "key_hash": hash_api_key(raw_key),
        "active": False,             # ❗ INACTIVE
        "created_at": int(time()),
        "activated_at": None,
        "last_used_at": None
    })


    log_event("logs_auth", {
        "event": "registration_success",
        "user_id": str(user_id),
        "username": data.username,
        "email": data.email,
        "api_key_generated": True,
        "api_key_active": False
    })

    return {
        "message": "Account created successfully",
        "api_key": raw_key,
        "note": "API key is inactive. Contact admin for activation."
    }

# ===== LOGIN =====
@router.post("/login")
def login(
    data: LoginRequest,
    request: Request,
    response: Response
):

    log_event("logs_auth", {
        "event": "login_attempt",
        "identifier": data.identifier,
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "timestamp": int(time())
    })

    user = users_collection.find_one({"$or": [{"email": data.identifier}, {"username": data.identifier}]})

    if not user or not verify_password(data.password, user["password"]):
        log_event("logs_auth", {
            "event": "login_failed",
            "identifier": data.identifier,
            "ip": request.client.host,
            "user_agent": request.headers.get("user-agent"),
            "reason": "invalid_credentials"
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_id = create_session(str(user["_id"]))

    # HTTP-only cookie (SECURE)
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",   # 🔥 REQUIRED
        secure=False       # 🔥 for localhost ONLY
    )

    log_event("logs_auth", {
        "event": "login_success",
        "user_id": str(user["_id"]),
        "username": user["username"],
        "session_id": session_id,
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "timestamp": int(time())
    })
    return {"message": "Login successful"}

# ===== LOGOUT =====

@router.post("/logout")
def logout(response: Response, session_id: str = Cookie(None)):
    log_event("logs_auth", {
        "event": "logout_attempt",
        "session_id": session_id,
        "timestamp": int(time())
    })
    
    if not session_id:
        log_event("logs_auth", {
            "event": "logout_no_session",
            "reason": "no_session_cookie",
            "timestamp": int(time())
        })
        return {"message": "Already logged out"}

    key = _session_key(session_id)
    data = redis_client.hgetall(key)
    user_id = data.get("user_id") if data else None

    duration = calculate_session_duration(session_id)

    redis_client.delete(key)
    response.delete_cookie("session_id")

    log_event("logs_auth", {
        "event": "logout_success",
        "user_id": user_id,
        "session_id": session_id,
        "session_duration_sec": duration,
        "timestamp": int(time())
    })

    return {"message": "Logged out"}


# 🔐 PROTECTED CHECK (KEEP IT HERE)
@router.get("/protected")
def protected(user_id=Depends(get_current_user)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {"message": "You are logged in", "user_id": user_id}
# ----------------------------------
# ----------Profile of USER-------
# ---------------------------------
@router.get("/me")
def get_profile(user_id=Depends(get_current_user)):
    log_event("logs_auth", {
        "event": "profile_access_attempt",
        "user_id": user_id,
        "timestamp": int(time())
    })

    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = users_collection.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    api_key_doc = api_keys_collection.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )

    profile_data = {
        "username": user["username"],
        "email": user["email"],
        "is_admin": user.get("is_admin", False),
        "upload_limit": user.get("upload_limit", 0),

        # SAFE ACCESS
        "api_key": api_key_doc.get("raw_key") if api_key_doc else None,
        "api_key_active": api_key_doc.get("active", False) if api_key_doc else False,
        "api_key_created_at": api_key_doc.get("created_at") if api_key_doc else None
    }

    log_event("logs_auth", {
        "event": "profile_access_success",
        "user_id": user_id,
        "api_key_present": bool(profile_data["api_key"]),
        "api_key_active": profile_data["api_key_active"],
        "timestamp": int(time())
    })

    return profile_data

from passlib.context import CryptContext
import redis
import uuid
import hashlib
import time
from fastapi import Cookie

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Redis (Docker service name = redis)
redis_client = redis.Redis(host="redis", port=6379, decode_responses=True)

SESSION_TTL = 3600  # 1 hour

# ---------------------------
# REDIS HELPERS
# ---------------------------
def _session_key(session_id: str) -> str:
    return f"session:{session_id}"

# ---------------------------
# AUTH HELPERS
# ---------------------------

def hash_password(password: str) -> str:
    sha = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.hash(sha)


def verify_password(password: str, hashed: str) -> bool:
    sha = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.verify(sha, hashed)


# ---------------------------
# SESSION MANAGEMENT
# ---------------------------

def create_session(user_id: int):
    session_id = str(uuid.uuid4())
    now = int(time.time())

    key = _session_key(session_id)

    redis_client.hset(
        key,
        mapping={
            "user_id": user_id,
            "login_time": now,
            "last_seen": now
        }
    )
    redis_client.expire(key, SESSION_TTL)

    # Log session creation
    from app_logger.logger import log_event
    log_event("logs_auth", {
        "event": "session_created",
        "session_id": session_id,
        "user_id": str(user_id),
        "timestamp": now
    })

    return session_id

def get_current_user(session_id: str = Cookie(None)):
    from app_logger.logger import log_event
    
    if not session_id:
        log_event("logs_auth", {
            "event": "get_current_user_no_session",
            "reason": "no_session_cookie",
            "timestamp": int(time.time())
        })
        return None

    key = f"session:{session_id}"
    data = redis_client.hgetall(key)

    if not data:
        log_event("logs_auth", {
            "event": "get_current_user_invalid_session",
            "session_id": session_id,
            "reason": "session_not_found",
            "timestamp": int(time.time())
        })
        return None

    now = int(time.time())
    redis_client.hset(key, "last_seen", now)
    redis_client.expire(key, SESSION_TTL)  # sliding session
    
    log_event("logs_auth", {
        "event": "get_current_user_success",
        "session_id": session_id,
        "user_id": data["user_id"],
        "timestamp": now
    })

    return data["user_id"]

def calculate_session_duration(session_id: str) -> int:
    from app_logger.logger import log_event
    
    key = _session_key(session_id)
    data = redis_client.hgetall(key)

    if not data:
        log_event("logs_auth", {
            "event": "session_duration_calculation_failed",
            "session_id": session_id,
            "reason": "session_not_found",
            "timestamp": int(time.time())
        })
        return 0

    login_time = int(data.get("login_time", time.time()))
    duration = int(time.time()) - login_time
    
    log_event("logs_auth", {
        "event": "session_duration_calculated",
        "session_id": session_id,
        "user_id": data.get("user_id"),
        "login_time": login_time,
        "current_time": int(time.time()),
        "duration_sec": duration,
        "timestamp": int(time.time())
    })
    
    return duration

def destroy_session(session_id: str):
    from app_logger.logger import log_event
    
    # Get user_id before deleting session to log it
    key = _session_key(session_id)
    data = redis_client.hgetall(key)
    user_id = data.get("user_id") if data else None
    
    redis_client.delete(key)
    
    log_event("logs_auth", {
        "event": "session_destroyed",
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": int(time.time())
    })


# =========================
# API KEY AUTHENTICATION
# =========================
from fastapi import Header, HTTPException
from auth.mongo import api_keys_collection
from auth.api_key_utils import hash_api_key


def get_user_by_api_key(x_api_key: str = Header(None)):
    """
    Authenticate user by API key header
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    # Hash the provided API key to compare with stored hash
    key_hash = hash_api_key(x_api_key)
    
    # Find the API key document
    api_key_doc = api_keys_collection.find_one({
        "key_hash": key_hash
    })
    
    if not api_key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    if not api_key_doc.get("active", False):
        raise HTTPException(status_code=401, detail="API key is inactive")
    
    # Update last used timestamp
    from time import time
    api_keys_collection.update_one(
        {"_id": api_key_doc["_id"]},
        {"$set": {"last_used_at": int(time())}}
    )
    
    return api_key_doc.get("user_id")

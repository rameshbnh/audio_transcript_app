from fastapi import Depends, HTTPException, Request
from time import time
from auth.mongo import api_keys_collection
from app_logger.logger import log_event
from auth.auth_utils import get_current_user
from auth.api_key_utils import verify_api_key


def require_active_api_key(
    request: Request,
    user_id: str = Depends(get_current_user)
):
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    api_key = request.headers.get("x-api-key")
    if not api_key:
        raise HTTPException(status_code=403, detail="API key required")

    api_key_doc = api_keys_collection.find_one({
        "user_id": user_id,
        "active": True
    })

    if not api_key_doc:
        raise HTTPException(status_code=403, detail="API key inactive or missing")

    # Optional: verify key hash matches
    if not verify_api_key(api_key, api_key_doc["key_hash"]):
        raise HTTPException(status_code=403, detail="Invalid API key")

    # Audit
    api_keys_collection.update_one(
        {"_id": api_key_doc["_id"]},
        {"$set": {"last_used_at": int(time())}}
    )

    log_event("logs_auth", {
        "event": "api_key_validated",
        "user_id": user_id,
        "timestamp": int(time())
    })

    return True

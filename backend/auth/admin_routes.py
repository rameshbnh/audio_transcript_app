from fastapi import APIRouter, Depends, HTTPException
from time import time
from bson import ObjectId

from auth.mongo import users_collection, api_keys_collection, usage_collection, db
from auth.admin_required import admin_required
from auth.auth_utils import redis_client
from app_logger.logger import log_event

router = APIRouter(prefix="/admin", tags=["Admin"])

# =====================================================
# 👥 USERS
# =====================================================

@router.get("/users")
def list_users(admin=Depends(admin_required)):
    log_event("logs_auth", {
        "event": "admin_users_list_accessed",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "timestamp": int(time())
    })
    
    users = []
    for u in users_collection.find({}, {"password": 0}):
        # Get API key status for this user
        api_key_doc = api_keys_collection.find_one({"user_id": str(u["_id"])})
        api_key_active = api_key_doc.get("active") if api_key_doc else False
        
        users.append({
            "id": str(u["_id"]),
            "username": u["username"],
            "email": u["email"],
            "upload_limit": u.get("upload_limit", 0),
            "is_admin": u.get("is_admin", False),
            "api_key_active": api_key_active
        })
        
    log_event("logs_auth", {
        "event": "admin_users_list_returned",
        "admin_user_id": admin["_id"],
        "users_count": len(users),
        "timestamp": int(time())
    })
    
    return users


@router.put("/users/{user_id}/upload-limit")
def update_upload_limit(
    user_id: str,
    limit: int,
    admin=Depends(admin_required)
):
    log_event("logs_auth", {
        "event": "admin_upload_limit_update_requested",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "target_user_id": user_id,
        "new_limit": limit,
        "timestamp": int(time())
    })
    
    res = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"upload_limit": limit}}
    )
    if res.matched_count == 0:
        log_event("logs_auth", {
            "event": "admin_upload_limit_update_failed",
            "admin_user_id": admin["_id"],
            "admin_username": admin["username"],
            "target_user_id": user_id,
            "reason": "user_not_found",
            "timestamp": int(time())
        })
        raise HTTPException(404, "User not found")

    log_event("logs_auth", {
        "event": "admin_upload_limit_updated",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "target_user_id": user_id,
        "new_limit": limit,
        "timestamp": int(time())
    })

    return {"message": "Upload limit updated"}


# =====================================================
# 🔑 API KEYS
# =====================================================

@router.put("/api-keys/{user_id}/activate")
def activate_api_key(user_id: str, admin=Depends(admin_required)):
    log_event("logs_auth", {
        "event": "admin_api_key_activation_requested",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "target_user_id": user_id,
        "timestamp": int(time())
    })
    
    res = api_keys_collection.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "active": True,
                "activated_at": int(time())
            }
        }
    )
    if res.matched_count == 0:
        log_event("logs_auth", {
            "event": "admin_api_key_activation_failed",
            "admin_user_id": admin["_id"],
            "admin_username": admin["username"],
            "target_user_id": user_id,
            "reason": "api_key_not_found",
            "timestamp": int(time())
        })
        raise HTTPException(404, "API key not found")

    log_event("logs_auth", {
        "event": "admin_api_key_activated",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "target_user_id": user_id,
        "timestamp": int(time())
    })

    return {"message": "API key activated"}


@router.put("/api-keys/{user_id}/deactivate")
def deactivate_api_key(user_id: str, admin=Depends(admin_required)):
    log_event("logs_auth", {
        "event": "admin_api_key_deactivation_requested",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "target_user_id": user_id,
        "timestamp": int(time())
    })
    
    res = api_keys_collection.update_one(
        {"user_id": user_id},
        {"$set": {"active": False}}
    )
    
    if res.matched_count == 0:
        log_event("logs_auth", {
            "event": "admin_api_key_deactivation_failed",
            "admin_user_id": admin["_id"],
            "admin_username": admin["username"],
            "target_user_id": user_id,
            "reason": "api_key_not_found",
            "timestamp": int(time())
        })
        raise HTTPException(404, "API key not found")

    log_event("logs_auth", {
        "event": "admin_api_key_deactivated",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "target_user_id": user_id,
        "timestamp": int(time())
    })

    return {"message": "API key deactivated"}


# =====================================================
# 📊 USAGE ANALYTICS (Mongo)
# =====================================================

@router.get("/usage")
def usage_analytics(admin=Depends(admin_required)):
    data = []
    for u in usage_collection.find():
        data.append({
            "user_id": u["user_id"],
            "files_uploaded": u.get("files_uploaded", 0),
            "seconds_processed": u.get("seconds_processed", 0)
        })
    return data


# =====================================================
# 🚦 RATE LIMIT STATS (Redis)
# =====================================================

@router.get("/rate-limits")
def rate_limits(admin=Depends(admin_required)):
    stats = []

    for key in redis_client.scan_iter("session:*"):
        data = redis_client.hgetall(key)
        if not data:
            continue

        stats.append({
            "session": key,
            "user_id": data.get("user_id"),
            "files_uploaded": data.get("files_uploaded", 0),
            "seconds_processed": data.get("seconds_processed", 0),
            "last_seen": data.get("last_seen")
        })

    return stats

@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    admin=Depends(admin_required)
):
    from bson import ObjectId

    # 1️⃣ Ensure user exists
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    # 2️⃣ Delete API keys
    api_keys_collection.delete_many({
        "user_id": user_id
    })

    # 3️⃣ Delete usage stats
    usage_collection.delete_many({
        "user_id": user_id
    })

    # 4️⃣ Delete logs (OPTIONAL but recommended)
    # db.logs_api.delete_many({"data.user_id": user_id})
    # db.logs_auth.delete_many({"data.user_id": user_id})
    db.logs_usage.delete_many({"data.user_id": user_id})

    # 5️⃣ Delete Redis keys
    redis_client.delete(f"upload_limit:{user_id}")
    redis_client.delete(f"stats:{user_id}")

    # 6️⃣ Delete user itself
    users_collection.delete_one({
        "_id": ObjectId(user_id)
    })

    # 7️⃣ Audit log
    log_event("logs_auth", {
        "event": "admin_user_deleted",
        "admin_user_id": admin["_id"],
        "admin_username": admin["username"],
        "deleted_user_id": user_id,
        "deleted_username": user["username"],
        "timestamp": int(time())
    })

    return {
        "message": "User deleted successfully",
        "user_id": user_id
    }

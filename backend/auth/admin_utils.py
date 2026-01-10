from fastapi import Depends, HTTPException
from auth.auth_utils import get_current_user
from auth.mongo import users_collection
from bson import ObjectId

def admin_required(user_id=Depends(get_current_user)):
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("is_admin"):
        raise HTTPException(403, "Admin access required")
    return user

import json
import logging
import time
import uuid
from bson import ObjectId
from datetime import datetime
from contextvars import ContextVar
from auth.mongo import db
import os

# Ensure logs directory exists
os.makedirs("/app/logs", exist_ok=True)


# =====================================================
# LOG FILE CONFIG (Docker + File)
# =====================================================
logger = logging.getLogger("audio-gateway")
logger.setLevel(logging.INFO)
logger.propagate = False

# Console (Docker logs)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# File (JSON logs)
file_handler = logging.FileHandler("/app/logs/App.log.json", mode="a")
file_handler.setLevel(logging.INFO)

formatter = logging.Formatter("%(message)s")
console_handler.setFormatter(formatter)
file_handler.setFormatter(formatter)

if not logger.handlers:
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)


# =====================================================
# REQUEST CONTEXT
# =====================================================
request_id_ctx = ContextVar("request_id", default=None)
request_logs_ctx = ContextVar("request_logs", default=None)

# =====================================================
# HELPERS
# =====================================================
def _format_size(size_bytes):
    if not size_bytes:
        return None
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def _format_time(ts):
    return datetime.fromtimestamp(ts).strftime("%H:%M:%S")


def _mask_api_key(key):
    if not key:
        return None
    return key[:4] + "****" + key[-4:]


def _serialize(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def _sanitize(data):
    if isinstance(data, dict):
        return {k: _sanitize(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_sanitize(i) for i in data]
    return _serialize(data)

# =====================================================
# REQUEST LIFECYCLE
# =====================================================
def start_request():
    rid = str(uuid.uuid4())
    request_id_ctx.set(rid)
    request_logs_ctx.set([])
    return rid


def end_request():
    logs = request_logs_ctx.get() or []
    if not logs:
        return

    first = logs[0]
    last = logs[-1]

    quota_log = next(
        (l for l in logs if l.get("event") == "hourly_upload_quota_check"),
        None
    )
    block_log = next(
        (l for l in logs if l.get("event") == "upload_blocked"),
        None
    )

    print("\n" + "═" * 80)
    print(f"🧾 REQUEST SUMMARY  |  {first.get('method')} {first.get('path')}")
    print("═" * 80)

    print(f"event          : {first.get('event')}")
    print("")
    print(f"request_id     : {first.get('request_id')}")
    print(
        f"time           : "
        f"{_format_time(first['timestamp'])} → {_format_time(last['timestamp'])}"
    )
    print(f"status         : {last.get('status')}")
    print("")
    print(f"ip             : {first.get('ip')}")
    auth_log = next(
    (l for l in logs if l.get("event") == "get_current_user_success"),
    None
    )

    usage_log = next(
        (l for l in logs if l.get("username")),
        None
    )

    user_id = (
        auth_log.get("user_id")
        if auth_log
        else usage_log.get("user_id") if usage_log else None
    )

    username = (
        usage_log.get("username")
        if usage_log
        else None
    )

    print(f"user_id        : {user_id}")
    print(f"username       : {username}")
    print(" ")
    print(f"session_id     : {first.get('session_id')}")
    print(f"api_key        : {_mask_api_key(first.get('api_key'))}")

    upload_log = next(
        (l for l in logs if l.get("event") == "upload_request_received"),
        None
    )
    if upload_log:
        print(
            f"\nfile           : "
            f"{upload_log.get('filename')} "
            f"({_format_size(upload_log.get('file_size'))})"
        )
        print(f"mode           : {upload_log.get('mode')}")

    if quota_log:
        print(
            f"\nquota          : "
            f"{quota_log.get('current_count')} / "
            f"{quota_log.get('hourly_limit')} uploads (hourly)"
        )

    if block_log:
        print(f"blocked        : {block_log.get('reason')}")

    if last.get("duration_ms") is not None:
        ms = last["duration_ms"]
        print(f"duration       : {ms:.2f} ms ({ms/1000:.2f} s)")
    print("═" * 80 + "\n")

# =====================================================
# MAIN LOGGER (USED EVERYWHERE)
# =====================================================
def log_event(collection: str, data: dict):
    safe_data = _sanitize(data)
    ts = time.time()

    # Attach request_id automatically
    request_id = request_id_ctx.get()
    if request_id:
        safe_data["request_id"] = request_id

    log_entry = {
        "collection": collection,
        "data": safe_data,
        "timestamp": ts
    }

    # 1️⃣ MongoDB (stored under App.log collection)
    try:
        db["App.log"].insert_one(log_entry)
    except Exception as e:
        print(f"❌ Mongo log error: {e}")

    # 2️⃣ Per-request aggregation
    logs = request_logs_ctx.get()
    if logs is not None:
        logs.append({**safe_data, "timestamp": ts})
        request_logs_ctx.set(logs)

    # 3️⃣ Pretty Docker console output
    print("\n" + "═" * 80)
    print(f"🧾 LOG EVENT → {collection}")
    print("═" * 80)
    for k, v in safe_data.items():
        print(f"{k:<18}: {v}")
    print("═" * 80)

    # 4️⃣ JSON file logging
    logger.info(json.dumps(log_entry, default=str))


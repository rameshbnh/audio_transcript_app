from fastapi import FastAPI, UploadFile, File, WebSocket, Query, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocketDisconnect
from pathlib import Path
from fastapi.responses import JSONResponse
from auth.auth_routes import router as auth_router
from fastapi import Request
from time import time
from app_logger.logger import log_event
from auth.mongo import db
from datetime import datetime


from auth.auth_utils import get_current_user, redis_client
from auth.mongo import users_collection, transcriptions_collection
from fastapi import Depends, HTTPException
from auth.mongo import api_keys_collection
from auth.api_key_utils import verify_api_key, hash_api_key

from auth.admin_routes import router as admin_router

import httpx
import websockets
import asyncio
import json
import os

TRANSCRIBE_API = os.getenv("TRANSCRIBE_API")
DIARIZE_API    =  os.getenv("DIARIZE_API")
app = FastAPI(title="Audio Gateway API")

# Initialize database indexes on startup
from init_db import init_database
import threading
from time import sleep

def delayed_init():
    # Add a small delay to ensure MongoDB is ready when running in containers
    sleep(2)
    init_database()

# Run the initialization in a separate thread to not block app startup
threading.Thread(target=delayed_init, daemon=True).start()

app.include_router(auth_router)
app.include_router(admin_router)

# -------------------------
# API KEY
# -------------------------

API_KEY = os.getenv("API_KEY")

#-----------------------------
#---ALLOWED ORIGINS--------
#--------------------------
# @app.options("/{path:path}")
# async def preflight_handler(path: str):
#     return JSONResponse(status_code=200)

allowed_origins = [
    "http://10.14.6.51:4000",
    
    "http://lipikar.ai.oac",
    "https://lipikar.ai.oac",

    "http://localhost:4000"
]

# -------------------------
# CORS (allow browser)
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# FILE UPLOAD ENDPOINT
# -------------------------
# Authentication dependency that accepts either session or API key
def get_user_id(
    session_id: str = Cookie(None),
    x_api_key: str = Header(None)
):
    # 1️⃣ Try session-based auth (browser)
    if session_id:
        user_id = get_current_user(session_id)
        if user_id:
            return user_id

    # 2️⃣ Fallback to API key auth (Swagger / CLI)
    if x_api_key:
        api_key_doc = api_keys_collection.find_one({
            "key_hash": hash_api_key(x_api_key),
            "active": True
        })
        if api_key_doc:
            return api_key_doc["user_id"]

    raise HTTPException(401, "Authentication required")



@app.post("/upload")
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    mode: str = Query(..., enum=["transcribe", "diarize"]),
    user_id: str = Depends(get_user_id)
):
    log_event("logs_api", {
        "event": "upload_request_received",
        "user_id": user_id,
        "filename": file.filename,
        "mode": mode,
        "file_size": file.size,
        "timestamp": int(time())
    })

    # -------------------------
    # 🔐 USER AUTH CHECK
    # -------------------------
    if not user_id:
        log_event("logs_api", {
            "event": "upload_unauthorized",
            "reason": "not_logged_in",
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(401, "Login required")

    from auth.mongo import ObjectId
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        log_event("logs_api", {
            "event": "upload_user_not_found",
            "user_id": user_id,
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(404, "User not found")

    # -------------------------
    # 🔑 API KEY VALIDATION  ✅ NEW
    # -------------------------
    api_key = request.headers.get("x-api-key")
    if not api_key:
        log_event("logs_api", {
            "event": "upload_blocked",
            "reason": "missing_api_key",
            "user_id": user_id,
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(403, "API key required")

    api_key_doc = api_keys_collection.find_one({"user_id": user_id})
    if not api_key_doc:
        log_event("logs_api", {
            "event": "upload_blocked",
            "reason": "api_key_not_found",
            "user_id": user_id,
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(403, "Invalid API key")

    if not api_key_doc.get("active", False):
        log_event("logs_api", {
            "event": "upload_blocked",
            "reason": "api_key_inactive",
            "user_id": user_id,
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(403, "API key inactive")

    if not verify_api_key(api_key, api_key_doc["key_hash"]):
        log_event("logs_api", {
            "event": "upload_blocked",
            "reason": "api_key_mismatch",
            "user_id": user_id,
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(403, "Invalid API key")

    # update last-used timestamp
    api_keys_collection.update_one(
        {"_id": api_key_doc["_id"]},
        {"$set": {"last_used_at": int(time())}}
    )

    # -------------------------
    # 🚫 UPLOAD LIMIT CHECK
    # -------------------------
    hourly_key = f"upload_limit:{user_id}"

    current_count = int(redis_client.get(hourly_key) or 0)


    log_event("logs_usage", {
        "event": "hourly_upload_quota_check",
        "user_id": user_id,
        "username": user["username"],
        "current_count": current_count,
        "hourly_limit": user["upload_limit"],
        "timestamp": int(time())
    })

    if current_count >= user["upload_limit"]:
        log_event("logs_usage", {
            "event": "upload_blocked",
            "user_id": str(user["_id"]),
            "username": user["username"],
            "files_uploaded": current_count,
            "upload_limit": user["upload_limit"],
            "reason": "upload_limit_exceeded",
            "filename": file.filename,
            "mode": mode,
            "timestamp": int(time())
        })
        raise HTTPException(403, "Upload limit exceeded")
    
    # -------------------------
    # 🎧 CALL INTERNAL SERVICES
    # -------------------------
    headers = {"x-api-key": API_KEY}
    start_time = time()

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            file_content = await file.read()
            files = {"file": (file.filename, file_content)}

            log_event("logs_api", {
                "event": "calling_internal_service",
                "user_id": str(user["_id"]),
                "username": user["username"],
                "filename": file.filename,
                "mode": mode,
                "service_url": TRANSCRIBE_API if mode == "transcribe" else DIARIZE_API,
                "timestamp": int(time())
            })

            if mode == "transcribe":
                r = await client.post(TRANSCRIBE_API, files=files, headers=headers)
            if mode == "diarize":
                r = await client.post(DIARIZE_API, files=files, headers=headers)

        if r.status_code != 200:
            log_event("logs_api", {
                "event": "internal_service_error",
                "user_id": str(user["_id"]),
                "username": user["username"],
                "filename": file.filename,
                "mode": mode,
                "status_code": r.status_code,
                "error_message": r.text,
                "timestamp": int(time())
            })
            raise HTTPException(500, r.text)

        result = r.json()
        duration = int(time() - start_time)

        # Calculate audio duration from result if available
        audio_duration = 0
        if result and isinstance(result, dict) and "segments" in result:
            segments = result["segments"]
            if segments and isinstance(segments, list):
                # Find the maximum end time among all segments
                max_end_time = 0
                for segment in segments:
                    if isinstance(segment, dict):
                        end_time = segment.get("end", 0)
                        if isinstance(end_time, (int, float)):
                            max_end_time = max(max_end_time, end_time)
                audio_duration = int(max_end_time)

        # Store the transcription/diarization result in MongoDB
        transcription_record = {
            "user_id": str(user["_id"]),
            "username": user["username"],
            "filename": file.filename,
            "mode": mode,
            "result": result,
            "created_at": datetime.utcnow(),
            "processing_duration_sec": duration,  # Duration for processing
            "audio_duration_sec": audio_duration,  # Actual audio duration
            "file_size": file.size
        }
        
        # Insert the record into the transcriptions collection
        transcriptions_collection.insert_one(transcription_record)

        # -------------------------
        # 📊 UPDATE HOURLY UPLOAD LIMIT
        # -------------------------
        hourly_key = f"upload_limit:{user_id}"

        pipe = redis_client.pipeline()
        pipe.incr(hourly_key)
        pipe.expire(hourly_key, 3600)
        pipe.execute()

        # OPTIONAL analytics
        stats_key = f"stats:{user_id}"
        redis_client.hincrby(stats_key, "seconds_processed", duration)

        # -------------------------
        # 🧾 LOG EVENT
        # -------------------------
        log_event("logs_usage", {
            "event": "file_uploaded_success",
            "user_id": user["_id"],
            "username": user["username"],
            "filename": file.filename,
            "mode": mode,
            "duration_sec": duration,
            "result_size": len(str(result)),
            "timestamp": int(time())
        })

        log_event("logs_api", {
            "event": "upload_completed",
            "user_id": str(user["_id"]),
            "username": user["username"],
            "filename": file.filename,
            "mode": mode,
            "processing_time": duration,
            "timestamp": int(time())
        })

        return result


    except Exception as e:
        log_event("logs_api", {
            "event": "upload_processing_error",
            "user_id": str(user["_id"]),
            "username": user["username"],
            "filename": file.filename,
            "mode": mode,
            "error": str(e),
            "timestamp": int(time())
        })
        raise HTTPException(500, f"Processing error: {str(e)}")
# -------------------------
# LIVE WEBSOCKET BRIDGE
# -------------------------
@app.websocket("/ws/diarize")
async def websocket_diarize(
    ws: WebSocket,
    api_key: str = Query(None)
):
    log_event("logs_api", {
        "event": "websocket_connection_attempt",
        "client_host": ws.client.host,
        "client_port": ws.client.port,
        "api_key_provided": api_key is not None,
        "timestamp": int(time())
    })
    
    if api_key != os.getenv("API_KEY"):
        log_event("logs_api", {
            "event": "websocket_auth_failed",
            "client_host": ws.client.host,
            "reason": "invalid_api_key",
            "timestamp": int(time())
        })
        await ws.close(code=1008)
        return

    await ws.accept()
    
    log_event("logs_api", {
        "event": "websocket_connected",
        "client_host": ws.client.host,
        "client_port": ws.client.port,
        "timestamp": int(time())
    })

    backend_ws_url = (
        f"{DIARIZE_API.replace('http', 'ws')}/ws/diarize"
        f"?api_key={API_KEY}"
    )


    try:
        async with websockets.connect(backend_ws_url, max_size=None) as backend_ws:
            log_event("logs_api", {
                "event": "backend_websocket_connected",
                "backend_url": backend_ws_url,
                "timestamp": int(time())
            })
            
            while True:
                # 1️⃣ Receive audio from browser
                data = await ws.receive_bytes()
                
                log_event("logs_api", {
                    "event": "audio_data_received",
                    "data_size": len(data),
                    "timestamp": int(time())
                })

                # 2️⃣ Send audio to WhisperX
                await backend_ws.send(data)

                # 3️⃣ Receive JSON result from WhisperX
                result = await backend_ws.recv()   # JSON string

                # 4️⃣ Forward JSON to browser (IMPORTANT)
                await ws.send_json(
                    json.loads(result)
                )
                
                log_event("logs_api", {
                    "event": "result_forwarded_to_client",
                    "result_size": len(result),
                    "timestamp": int(time())
                })

    except WebSocketDisconnect:
        log_event("logs_api", {
            "event": "websocket_disconnected",
            "client_host": ws.client.host,
            "reason": "client_disconnected",
            "timestamp": int(time())
        })
        print("Browser disconnected")

    except Exception as e:
        log_event("logs_api", {
            "event": "websocket_error",
            "client_host": ws.client.host,
            "error": str(e),
            "timestamp": int(time())
        })
        print("WS bridge error:", e)

    finally:
        log_event("logs_api", {
            "event": "websocket_closed",
            "client_host": ws.client.host,
            "timestamp": int(time())
        })
        await ws.close()

from app_logger.logger import start_request, end_request  # ✅ ADD THIS

# -------------------------
# FETCH USER HISTORY
# -------------------------
@app.get("/history")
async def get_user_history(user_id: str = Depends(get_user_id)):
    # Find all successful transcription/diarization records for this user
    history_records = transcriptions_collection.find({
        "user_id": user_id
    }).sort("created_at", -1).limit(50)  # Last 50 entries, newest first
    
    history = []
    for record in history_records:
        history.append({
            "id": str(record["_id"]),
            "filename": record.get("filename"),
            "mode": record.get("mode"),
            "timestamp": int(record["created_at"].timestamp()),
            "processing_duration": record.get("processing_duration_sec"),
            "audio_duration": record.get("audio_duration_sec"),
            "size": record.get("file_size")
        })
    
    return history

# -------------------------
# FETCH TRANSCRIPTION RESULT
# -------------------------
@app.get("/transcription/{transcription_id}")
async def get_transcription_result(transcription_id: str, user_id: str = Depends(get_user_id)):
    from auth.mongo import ObjectId
    try:
        # Convert string ID to ObjectId
        obj_id = ObjectId(transcription_id)
        
        # Find the transcription record for this user
        record = transcriptions_collection.find_one({
            "_id": obj_id,
            "user_id": user_id
        })
        
        if not record:
            raise HTTPException(status_code=404, detail="Transcription not found")
        
        # Return the result data
        return {
            "id": str(record["_id"]),
            "filename": record.get("filename"),
            "mode": record.get("mode"),
            "result": record.get("result"),
            "created_at": record["created_at"],
            "processing_duration": record.get("processing_duration_sec"),
            "audio_duration": record.get("audio_duration_sec")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid transcription ID")

@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    # 🚫 Skip OPTIONS (CORS noise)
    if request.method == "OPTIONS":
        return await call_next(request)

    request_id = start_request()
    start = time()

    # ✅ Attach to request.state
    request.state.request_id = request_id
    request.state.start_time = start

    session_id = request.cookies.get("session_id")
    api_key = request.headers.get("x-api-key")
    masked_api_key = (
        api_key[:4] + "****" + api_key[-4:]
        if api_key and len(api_key) > 8
        else None
    )

    log_event("logs_api", {
        "event": "request_received",
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent"),
        "session_id": session_id,
        "api_key": masked_api_key,
        "timestamp": int(start)
    })

    try:
        response = await call_next(request)
        duration_ms = round((time() - start) * 1000, 2)

        log_event("logs_api", {
            "event": "request_completed",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "ip": request.client.host,
            "duration_ms": duration_ms,
            "timestamp": int(time())
        })

        response.headers["X-Request-ID"] = request_id
        return response

    except Exception as e:
        duration_ms = round((time() - start) * 1000, 2)

        log_event("logs_api", {
            "event": "request_error",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "error": str(e),
            "ip": request.client.host,
            "duration_ms": duration_ms,
            "timestamp": int(time())
        })
        raise

    finally:
        # ✅ THIS IS THE MISSING PIECE
        end_request()

from pymongo import MongoClient
from bson import ObjectId

client = MongoClient("mongodb://audio-gateway-mongodb:27017")

db = client["audio_gateway"]

users_collection = db["users"]
sessions_collection = db["sessions"]
logs_collection = db["logs"]
api_keys_collection = db["api_keys"]
usage_collection = db["usage"]
transcriptions_collection = db["transcriptions"]
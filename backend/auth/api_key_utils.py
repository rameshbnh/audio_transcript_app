# auth/api_key_utils.py

def generate_api_key(user_id: str, username: str) -> str:
    """
    Generate API key in format:
    api_<user_id>_<USERNAME>
    """
    clean_username = username.upper().replace(" ", "")
    return f"api_{user_id}_{clean_username}"


def hash_api_key(api_key: str) -> str:
    import hashlib
    return hashlib.sha256(api_key.encode()).hexdigest()

def verify_api_key(raw_key: str, key_hash: str) -> bool:
    return hash_api_key(raw_key) == key_hash

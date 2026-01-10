from pymongo import MongoClient
from getpass import getpass

# ===== CONFIG =====
MONGO_URI = "mongodb://localhost:27017"   # change if needed
DB_NAME = "audio_gateway"
COLLECTION = "users"

# ==================

def main():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    users = db[COLLECTION]

    print("\n=== Update User Admin Access ===")

    identifier = input("Enter username OR email: ").strip()
    if not identifier:
        print("❌ Username or email required")
        return

    admin_input = input("Make admin? (yes/no): ").strip().lower()
    if admin_input not in ["yes", "no"]:
        print("❌ Please enter 'yes' or 'no'")
        return

    is_admin = admin_input == "yes"

    # Find user
    user = users.find_one({
        "$or": [
            {"username": identifier},
            {"email": identifier}
        ]
    })

    if not user:
        print("❌ User not found")
        return

    print("\n🔍 Current Status")
    print(f"Username  : {user.get('username')}")
    print(f"Email     : {user.get('email')}")
    print(f"Is Admin  : {user.get('is_admin', False)}")

    # Update
    result = users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_admin": is_admin}}
    )

    if result.modified_count == 1:
        print("\n✅ Update successful")
    else:
        print("\nℹ No change needed (already in desired state)")

    # Verify
    updated = users.find_one(
        {"_id": user["_id"]},
        {"username": 1, "email": 1, "is_admin": 1}
    )

    print("\n📌 Updated Status")
    print(f"Username  : {updated['username']}")
    print(f"Email     : {updated['email']}")
    print(f"Is Admin  : {updated.get('is_admin', False)}")

    client.close()


if __name__ == "__main__":
    main()

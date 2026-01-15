from auth.mongo import client, db, transcriptions_collection
from datetime import datetime
import os
import time

def init_database():
    """Initialize the database with required indexes"""
    print("Initializing database...")
    
    # Test MongoDB connection first
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            # Test the connection
            client.admin.command('ping')
            print("Connected to MongoDB successfully!")
            break
        except Exception as e:
            print(f"Attempt {attempt + 1} failed to connect to MongoDB: {e}")
            if attempt == max_retries - 1:
                print("Could not connect to MongoDB after several attempts. Skipping index creation.")
                return
            time.sleep(retry_delay)
    
    # Check if indexes already exist by checking if the collection has any indexes
    # (other than the default _id index)
    try:
        indexes = transcriptions_collection.index_information()
        if len(indexes) > 1:  # More than just the default _id index
            print("Indexes already exist, skipping initialization")
            return
        
        print("Creating MongoDB indexes...")
        
        # Create index on user_id for faster queries
        transcriptions_collection.create_index("user_id")
        print("Created index on user_id")
        
        # Create index on created_at for sorting
        transcriptions_collection.create_index([("created_at", -1)])
        print("Created index on created_at (descending)")
        
        # Create compound index for user_id and created_at for efficient history queries
        transcriptions_collection.create_index([("user_id", 1), ("created_at", -1)])
        print("Created compound index on (user_id, created_at)")
        
        print("Database initialization completed successfully!")
    except Exception as e:
        print(f"Error during database initialization: {e}")

if __name__ == "__main__":
    init_database()
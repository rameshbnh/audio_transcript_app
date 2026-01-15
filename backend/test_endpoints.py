import requests
import json

# Test script to verify the new endpoints work correctly

BASE_URL = "http://localhost:8000"  # Adjust port as needed

def test_history_endpoint():
    """Test the history endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/history")
        print(f"History endpoint status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"History data: {len(data)} records returned")
            if data:
                print(f"First record: {data[0]}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing history endpoint: {e}")

def test_transcription_endpoint():
    """Test the transcription result endpoint (will fail without valid ID)"""
    try:
        # This will fail with invalid ID, but should give us the right error
        response = requests.get(f"{BASE_URL}/transcription/invalid_id")
        print(f"Transcription endpoint status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error testing transcription endpoint: {e}")

if __name__ == "__main__":
    print("Testing new endpoints...")
    test_history_endpoint()
    test_transcription_endpoint()
    print("Tests completed.")
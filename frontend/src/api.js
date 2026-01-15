const API_BASE = "/api";

export async function uploadAudio(file, mode) {
  console.log("FRONTEND LOG: Upload request initiated", {
    filename: file.name,
    mode,
    size: file.size,
    timestamp: new Date().toISOString()
  });

  const profileRaw = localStorage.getItem("profile");
  console.log("DEBUG profileRaw:", profileRaw);
  if (!profileRaw) {
    throw new Error("Profile not found. Please login again.");
  }

  const profile = JSON.parse(profileRaw);
  console.log("DEBUG api_key:", profile?.api_key);
  if (!profile.api_key) {
    throw new Error("API key not available.");
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(
      `${API_BASE}/upload?mode=${mode}`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          "x-api-key": profile.api_key   // 🔑 THIS FIXES EVERYTHING
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("FRONTEND LOG: Upload failed", {
        status: response.status,
        error: text
      });
      throw new Error(text || "Upload failed");
    }

    const result = await response.json();

    console.log("FRONTEND LOG: Upload successful", {
      filename: file.name,
      mode,
      result_size: JSON.stringify(result).length,
      timestamp: new Date().toISOString()
    });

    return result;

  } catch (error) {
    console.error("FRONTEND LOG: Upload error", {
      error: error.message,
      filename: file.name,
      mode,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function fetchHistory() {
  try {
    const response = await fetch(`${API_BASE}/history`, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
    }

    const history = await response.json();
    return history;
  } catch (error) {
    console.error("FRONTEND LOG: Error fetching history", {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function fetchTranscriptionResult(transcriptionId) {
  try {
    const response = await fetch(`${API_BASE}/transcription/${transcriptionId}`, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch transcription: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("FRONTEND LOG: Error fetching transcription result", {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

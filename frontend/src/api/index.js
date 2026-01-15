import axios from "axios";

export async function uploadAudio(file, mode) {
  const profile = JSON.parse(localStorage.getItem("profile"));

  if (!profile?.api_key) {
    throw new Error("API key not available. Contact admin.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await axios.post(
    `/upload?mode=${mode}`,
    formData,
    {
      headers: {
        "x-api-key": profile.api_key   // 🔑 HERE
      },
      withCredentials: true            // 🍪 session cookie
    }
  );

  return res.data;
}

export async function fetchHistory() {
  const res = await axios.get('/history', {
    withCredentials: true
  });
  
  return res.data;
}

const BASE_URL = "/api";

// REGISTER
export async function registerUser(data) {
  console.log("FRONTEND LOG: Registration request initiated", {
    username: data.username,
    email: data.email,
    timestamp: new Date().toISOString()
  });
  
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include", // IMPORTANT
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("FRONTEND LOG: Registration failed", {
        error: err.detail || "Register failed",
        status: res.status,
        timestamp: new Date().toISOString()
      });
      throw new Error(err.detail || "Register failed");
    }
    
    const result = await res.json();
    
    console.log("FRONTEND LOG: Registration successful", {
      username: data.username,
      email: data.email,
      api_key_provided: !!result.api_key,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error) {
    console.error("FRONTEND LOG: Registration error", {
      error: error.message,
      username: data.username,
      email: data.email,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// LOGIN
export async function loginUser(data) {
  console.log("FRONTEND LOG: Login request initiated", {
    identifier: data.identifier,
    timestamp: new Date().toISOString()
  });
  
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // IMPORTANT
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("FRONTEND LOG: Login failed", {
        error: err.detail || "Login failed",
        status: res.status,
        identifier: data.identifier,
        timestamp: new Date().toISOString()
      });
      throw new Error(err.detail || "Login failed");
    }
    
    console.log("FRONTEND LOG: Login successful", {
      identifier: data.identifier,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("FRONTEND LOG: Login error", {
      error: error.message,
      identifier: data.identifier,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
// Profile page of user

export async function fetchProfile() {
  console.log("FRONTEND LOG: Profile fetch request initiated", {
    timestamp: new Date().toISOString()
  });

  try {
    const res = await fetch(`${BASE_URL}/me`, {
      credentials: "include",
    });

    if (!res.ok) {
      console.error("FRONTEND LOG: Profile fetch failed", {
        status: res.status,
        statusText: res.statusText,
        timestamp: new Date().toISOString()
      });
      throw new Error("Unauthorized");
    }

    const profileData = await res.json();

    // ✅ FIX: store the ACTUAL response
    localStorage.setItem("profile", JSON.stringify(profileData));

    console.log("FRONTEND LOG: Profile fetch successful", {
      username: profileData.username,
      email: profileData.email,
      api_key_present: !!profileData.api_key,
      api_key_active: profileData.api_key_active,
      timestamp: new Date().toISOString()
    });

    return profileData;
  } catch (error) {
    console.error("FRONTEND LOG: Profile fetch error", {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}


export async function logoutUser() {
  console.log("FRONTEND LOG: Logout request initiated", {
    timestamp: new Date().toISOString()
  });
  
  try {
    const res = await fetch(`${BASE_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
    
    if (!res.ok) {
      console.error("FRONTEND LOG: Logout failed", {
        status: res.status,
        statusText: res.statusText,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log("FRONTEND LOG: Logout successful", {
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("FRONTEND LOG: Logout error", {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}


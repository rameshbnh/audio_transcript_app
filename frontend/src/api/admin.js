const API_BASE = "/api";
/**
 * Fetch all users with their details including API key status and upload limits
 */
export async function fetchUsers() {
  console.log("FRONTEND LOG: Fetching users for admin panel", {
    timestamp: new Date().toISOString()
  });
  
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
    }

    const users = await response.json();
    
    console.log("FRONTEND LOG: Successfully fetched users", {
      count: users.length,
      timestamp: new Date().toISOString()
    });
    
    return users;
  } catch (error) {
    console.error("FRONTEND LOG: Error fetching users", {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Toggle API key status (activate/deactivate)
 */
export async function toggleApiKey(userId, currentStatus) {
  console.log("FRONTEND LOG: Toggling API key", {
    userId,
    currentStatus,
    timestamp: new Date().toISOString()
  });
  
  const action = currentStatus ? "deactivate" : "activate";
  
  try {
    const response = await fetch(`${API_BASE}/admin/api-keys/${userId}/${action}`, {
      method: "PUT",
      credentials: "include"
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to ${action} API key`);
    }

    const result = await response.json();
    
    console.log(`FRONTEND LOG: API key ${action}d successfully`, {
      userId,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error) {
    console.error(`FRONTEND LOG: Error ${action}ing API key`, {
      userId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Update user's upload limit
 */
export async function updateUploadLimit(userId, newLimit) {
  console.log("FRONTEND LOG: Updating upload limit", {
    userId,
    newLimit,
    timestamp: new Date().toISOString()
  });
  
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/upload-limit?limit=${newLimit}`, {
      method: "PUT",
      credentials: "include"
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to update upload limit`);
    }

    const result = await response.json();
    
    console.log("FRONTEND LOG: Upload limit updated successfully", {
      userId,
      newLimit,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error) {
    console.error("FRONTEND LOG: Error updating upload limit", {
      userId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Delete a user and all related data (API keys, usage, logs)
 */
export async function deleteUser(userId) {
  console.log("FRONTEND LOG: Deleting user", {
    userId,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to delete user");
    }

    const result = await response.json();

    console.log("FRONTEND LOG: User deleted successfully", {
      userId,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    console.error("FRONTEND LOG: Error deleting user", {
      userId,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

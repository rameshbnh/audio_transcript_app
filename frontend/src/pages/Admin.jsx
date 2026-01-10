import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchUsers, toggleApiKey, updateUploadLimit, deleteUser } from "../api/admin";

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null); // Track which user is being edited
  const [changedLimits, setChangedLimits] = useState({}); // Track changed limits

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const userData = await fetchUsers();
        setUsers(userData);
        setError(null);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const handleApiKeyToggle = async (userId, currentStatus) => {
    try {
      await toggleApiKey(userId, currentStatus);

      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId
            ? { ...user, api_key_active: !currentStatus }
            : user
        )
      );

      alert(`API key ${currentStatus ? 'deactivated' : 'activated'} successfully`);
    } catch (err) {
      console.error(`Error ${currentStatus ? 'deactivating' : 'activating'} API key:`, err);
      alert(`Failed to ${currentStatus ? 'deactivate' : 'activate'} API key: ${err.message}`);
    }
  };

  const handleLimitChange = (userId, newValue) => {
    // Allow empty string while editing
    if (newValue === "") {
      setUsers(prev =>
        prev.map(user =>
          user.id === userId
            ? { ...user, upload_limit: "" }
            : user
        )
      );
      return;
    }

    const parsed = Number(newValue);
    if (Number.isNaN(parsed) || parsed < 0) return;

    setUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === userId
          ? { ...user, upload_limit: parsed }
          : user
      )
    );

    setChangedLimits(prev => ({
      ...prev,
      [userId]: parsed
    }));
  };


  const handleSaveAllChanges = async () => {
    const userIds = Object.keys(changedLimits);
    
    for (const userId of userIds) {
      try {
        await updateUploadLimit(userId, changedLimits[userId]);
      } catch (err) {
        console.error(`Error updating upload limit for user ${userId}:`, err);
        alert(`Failed to update upload limit for user: ${err.message}`);
        return; // Stop if any update fails
      }
    }
    
    // Clear the changed limits after successful save
    setChangedLimits({});
    
    // Refresh the user data to reflect the changes
    const userData = await fetchUsers();
    setUsers(userData);
    
    alert('All changes saved successfully!');
  };
  const handleDeleteUser = async (userId, username) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete user "${username}"?\n\nThis action is irreversible.`
    );

    if (!confirmed) return;

    try {
      await deleteUser(userId);

      // Remove from UI immediately
      setUsers(prev => prev.filter(u => u.id !== userId));

      alert(`User "${username}" deleted successfully`);
    } catch (err) {
      console.error("Error deleting user:", err);
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <h2>Admin Dashboard</h2>
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <h2>Admin Dashboard</h2>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
  <div className="admin-page">
    <h2>Admin Dashboard</h2>

    <div className="admin-container">
      {/* ===== HEADER ACTIONS ===== */}
      <div className="admin-header">
        <button
          className="back-btn"
          onClick={() => navigate("/")}
        >
          ← Back to Main
        </button>

        <button
          onClick={handleSaveAllChanges}
          className="save-all-btn"
          disabled={Object.keys(changedLimits).length === 0}
        >
          Save All Changes
        </button>
      </div>

      {/* ===== USERS TABLE ===== */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>User Type</th>
              <th>Upload Limit</th>
              <th>API Key Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map(u => (
              <tr key={u.id} className="admin-row">
                <td>{u.username}</td>
                <td>{u.email}</td>

                <td>
                  <span
                    className={`user-type-badge ${
                      u.is_admin ? "admin" : "user"
                    }`}
                  >
                    {u.is_admin ? "Admin" : "User"}
                  </span>
                </td>

                <td>
                  <input
                    type="number"
                    min="0"
                    value={u.upload_limit}
                    onChange={(e) =>
                      handleLimitChange(u.id, e.target.value)
                    }
                    className="limit-input"
                  />
                </td>

                <td>
                  <select
                    value={u.api_key_active ? "active" : "inactive"}
                    onChange={() => handleApiKeyToggle(u.id, u.api_key_active)}
                    className={`api-key-status-select ${
                      u.api_key_active ? "active" : "inactive"
                    }`}
                  >
                    <option value="inactive">INACTIVE</option>
                    <option value="active">ACTIVE</option>
                  </select>
                </td>

                {/* ===== DELETE ACTION ===== */}
                <td>
                  {!u.is_admin && (
                    <button
                      className="btn-danger"
                      onClick={() => handleDeleteUser(u.id, u.username)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
}
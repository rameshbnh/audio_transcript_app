import { useEffect, useState, useRef } from "react";
import { fetchProfile, logoutUser } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function ProfileCard() {
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    console.log("FRONTEND LOG: ProfileCard component mounted, fetching profile", {
      timestamp: new Date().toISOString()
    });
    
    fetchProfile()
      .then(profileData => {
        console.log("FRONTEND LOG: Profile loaded successfully", {
          username: profileData.username,
          email: profileData.email,
          api_key_present: !!profileData.api_key,
          api_key_active: profileData.api_key_active,
          timestamp: new Date().toISOString()
        });
        setProfile(profileData);
      })
      .catch(error => {
        console.error("FRONTEND LOG: Failed to load profile", {
          error: error.message,
          timestamp: new Date().toISOString()
        });
        navigate("/login");
      });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setMenuOpen(false);
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    console.log("FRONTEND LOG: Logout initiated from ProfileCard", {
      username: profile?.username,
      timestamp: new Date().toISOString()
    });
    
    try {
      await logoutUser();
      console.log("FRONTEND LOG: Logout successful", {
        timestamp: new Date().toISOString()
      });
      navigate("/login");
    } catch (error) {
      console.error("FRONTEND LOG: Logout failed", {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  if (!profile) return null;

  return (
    <div className="profile-wrapper" ref={ref}>
      {/* PROFILE TRIGGER */}
      <div
        className="profile-trigger"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <div className="profile-avatar">
          {profile.username.charAt(0).toUpperCase()}
        </div>
        <span className="profile-name">{profile.username}</span>
      </div>

      {/* DROPDOWN MENU */}
      {menuOpen && (
        <div className="profile-dropdown">
          <button
            className="menu-item"
            onClick={() => {
              setShowProfile(true);
              setMenuOpen(false);
            }}
          >
            <span className="menu-icon">👤</span>
            <span>Profile</span>
          </button>

          {profile.is_admin && (
            <button
              className="menu-item"
              onClick={() => navigate("/admin")}
            >
              <span className="menu-icon">⚙️</span>
              <span>Admin Settings</span>
            </button>
          )}

          <div className="menu-divider" />

          <button
            className="menu-item logout"
            onClick={handleLogout}
          >
            <span className="menu-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      )}


      {/* PROFILE CARD */}
      {showProfile && (
        <div className="profile-card card">
          <h3>Profile</h3>
          <p><strong>Username:</strong> {profile.username}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Upload Limit:</strong> {profile.upload_limit}</p>
          <div className="api-key-container">
            <p><strong>API Key:</strong></p>
            {profile.api_key ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <code className="api-key-display">{profile.api_key}</code>
                <button
                  className="copy-api-key-btn"
                  onClick={() => navigator.clipboard.writeText(profile.api_key)}
                  title="Copy API key to clipboard"
                  style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}
                >
                  📋
                </button>
              </div>
            ) : (
              <p><em>API key not available</em></p>
            )}
          </div>
          <p>
            <strong>API Key Status:</strong>{" "}
            {profile.api_key_active ? "Active" : "Inactive"}
          </p>

          <button
            className="profile-menu-btn"
            onClick={() => setShowProfile(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

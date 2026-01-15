import { useEffect, useState, useRef } from "react";
import { fetchProfile, logoutUser } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function ProfileCard() {
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [copied, setCopied] = useState(false);
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
  
    const handleCopyApiKey = async () => {
      if (profile?.api_key) {
        try {
          await navigator.clipboard.writeText(profile.api_key);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000); // Reset copied status after 2 seconds
        } catch (err) {
          console.error("Failed to copy API key:", err);
        }
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
        <div className="profile-card">
          <div className="profile-header">
            <h3>Profile</h3>
            <span className={`status-badge ${profile.api_key_active ? 'active' : 'inactive'}`}>
              {profile.api_key_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="profile-section">
            <div className="profile-row">
              <span className="label">Username</span>
              <span className="value">{profile.username}</span>
            </div>

            <div className="profile-row">
              <span className="label">Email</span>
              <span className="value">{profile.email}</span>
            </div>

            <div className="profile-row">
              <span className="label">Upload Limit</span>
              <span className="value">{profile.upload_limit} files</span>
            </div>
          </div>

          <div className="profile-divider"></div>

          <div className="profile-section">
            <span className="label">API Key</span>
            <div className="api-key-box">
              <span className="api-key-text">{profile.api_key || 'No API key available'}</span>
              {profile.api_key && (
                <button className="copy-api-key-btn" onClick={handleCopyApiKey}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              )}
            </div>

            <div className="api-status">
              <span className="label">API Key Status</span>
              <span className={`status-pill ${profile.api_key_active ? 'active' : 'inactive'}`}>
                {profile.api_key_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <button
            className="action-btn"
            onClick={() => setShowProfile(false)}
            style={{
              marginTop: '14px',
              width: '100%'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

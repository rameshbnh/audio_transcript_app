import { useState, useRef, useCallback, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { fetchProfile } from "./api/auth";

import UploadForm from "./components/UploadForm";
import Results from "./components/Results";
import History from "./components/History";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfileCard from "./components/ProfileCard";
import Admin from "./pages/Admin";
import AdminRoute from "./components/AdminRoute";
import MediaPlayer from "./components/MediaPlayer";

// Import the logo
import logo from "../logo.png";

import "./styles.css";

/* ===== YOUR OLD LOGIC (UNCHANGED) ===== */
function Home() {
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("transcribe");
  const [showHistory, setShowHistory] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Fetch profile data to get user's name
    fetchProfile()
      .then(profileData => {
        setProfile(profileData);
      })
      .catch(error => {
        console.error("Failed to load profile:", error);
      });
  }, []);

  // Store the audio source URL to prevent unnecessary re-renders
  const audioSourceUrlRef = useRef(null);
  
  // Get audio source for media player
  const getAudioSource = () => {
    if (recordedBlob) {
      return recordedBlob;
    }
    if (audioFile) {
      // Cache the object URL to prevent recreation on each render
      if (!audioSourceUrlRef.current || audioSourceUrlRef.current.file !== audioFile) {
        // Revoke previous URL if it exists
        if (audioSourceUrlRef.current && audioSourceUrlRef.current.url) {
          URL.revokeObjectURL(audioSourceUrlRef.current.url);
        }
        // Create new URL
        const url = URL.createObjectURL(audioFile);
        audioSourceUrlRef.current = { file: audioFile, url };
      }
      return audioSourceUrlRef.current.url;
    }
    return null;
  };

  // Get file name for media player
  const getPlayerFileName = () => {
    if (recordedBlob) {
      return "Recorded Audio";
    }
    if (audioFile) {
      return audioFile.name;
    }
    return "Audio File";
  };

  return (
    <div className="app-container">
      {/* Header Panel */}
      <div className="header-panel">
        {/* Logo on the left */}
        <div className="header-logo-container">
          <img src={logo} alt="Logo" className="header-logo" />
        </div>
        
        <div className="header-text-container">
          <h1 className="header">Lipikar Speech Service</h1>
        </div>
        <div className="header-profile-wrapper">
          <ProfileCard />
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="main-content">
        {/* Left Panel - Contains Header, Upload Form, and History */}
        <div className="left-panel">
          <div className="content-wrapper">
            {showHistory && (
              <>
                <button className="history-toggle-btn history-toggle-top" onClick={() => setShowHistory(!showHistory)}>
                  Hide History
                </button>
                <div className="history-section">
                  <History onResultClick={(result, mode) => {
                    setResult(result);
                    setMode(mode);
                  }} />
                </div>
              </>
            )}
            <div className={`animated-section ${showHistory ? 'slide-up' : ''}`}>
              <div className="upload-section">
                <UploadForm
                  onResult={setResult}
                  onModeChange={setMode}
                  onFileSelect={setAudioFile}
                  onRecordingComplete={setRecordedBlob}
                  currentAudioFile={audioFile}
                />
              </div>
              {!showHistory && (
                <button className="history-toggle-btn" onClick={() => setShowHistory(!showHistory)}>
                  {showHistory ? 'Hide History' : 'Show History'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Panel - Output/Results Panel */}
        <div className="output-panel">
          {!result && (
            <div className="centered-content">
              <h2 className="welcome-title">Welcome {profile ? profile.username : 'Back'},</h2>
              <p className="welcome-subtitle">Please upload / record audio to use Lipikar Speech Service</p>
              <div className="audio-wave-placeholder">
                <div className="waveform-animation">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="wave-bar"
                      style={{ height: `${Math.random() * 60 + 20}px`, animationDelay: `${i * 0.1}s` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {result && (
            <Results result={result} mode={mode} />
          )}
          {/* Media Player - Floating at the bottom of output panel */}
          <MediaPlayer
            audioSource={getAudioSource()}
            fileName={getPlayerFileName()}
          />
        </div>
      </div>
    </div>
  );
}

/* ===== ONLY ROUTING ADDED ===== */
function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected user dashboard */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* 🔐 ADMIN PAGE */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;

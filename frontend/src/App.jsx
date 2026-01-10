import { useState } from "react";
import { fetchProfile } from "./api/index";

import { Routes, Route, Navigate } from "react-router-dom";

import UploadForm from "./components/UploadForm";
import Results from "./components/Results";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfileCard from "./components/ProfileCard";
import Admin from "./pages/Admin";
import AdminRoute from "./components/AdminRoute";


import "./styles.css";

/* ===== YOUR OLD LOGIC (UNCHANGED) ===== */
function Home() {
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("transcribe");

  return (
    <div className="app-container">
      
      <div className="upload-panel">
        <h1 className="header">Audio Gateway UI</h1>
        <UploadForm onResult={setResult} onModeChange={setMode} />
      </div>
      <div className="results-panel">
          <div className="top-bar">
              <ProfileCard />
          </div>
        <Results result={result} mode={mode} />
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
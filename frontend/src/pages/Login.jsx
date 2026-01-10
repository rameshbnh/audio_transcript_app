import { useState } from "react";
import { loginUser } from "../api/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate(); // ✅ CORRECT PLACE

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    console.log("FRONTEND LOG: Login form submitted", {
      identifier,
      timestamp: new Date().toISOString()
    });

    try {
      await loginUser({ identifier, password });
      console.log("FRONTEND LOG: Login successful", {
        identifier,
        timestamp: new Date().toISOString()
      });
      navigate("/"); // ✅ redirect to main page
    } catch (error) {
      console.error("FRONTEND LOG: Login failed", {
        error: error.message,
        identifier,
        timestamp: new Date().toISOString()
      });
      setError("Invalid username/email or password");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2 className="auth-title">Sign In</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="action-btn" type="submit">
            Sign In
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        <p className="auth-footer">
          Don’t have an account? <a href="/register">Create Account</a>
        </p>
      </div>
    </div>
  );
}

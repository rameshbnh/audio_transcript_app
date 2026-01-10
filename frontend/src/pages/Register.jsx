import { useState } from "react";
import { registerUser } from "../api/auth";
import { useNavigate } from "react-router-dom";


export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      console.log("FRONTEND LOG: Password confirmation mismatch", {
        timestamp: new Date().toISOString()
      });
      setError("Passwords do not match");
      return;
    }

    console.log("FRONTEND LOG: Registration form submitted", {
      username,
      email,
      timestamp: new Date().toISOString()
    });

    try {
      const data = await registerUser({ username, email, password });
      console.log("FRONTEND LOG: Registration successful, showing API key", {
        username,
        api_key_available: !!data.api_key,
        timestamp: new Date().toISOString()
      });
      
      // Show the API key to the user after registration
      alert(`Account created successfully!\nYour API key: ${data.api_key}\nNote: Your API key is currently inactive. Contact admin for activation.`);
      
      // ✅ redirect to login
      navigate("/login");
    } catch (err) {
      console.error("FRONTEND LOG: Registration failed", {
        error: err.message,
        username,
        email,
        timestamp: new Date().toISOString()
      });
      setError(err.message || "User already exists");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2 className="auth-title">Create Account</h2>

        <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
                <label>Username</label>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
            </div>

            <div className="form-group">
                <label>Email</label>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>

            <div className="form-group">
                <label>Password</label>
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>

            <div className="form-group">
                <label>Confirm Password</label>
                <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                />
            </div>

          <button className="action-btn" type="submit">
            Create Account
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        <p className="auth-footer">
          Already have an account? <a href="/login">Sign In</a>
        </p>
      </div>
    </div>
  );
}

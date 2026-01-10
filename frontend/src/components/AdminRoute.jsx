import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    fetch("api/me", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        setAllowed(Boolean(data.is_admin));
        setLoading(false);
      })
      .catch(() => {
        setAllowed(false);
        setLoading(false);
      });
  }, []);
  useEffect(() => {
  const preventBackspaceNav = (e) => {
    const tag = e.target.tagName.toLowerCase();
      const isInput =
        tag === "input" ||
        tag === "textarea" ||
        e.target.isContentEditable;

      if (e.key === "Backspace" && !isInput) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", preventBackspaceNav);
    return () => window.removeEventListener("keydown", preventBackspaceNav);
  }, []);


  if (loading) return null;

  return allowed ? children : <Navigate to="/" replace />;
}


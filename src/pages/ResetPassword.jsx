import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — this picks it up
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match!"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 3000);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 40, background: "white", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
      <img src={logo} alt="LOCUM" style={{ width: 160, marginBottom: 16 }} />
      <h2 style={{ color: "#1e3a5f", marginBottom: 8 }}>Set New Password</h2>
      <p style={{ color: "#888", marginBottom: 24 }}>Enter your new password below.</p>

      {success ? (
        <p style={{ background: "#e8f5e9", color: "#2e7d32", padding: "10px 16px", borderRadius: 8 }}>
          ✅ Password updated! Redirecting to login...
        </p>
      ) : !ready ? (
        <div>
          <p style={{ color: "#888", marginBottom: 16, fontSize: 14 }}>
            Waiting for verification link...
          </p>
          <p style={{ color: "#aaa", fontSize: 13 }}>
            If you arrived here directly, please request a new password reset link from the login page.
          </p>
          <button
            onClick={() => navigate("/login")}
            style={{ marginTop: 20, padding: "12px 24px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            Back to Login
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <p style={{ background: "#fce4ec", color: "#c62828", padding: "10px 16px", borderRadius: 8 }}>{error}</p>}
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: 12, fontSize: 15, border: "1px solid #ccc", borderRadius: 8 }}
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{ padding: 12, fontSize: 15, border: "1px solid #ccc", borderRadius: 8 }}
          />
          <button type="submit" disabled={loading}
            style={{ padding: 14, background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default ResetPassword;

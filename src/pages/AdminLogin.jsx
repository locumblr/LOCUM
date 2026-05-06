import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    const { data: admin } = await supabase.from("admins").select("id").eq("id", data.user.id).single();
    if (!admin) { setError("Not an admin account."); await supabase.auth.signOut(); setLoading(false); return; }
    navigate("/admin");
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: 40, background: "white", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
      <h1 style={{ color: "#1e3a5f", marginBottom: 8 }}>LOCUM</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>Admin Login</p>
      {error && <p style={{ background: "#fce4ec", color: "#c62828", padding: "10px 16px", borderRadius: 8, marginBottom: 16 }}>{error}</p>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input name="email" type="email" placeholder="Admin Email" required onChange={handle} style={{ padding: 12, fontSize: 15, border: "1px solid #ccc", borderRadius: 8 }} />
        <input name="password" type="password" placeholder="Password" required onChange={handle} style={{ padding: 12, fontSize: 15, border: "1px solid #ccc", borderRadius: 8 }} />
        <button type="submit" disabled={loading} style={{ padding: 14, background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
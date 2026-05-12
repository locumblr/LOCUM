import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Profile.css";

function DepartmentProfile() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState({ newPass: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("dept_session");
    if (!stored) { navigate("/department/login"); return; }
    setSession(JSON.parse(stored));
  }, []);

  const savePassword = async (e) => {
    e.preventDefault();
    if (password.newPass !== password.confirm) { alert("Passwords do not match!"); return; }
    if (password.newPass.length < 6) { alert("Password must be at least 6 characters."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("hospital_departments")
      .update({ password: password.newPass })
      .eq("id", session.id);
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    alert("Password changed successfully!");
    setPassword({ newPass: "", confirm: "" });
    setSaving(false);
  };

  const logout = () => {
    localStorage.removeItem("dept_session");
    navigate("/department/login");
  };

  if (!session) return null;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Department Profile</h1>
        <div className="header-buttons">
          <button onClick={() => navigate("/department/dashboard")}>← Back</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="profile-card">
        <div className="photo-circle"><span>🏥</span></div>
        <div className="profile-name">
          <h2>{session.department_name}</h2>
          <p>{session.hospital_name}</p>
          <p style={{ fontSize: 13, color: "#888" }}>Code: {session.department_code}</p>
        </div>
      </div>

      <div className="tabs">
        <button className="active">Change Password</button>
      </div>

      <form onSubmit={savePassword} className="profile-form">
        <div className="form-group">
          <label>New Password</label>
          <input
            type="password"
            value={password.newPass}
            onChange={(e) => setPassword({ ...password, newPass: e.target.value })}
            required
            placeholder="Min. 6 characters"
          />
        </div>
        <div className="form-group">
          <label>Confirm New Password</label>
          <input
            type="password"
            value={password.confirm}
            onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
            required
          />
        </div>
        <button type="submit" className="save-btn" disabled={saving}>
          {saving ? "Saving..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}

export default DepartmentProfile;
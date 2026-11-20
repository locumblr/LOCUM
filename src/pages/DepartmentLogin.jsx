import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInDepartment } from "../departmentSession";
import "./Login.css";
import logo from "../assets/logo.png";

function DepartmentLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ code: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await signInDepartment(form.code, form.password);
    setLoading(false);
    if (signInError) { setError(signInError); return; }
    navigate("/department/dashboard");
  };

  return (
    <div className="login-container">
      <img src={logo} alt="LOCUM" className="login-logo" />
      <p>Department Login</p>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>Use your department code and password</p>
      {error && <p className="error-msg">{error}</p>}
      <form onSubmit={submit} className="login-form">
        <input
          name="code"
          type="text"
          placeholder="Department Code (e.g. APOLLO-ICU-7KQ2)"
          required
          onChange={handle}
          value={form.code}
          style={{ textTransform: "uppercase" }}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          onChange={handle}
          value={form.password}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
      <p className="switch-link">
        Hospital HR login? <span onClick={() => navigate("/login")}>Click here</span>
      </p>
    </div>
  );
}

export default DepartmentLogin;
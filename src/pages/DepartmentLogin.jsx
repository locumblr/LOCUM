import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
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

    const { data: dept, error: deptError } = await supabase
      .from("hospital_departments")
      .select("*, hospitals(status, hospital_name)")
      .eq("department_code", form.code.toUpperCase().trim())
      .single();

    if (deptError || !dept) {
      setError("Invalid department code. Please check and try again.");
      setLoading(false);
      return;
    }

    if (dept.password !== form.password) {
      setError("Incorrect password. Default password is 123456.");
      setLoading(false);
      return;
    }

    if (dept.hospitals?.status === "frozen") {
      setError("This hospital account is currently suspended. Please contact support.");
      setLoading(false);
      return;
    }

    if (dept.hospitals?.status !== "active") {
      setError("This hospital account is not yet active.");
      setLoading(false);
      return;
    }

    // Store department session in localStorage
    localStorage.setItem("dept_session", JSON.stringify({
      id: dept.id,
      hospital_id: dept.hospital_id,
      department_name: dept.department_name,
      department_code: dept.department_code,
      fixed_pay: dept.fixed_pay,
      hospital_name: dept.hospitals?.hospital_name,
    }));

    navigate("/department/dashboard");
    setLoading(false);
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
          placeholder="Department Code (e.g. APOLLO-ICU)"
          required
          onChange={handle}
          value={form.code}
          style={{ textTransform: "uppercase" }}
        />
        <input
          name="password"
          type="password"
          placeholder="Password (default: 123456)"
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
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Login.css";
import logo from "../assets/logo.png";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const isDepartmentCode = (identifier) => {
    // Department codes contain a hyphen and no @ symbol e.g. APOLLO-ICU
    return !identifier.includes("@") && identifier.includes("-");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Check if it's a department code
      if (isDepartmentCode(form.identifier)) {
        const { data: dept, error: deptError } = await supabase
          .from("hospital_departments")
          .select("*, hospitals(status, hospital_name)")
          .eq("department_code", form.identifier.toUpperCase().trim())
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

        localStorage.setItem("dept_session", JSON.stringify({
          id: dept.id,
          hospital_id: dept.hospital_id,
          department_name: dept.department_name,
          department_code: dept.department_code,
          fixed_pay: dept.fixed_pay,
          hospital_name: dept.hospitals?.hospital_name,
        }));

        navigate("/department/dashboard");
        return;
      }

      // Otherwise treat as email login
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.identifier,
        password: form.password,
      });
      if (authError) throw authError;

      const role = data.user.user_metadata?.role;

      if (role === "doctor") {
        const { data: doctor } = await supabase.from("doctors").select("status").eq("id", data.user.id).single();
        if (doctor?.status === "frozen") {
          await supabase.auth.signOut();
          setError("Your account has been suspended. Please contact support.");
          setLoading(false);
          return;
        }
        navigate("/doctor/dashboard");

      } else if (role === "nurse") {
        const { data: nurse } = await supabase.from("nurses").select("status").eq("id", data.user.id).single();
        if (!nurse) {
          await supabase.auth.signOut();
          setError("Nurse account not found. Please register again.");
          setLoading(false);
          return;
        }
        if (nurse.status === "frozen") {
          await supabase.auth.signOut();
          setError("Your account has been suspended. Please contact support.");
          setLoading(false);
          return;
        }
        navigate("/nurse/dashboard");

      } else if (role === "hospital") {
        const { data: hospital } = await supabase.from("hospitals").select("status").eq("id", data.user.id).single();
        if (hospital?.status === "pending") {
          await supabase.auth.signOut();
          setError("Your account is still under review. You will be notified once approved.");
          setLoading(false);
          return;
        }
        if (hospital?.status === "frozen") {
          await supabase.auth.signOut();
          setError("Your account has been suspended. Please contact support.");
          setLoading(false);
          return;
        }
        if (hospital?.status === "rejected") {
          await supabase.auth.signOut();
          setError("Your account application was rejected. Please contact support.");
          setLoading(false);
          return;
        }
        navigate("/hospital/dashboard");

      } else {
        await supabase.auth.signOut();
        setError("Unknown account type. Please contact support.");
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: "https://project-1qlxe.vercel.app/reset-password",
    });
    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="login-container">
      <img src={logo} alt="LOCUM" className="login-logo" />
      {!showForgot ? (
        <>
          <p>Sign in to your account</p>
          {error && <p className="error-msg">{error}</p>}
          <form onSubmit={submit} className="login-form">
            <input
              name="identifier"
              type="text"
              placeholder="Email or Department Code (e.g. APOLLO-ICU)"
              required
              onChange={handle}
              value={form.identifier}
              style={{ textTransform: form.identifier.includes("@") ? "none" : "uppercase" }}
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
          <p className="forgot-link" onClick={() => setShowForgot(true)}>Forgot Password?</p>
          <p className="switch-link">
            Don't have an account?{" "}
            <span onClick={() => navigate("/register")}>Register here</span>
          </p>
        </>
      ) : (
        <>
          <h2>Reset Password</h2>
          <p>Enter your email and we'll send you a reset link.</p>
          {forgotSent ? (
            <p className="success-msg">✅ Reset link sent! Check your email.</p>
          ) : (
            <form onSubmit={sendForgotPassword} className="login-form">
              {error && <p className="error-msg">{error}</p>}
              <input
                type="email"
                placeholder="Your Email Address"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <button type="submit">Send Reset Link</button>
            </form>
          )}
          <p className="forgot-link" onClick={() => { setShowForgot(false); setForgotSent(false); setError(""); }}>
            ← Back to Login
          </p>
        </>
      )}
    </div>
  );
}

export default Login;
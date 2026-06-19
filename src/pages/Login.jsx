import { useState, useEffect } from "react";
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
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    // Check for token_hash in URL query params (Supabase token-based flow)
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (tokenHash && type === "recovery") {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ data, error }) => {
          if (!error) setShowReset(true);
        });
      return;
    }

    // Also listen for PASSWORD_RECOVERY event (hash-based flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setShowReset(true);
        setShowForgot(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const isDepartmentCode = (identifier) => {
    return !identifier.includes("@") && identifier.includes("-");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isDepartmentCode(form.identifier)) {
        const { data: dept, error: deptError } = await supabase
          .from("hospital_departments")
          .select("*, hospitals(status, hospital_name)")
          .eq("department_code", form.identifier.toUpperCase().trim())
          .single();
        if (deptError || !dept) { setError("Invalid department code. Please check and try again."); setLoading(false); return; }
        if (dept.password !== form.password) { setError("Incorrect password. Default password is 123456."); setLoading(false); return; }
        if (dept.hospitals?.status === "frozen") { setError("This hospital account is currently suspended."); setLoading(false); return; }
        if (dept.hospitals?.status !== "active") { setError("This hospital account is not yet active."); setLoading(false); return; }
        localStorage.setItem("dept_session", JSON.stringify({
          id: dept.id, hospital_id: dept.hospital_id,
          department_name: dept.department_name, department_code: dept.department_code,
          fixed_pay: dept.fixed_pay, hospital_name: dept.hospitals?.hospital_name,
        }));
        navigate("/department/dashboard");
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.identifier, password: form.password,
      });
      if (authError) throw authError;
      const role = data.user.user_metadata?.role;

      if (role === "doctor") {
        const { data: doctor } = await supabase.from("doctors").select("status").eq("id", data.user.id).single();
        if (doctor?.status === "pending") { await supabase.auth.signOut(); setError("Your application is under review."); setLoading(false); return; }
        if (doctor?.status === "frozen") { await supabase.auth.signOut(); setError("Your account has been suspended."); setLoading(false); return; }
        if (doctor?.status === "rejected") { await supabase.auth.signOut(); setError("Your application was rejected."); setLoading(false); return; }
        navigate("/doctor/dashboard");
      } else if (role === "nurse") {
        const { data: nurse } = await supabase.from("nurses").select("status").eq("id", data.user.id).single();
        if (!nurse) { await supabase.auth.signOut(); setError("Nurse account not found."); setLoading(false); return; }
        if (nurse.status === "pending") { await supabase.auth.signOut(); setError("Your application is under review."); setLoading(false); return; }
        if (nurse.status === "frozen") { await supabase.auth.signOut(); setError("Your account has been suspended."); setLoading(false); return; }
        if (nurse.status === "rejected") { await supabase.auth.signOut(); setError("Your application was rejected."); setLoading(false); return; }
        navigate("/nurse/dashboard");
      } else if (role === "technician") {
        const { data: tech } = await supabase.from("technicians").select("status").eq("id", data.user.id).single();
        if (!tech) { await supabase.auth.signOut(); setError("Technician account not found."); setLoading(false); return; }
        if (tech.status === "pending") { await supabase.auth.signOut(); setError("Your application is under review."); setLoading(false); return; }
        if (tech.status === "frozen") { await supabase.auth.signOut(); setError("Your account has been suspended."); setLoading(false); return; }
        if (tech.status === "rejected") { await supabase.auth.signOut(); setError("Your application was rejected."); setLoading(false); return; }
        navigate("/technician/dashboard");
      } else if (role === "hospital") {
        const { data: hospital } = await supabase.from("hospitals").select("status").eq("id", data.user.id).single();
        if (hospital?.status === "pending") { await supabase.auth.signOut(); setError("Your account is still under review."); setLoading(false); return; }
        if (hospital?.status === "frozen") { await supabase.auth.signOut(); setError("Your account has been suspended."); setLoading(false); return; }
        if (hospital?.status === "rejected") { await supabase.auth.signOut(); setError("Your account application was rejected."); setLoading(false); return; }
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
      redirectTo: "https://bookmylocum.com/login",
    });
    if (error) { setError(error.message); }
    else { setForgotSent(true); }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match!"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setError(error.message);
    } else {
      setResetSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => {
        setShowReset(false);
        setResetSuccess(false);
        setNewPassword("");
        setConfirmPassword("");
      }, 3000);
    }
    setLoading(false);
  };

  // ── RESET PASSWORD FORM ──
  if (showReset) {
    return (
      <div className="login-container">
        <img src={logo} alt="LOCUM" className="login-logo" />
        <h2 style={{ color: "#1e3a5f", marginBottom: 8 }}>Set New Password</h2>
        <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Enter your new password below.</p>
        {resetSuccess ? (
          <p style={{ background: "#e8f5e9", color: "#2e7d32", padding: "12px 16px", borderRadius: 8, fontSize: 14 }}>
            ✅ Password updated successfully! You can now log in.
          </p>
        ) : (
          <form onSubmit={submitReset} className="login-form">
            {error && <p className="error-msg">{error}</p>}
            <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            <button type="submit" disabled={loading}>{loading ? "Updating..." : "Update Password"}</button>
          </form>
        )}
      </div>
    );
  }

  // ── FORGOT PASSWORD FORM ──
  if (showForgot) {
    return (
      <div className="login-container">
        <img src={logo} alt="LOCUM" className="login-logo" />
        <h2 style={{ color: "#1e3a5f", marginBottom: 8 }}>Reset Password</h2>
        <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>Enter your email and we'll send you a reset link.</p>
        {forgotSent ? (
          <p style={{ background: "#e8f5e9", color: "#2e7d32", padding: "12px 16px", borderRadius: 8, fontSize: 14 }}>
            ✅ Reset link sent! Check your email.
          </p>
        ) : (
          <form onSubmit={sendForgotPassword} className="login-form">
            {error && <p className="error-msg">{error}</p>}
            <input type="email" placeholder="Your Email Address" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            <button type="submit">Send Reset Link</button>
          </form>
        )}
        <p className="forgot-link" onClick={() => { setShowForgot(false); setForgotSent(false); setError(""); }}>← Back to Login</p>
      </div>
    );
  }

  // ── MAIN LOGIN FORM ──
  return (
    <div className="login-container">
      <img src={logo} alt="LOCUM" className="login-logo" />
      <p>Sign in to your account</p>
      {error && <p className="error-msg">{error}</p>}
      <form onSubmit={submit} className="login-form">
        <input
          name="identifier" type="text"
          placeholder="Email or Department Code (e.g. APOLLO-ICU)"
          required onChange={handle} value={form.identifier}
          style={{ textTransform: form.identifier.includes("@") ? "none" : "uppercase" }}
        />
        <input name="password" type="password" placeholder="Password" required onChange={handle} value={form.password} />
        <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
      </form>
      <p className="forgot-link" onClick={() => setShowForgot(true)}>Forgot Password?</p>
      <p className="switch-link">
        Don't have an account?{" "}
        <span onClick={() => navigate("/register")}>Register here</span>
      </p>
    </div>
  );
}

export default Login;

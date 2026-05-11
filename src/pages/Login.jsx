import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Login.css";
import logo from "../assets/logo.png";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (authError) throw authError;

      const role = data.user.user_metadata?.role;

      if (role === "doctor") {
        const { data: doctor } = await supabase
          .from("doctors")
          .select("status")
          .eq("id", data.user.id)
          .single();
        if (doctor?.status === "frozen") {
          await supabase.auth.signOut();
          setError("Your account has been suspended. Please contact support.");
          setLoading(false);
          return;
        }
        navigate("/doctor/dashboard");

      } else if (role === "nurse") {
        const { data: nurse } = await supabase
          .from("nurses")
          .select("status")
          .eq("id", data.user.id)
          .single();
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
        const { data: hospital } = await supabase
          .from("hospitals")
          .select("status")
          .eq("id", data.user.id)
          .single();
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
              name="email"
              type="email"
              placeholder="Email Address"
              required
              onChange={handle}
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              onChange={handle}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
          <p className="forgot-link" onClick={() => setShowForgot(true)}>
            Forgot Password?
          </p>
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
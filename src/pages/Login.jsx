import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        // Check if doctor account is active
        const { data: doctor } = await supabase
          .from("doctors")
          .select("status")
          .eq("id", data.user.id)
          .single();

        if (doctor?.status === "pending") {
          await supabase.auth.signOut();
          setError("Your account is still under review. You will be notified once approved.");
          setLoading(false);
          return;
        }

        navigate("/doctor/dashboard");

      } else if (role === "hospital") {
        // Check if hospital account is active
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

        navigate("/hospital/dashboard");

      } else {
        setError("Unknown account type. Please contact support.");
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>LOCUM</h1>
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

      <p className="switch-link">
        Don't have an account?{" "}
        <span onClick={() => navigate("/register")}>Register here</span>
      </p>
    </div>
  );
}

export default Login;

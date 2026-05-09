import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Register.css";
import logo from "../assets/logo.png";

function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);

  return (
    <div className="register-container">
      <img src={logo} alt="LOCUM" className="register-logo" />
      <h1>Create Account</h1>
      <p>Register as a Doctor or Hospital</p>

      {!role && (
        <div className="role-select">
          <button onClick={() => setRole("doctor")}>I am a Doctor</button>
          <button onClick={() => setRole("hospital")}>I am a Hospital</button>
        </div>
      )}

      {role === "doctor" && <DoctorForm navigate={navigate} />}
      {role === "hospital" && <HospitalForm navigate={navigate} />}

      {role && (
        <p className="back-link" onClick={() => setRole(null)}>← Go back</p>
      )}

      <p className="switch-link">
        Already have an account?{" "}
        <span onClick={() => navigate("/login")}>Login here</span>
      </p>
    </div>
  );
}

const qualifications = [
  "MBBS (Bachelor of Medicine and Bachelor of Surgery)",
  "MD - General Medicine",
  "MD - Paediatrics",
  "MD - Psychiatry",
  "MD - Dermatology",
  "MD - Anaesthesiology",
  "MD - Radiology",
  "MD - Pathology",
  "MD - Microbiology",
  "MD - Biochemistry",
  "MD - Community Medicine",
  "MS - General Surgery",
  "MS - Orthopaedics",
  "MS - Ophthalmology",
  "MS - ENT (Otorhinolaryngology)",
  "MS - Obstetrics & Gynaecology",
  "MCh - Neurosurgery",
  "MCh - Cardiothoracic Surgery",
  "MCh - Plastic Surgery",
  "MCh - Urology",
  "DM - Cardiology",
  "DM - Neurology",
  "DM - Nephrology",
  "DM - Gastroenterology",
  "DM - Endocrinology",
  "DM - Oncology",
  "DNB - General Medicine",
  "DNB - General Surgery",
  "DNB - Paediatrics",
  "DNB - Obstetrics & Gynaecology",
  "DNB - Orthopaedics",
  "DNB - Anaesthesiology",
  "BDS / MDS (Dentistry)",
  "B.Pharm / M.Pharm (Pharmacy)",
  "B.Sc Nursing / M.Sc Nursing",
  "Diploma in Anaesthesiology (DA)",
  "Diploma in Child Health (DCH)",
  "Diploma in Obstetrics & Gynaecology (DGO)",
  "Diploma in Orthopaedics (D.Ortho)",
  "Diploma in Ophthalmology (DO)",
  "Diploma in ENT",
  "Diploma in Radiology (DMRD)",
  "Fellowship in Emergency Medicine (FCEM)",
  "Other",
];

const TermsCheckbox = ({ agreed, setAgreed }) => (
  <div style={{
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    background: "#f5f7fa",
    borderRadius: 10,
    border: "1px solid #e0e0e0",
    boxSizing: "border-box",
  }}>
    <input
      type="checkbox"
      checked={agreed}
      onChange={(e) => setAgreed(e.target.checked)}
      style={{
        width: "20px",
        minWidth: "20px",
        maxWidth: "20px",
        height: "20px",
        marginTop: 2,
        cursor: "pointer",
        accentColor: "#1e3a5f",
        flexShrink: 0,
      }}
    />
    <div style={{
      fontSize: 14,
      color: "#555",
      lineHeight: 1.6,
      wordBreak: "break-word",
      overflowWrap: "break-word",
    }}>
      I agree to the{" "}
      <a href="/terms" target="_blank" rel="noopener noreferrer"
        style={{ color: "#1e3a5f", fontWeight: 600, textDecoration: "underline" }}>
        Terms of Service
      </a>
      {" "}and{" "}
      <a href="/privacy" target="_blank" rel="noopener noreferrer"
        style={{ color: "#1e3a5f", fontWeight: 600, textDecoration: "underline" }}>
        Privacy Policy
      </a>
    </div>
  </div>
);

function DoctorForm({ navigate }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    qualification: "", experience: "",
    password: "", confirmPassword: "",
  });
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!agreed) { setError("You must agree to the Terms of Service and Privacy Policy to continue."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match!"); return; }
    if (!certificate) { setError("Please upload your certificate."); return; }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { role: "doctor" } }
      });
      if (authError) throw authError;
      const fileExt = certificate.name.split('.').pop();
      const fileName = `doctors/${authData.user.id}/certificate.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, certificate);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("doctors").insert({
        id: authData.user.id,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phone,
        qualification: form.qualification,
        experience: parseInt(form.experience),
        document_url: fileName,
        status: "active",
      });
      if (dbError) throw dbError;
      alert("Registration successful! You can now log in to your account.");
      navigate("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="register-form">
      <h2>Doctor Registration</h2>
      {error && <p className="error-msg">{error}</p>}
      <div className="form-row">
        <input name="firstName" placeholder="First Name" required onChange={handle} />
        <input name="lastName" placeholder="Last Name" required onChange={handle} />
      </div>
      <input name="email" type="email" placeholder="Email Address" required onChange={handle} />
      <input name="phone" type="tel" placeholder="Phone Number" required onChange={handle} />
      <select name="qualification" required onChange={handle} defaultValue="">
        <option value="" disabled>Select Your Qualification</option>
        {qualifications.map((q) => (<option key={q} value={q}>{q}</option>))}
      </select>
      <input name="experience" placeholder="Years of Experience" type="number" required onChange={handle} />
      <label className="file-label">
        Upload Certificate / Proof of Qualification
        <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setCertificate(e.target.files[0])} required />
      </label>
      <input name="password" type="password" placeholder="Create Password" required onChange={handle} />
      <input name="confirmPassword" type="password" placeholder="Confirm Password" required onChange={handle} />
      <TermsCheckbox agreed={agreed} setAgreed={setAgreed} />
      <button type="submit" disabled={loading || !agreed}>
        {loading ? "Submitting..." : "Create Account"}
      </button>
    </form>
  );
}

function HospitalForm({ navigate }) {
  const [form, setForm] = useState({
    hospitalName: "", email: "", phone: "",
    address: "", registrationNumber: "",
    contactPerson: "", password: "", confirmPassword: "",
  });
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!agreed) { setError("You must agree to the Terms of Service and Privacy Policy to continue."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match!"); return; }
    if (!document) { setError("Please upload your registration certificate."); return; }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { role: "hospital" } }
      });
      if (authError) throw authError;
      const fileExt = document.name.split('.').pop();
      const fileName = `hospitals/${authData.user.id}/certificate.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, document);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("hospitals").insert({
        id: authData.user.id,
        hospital_name: form.hospitalName,
        email: form.email,
        phone: form.phone,
        address: form.address,
        registration_number: form.registrationNumber,
        contact_person: form.contactPerson,
        document_url: fileName,
        status: "pending",
      });
      if (dbError) throw dbError;
      alert("Application submitted! Our team will review your registration and notify you once approved.");
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="register-form">
      <h2>Hospital Registration</h2>
      {error && <p className="error-msg">{error}</p>}
      <input name="hospitalName" placeholder="Hospital / Clinic Name" required onChange={handle} />
      <input name="email" type="email" placeholder="Official Email Address" required onChange={handle} />
      <input name="phone" type="tel" placeholder="Phone Number" required onChange={handle} />
      <input name="address" placeholder="Physical Address" required onChange={handle} />
      <input name="registrationNumber" placeholder="Hospital Registration Number" required onChange={handle} />
      <input name="contactPerson" placeholder="Contact Person Full Name" required onChange={handle} />
      <label className="file-label">
        Upload Registration Certificate
        <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setDocument(e.target.files[0])} required />
      </label>
      <input name="password" type="password" placeholder="Create Password" required onChange={handle} />
      <input name="confirmPassword" type="password" placeholder="Confirm Password" required onChange={handle} />
      <TermsCheckbox agreed={agreed} setAgreed={setAgreed} />
      <button type="submit" disabled={loading || !agreed}>
        {loading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

export default Register;
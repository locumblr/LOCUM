import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Register.css";
import logo from "../assets/logo.png";

const RESEND_API_KEY = "re_ioKynYaT_7PSAWgetJWydU68JNvkJG3NG";

const sendEmail = async ({ to, subject, html }) => {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "noreply@bookmylocum.com",
        reply_to: "locum.blr@gmail.com",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    // Non-blocking — don't fail registration if email fails
    console.error("Email send failed:", err);
  }
};

const doctorQualifications = [
  "MBBS (Bachelor of Medicine and Bachelor of Surgery)",
  "MD - General Medicine", "MD - Paediatrics", "MD - Psychiatry",
  "MD - Dermatology", "MD - Anaesthesiology", "MD - Radiology",
  "MD - Radiology with PCPNDT Certification", "MD - Pathology",
  "MD - Microbiology", "MD - Biochemistry", "MD - Community Medicine",
  "MS - General Surgery", "MS - Orthopaedics", "MS - Ophthalmology",
  "MS - ENT (Otorhinolaryngology)", "MS - Obstetrics & Gynaecology",
  "MCh - Neurosurgery", "MCh - Cardiothoracic Surgery", "MCh - Plastic Surgery",
  "MCh - Urology", "DM - Cardiology", "DM - Neurology", "DM - Nephrology",
  "DM - Gastroenterology", "DM - Endocrinology", "DM - Oncology",
  "DNB - General Medicine", "DNB - General Surgery", "DNB - Paediatrics",
  "DNB - Obstetrics & Gynaecology", "DNB - Orthopaedics", "DNB - Anaesthesiology",
  "BDS / MDS (Dentistry)", "B.Pharm / M.Pharm (Pharmacy)",
  "Diploma in Anaesthesiology (DA)", "Diploma in Child Health (DCH)",
  "Diploma in Obstetrics & Gynaecology (DGO)", "Diploma in Orthopaedics (D.Ortho)",
  "Diploma in Ophthalmology (DO)", "Diploma in ENT", "Diploma in Radiology (DMRD)",
  "Diploma in Radiology (DMRD) with PCPNDT Certification",
  "PCPNDT Certified Sonologist", "Fellowship in Emergency Medicine (FCEM)", "Other",
];

const nursingQualifications = [
  "GNM (General Nursing & Midwifery)", "B.Sc Nursing", "Post Basic B.Sc Nursing",
  "M.Sc Nursing", "Critical Care Nursing", "Operation Theatre Nursing",
  "Emergency & Trauma Nursing", "Paediatric Nursing", "Oncology Nursing",
  "Dialysis Nursing", "ICU Nursing", "NICU Nursing", "PICU Nursing",
  "Midwifery", "Community Health Nursing", "Psychiatric Nursing", "Other",
];

const stateMedicalCouncils = [
  "Andhra Pradesh Medical Council", "Arunachal Pradesh Medical Council",
  "Assam Medical Council", "Bihar Medical Council", "Chhattisgarh Medical Council",
  "Delhi Medical Council", "Goa Medical Council", "Gujarat Medical Council",
  "Haryana Medical Council", "Himachal Pradesh Medical Council",
  "Jammu & Kashmir Medical Council", "Jharkhand Medical Council",
  "Karnataka Medical Council", "Kerala Medical Council",
  "Madhya Pradesh Medical Council", "Maharashtra Medical Council",
  "Manipur Medical Council", "Meghalaya Medical Council", "Mizoram Medical Council",
  "Nagaland Medical Council", "Odisha Medical Council", "Punjab Medical Council",
  "Rajasthan Medical Council", "Sikkim Medical Council", "Tamil Nadu Medical Council",
  "Telangana State Medical Council", "Tripura Medical Council",
  "Uttar Pradesh Medical Council", "Uttarakhand Medical Council",
  "West Bengal Medical Council", "National Medical Commission (NMC)",
];

const stateNursingCouncils = [
  "Andhra Pradesh Nurses and Midwives Council",
  "Assam Nurses, Midwives and Health Visitors Council",
  "Bihar Nurses Registration Council", "Delhi Nursing Council",
  "Goa Nursing Council", "Gujarat Nursing Council", "Haryana Nursing Council",
  "Himachal Pradesh Nursing Council", "Karnataka Nursing Council",
  "Kerala Nurses and Midwives Council",
  "Madhya Pradesh Nurses Registration Council", "Maharashtra Nursing Council",
  "Odisha Nursing Council", "Punjab Nurses Registration Council",
  "Rajasthan Nursing Council", "Tamil Nadu Nurses and Midwives Council",
  "Telangana Nursing Council", "Uttar Pradesh Nurses and Midwives Council",
  "West Bengal Nursing Council", "Indian Nursing Council (INC)",
];

function TermsBox({ agreed, setAgreed }) {
  return (
    <div
      onClick={() => setAgreed(!agreed)}
      style={{
        padding: "14px 16px",
        background: agreed ? "#e8f5e9" : "#f5f7fa",
        borderRadius: "10px",
        border: agreed ? "2px solid #27ae60" : "2px solid #e0e0e0",
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "14px", color: "#555", lineHeight: "1.7", margin: 0 }}>
        {agreed ? "✅ " : "☐ "}
        {"I agree to the "}
        <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#1e3a5f", fontWeight: 600 }}>Terms of Service</a>
        {" and "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#1e3a5f", fontWeight: 600 }}>Privacy Policy</a>
      </p>
    </div>
  );
}

function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);

  return (
    <div className="register-container">
      <img src={logo} alt="LOCUM" className="register-logo" />
      <h1>Create Account</h1>
      <p>Register as a Doctor, Nurse or Hospital</p>
      {!role && (
        <div className="role-select">
          <button onClick={() => setRole("doctor")}>I am a Doctor</button>
          <button onClick={() => setRole("nurse")}>I am a Nurse</button>
          <button onClick={() => setRole("hospital")}>I am a Hospital</button>
        </div>
      )}
      {role === "doctor" && <DoctorForm navigate={navigate} />}
      {role === "nurse" && <NurseForm navigate={navigate} />}
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

function DoctorForm({ navigate }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    qualification: "", experience: "",
    nmcRegistrationNumber: "", stateMedicalCouncil: "",
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
        options: { data: { role: "doctor" } },
      });
      if (authError) throw authError;

      const fileExt = certificate.name.split(".").pop();
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
        nmc_registration_number: form.nmcRegistrationNumber,
        state_medical_council: form.stateMedicalCouncil,
        document_url: fileName,
        status: "pending",
      });
      if (dbError) throw dbError;

      await sendEmail({
        to: form.email,
        subject: "Application Received – LOCUM",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
            <h1 style="color: #1e3a5f;">LOCUM</h1>
            <h2>Hi Dr. ${form.firstName} ${form.lastName},</h2>
            <p>Thank you for registering on <strong>LOCUM</strong>.</p>
            <p>Your application is currently <strong>pending verification</strong> by our team. This usually takes up to <strong>24 hours</strong>.</p>
            <p>You will receive another email once your account is approved and active.</p>
            <br/>
            <p style="color: #888; font-size: 13px;">If you have any questions, reply to this email or contact us at <a href="mailto:locum.blr@gmail.com">locum.blr@gmail.com</a></p>
            <p style="color: #888; font-size: 13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
          </div>
        `,
      });

      await supabase.auth.signOut();
      alert("Application submitted! Our team will verify your registration and notify you once approved. This usually takes 24 hours.");
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
      <div style={{ background: "#e3f2fd", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#1565c0", lineHeight: 1.6 }}>
        ℹ️ Your registration will be reviewed by our team within 24 hours. You will be notified once approved.
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="form-row">
        <input name="firstName" placeholder="First Name" required onChange={handle} />
        <input name="lastName" placeholder="Last Name" required onChange={handle} />
      </div>
      <input name="email" type="email" placeholder="Email Address" required onChange={handle} />
      <input name="phone" type="tel" placeholder="Phone Number" required onChange={handle} />
      <select name="qualification" required onChange={handle} defaultValue="">
        <option value="" disabled>Select Your Primary Qualification</option>
        {doctorQualifications.map((q) => (<option key={q} value={q}>{q}</option>))}
      </select>
      <input name="experience" placeholder="Years of Experience" type="number" min="0" required onChange={handle} />
      <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px", marginBottom: 4, border: "1px solid #e0e0e0" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Medical Registration Details
        </p>
        <input
          name="nmcRegistrationNumber"
          placeholder="NMC / State Medical Council Registration Number"
          required
          onChange={handle}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
        />
        <select
          name="stateMedicalCouncil"
          required
          onChange={handle}
          defaultValue=""
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "white" }}
        >
          <option value="" disabled>Select State Medical Council</option>
          {stateMedicalCouncils.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <p style={{ fontSize: 12, color: "#888", marginTop: 8, marginBottom: 0 }}>
          Your registration number will be verified against the NMC registry before activation.
        </p>
      </div>
      <label className="file-label">
        Upload Primary Certificate / Proof of Qualification
        <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setCertificate(e.target.files[0])} required />
      </label>
      {certificate && <p style={{ fontSize: 12, color: "#27ae60", marginTop: 4 }}>✅ {certificate.name}</p>}
      <input name="password" type="password" placeholder="Create Password" required onChange={handle} />
      <input name="confirmPassword" type="password" placeholder="Confirm Password" required onChange={handle} />
      <TermsBox agreed={agreed} setAgreed={setAgreed} />
      <button type="submit" disabled={loading || !agreed}>
        {loading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

function NurseForm({ navigate }) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    qualification: "", experience: "",
    registrationNumber: "", stateNursingCouncil: "",
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
        options: { data: { role: "nurse" } },
      });
      if (authError) throw authError;

      const fileExt = certificate.name.split(".").pop();
      const fileName = `nurses/${authData.user.id}/certificate.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, certificate);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("nurses").insert({
        id: authData.user.id,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phone,
        qualification: form.qualification,
        experience: parseInt(form.experience),
        registration_number: form.registrationNumber,
        state_nursing_council: form.stateNursingCouncil,
        document_url: fileName,
        status: "pending",
      });
      if (dbError) throw dbError;

      await sendEmail({
        to: form.email,
        subject: "Application Received – LOCUM",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
            <h1 style="color: #1e3a5f;">LOCUM</h1>
            <h2>Hi ${form.firstName} ${form.lastName},</h2>
            <p>Thank you for registering on <strong>LOCUM</strong>.</p>
            <p>Your application is currently <strong>pending verification</strong> by our team. This usually takes up to <strong>24 hours</strong>.</p>
            <p>You will receive another email once your account is approved and active.</p>
            <br/>
            <p style="color: #888; font-size: 13px;">If you have any questions, reply to this email or contact us at <a href="mailto:locum.blr@gmail.com">locum.blr@gmail.com</a></p>
            <p style="color: #888; font-size: 13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
          </div>
        `,
      });

      await supabase.auth.signOut();
      alert("Application submitted! Our team will verify your registration and notify you once approved. This usually takes 24 hours.");
      navigate("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="register-form">
      <h2>Nurse Registration</h2>
      <div style={{ background: "#f3e5f5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#6a0dad", lineHeight: 1.6 }}>
        ℹ️ Your registration will be reviewed by our team within 24 hours. You will be notified once approved.
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="form-row">
        <input name="firstName" placeholder="First Name" required onChange={handle} />
        <input name="lastName" placeholder="Last Name" required onChange={handle} />
      </div>
      <input name="email" type="email" placeholder="Email Address" required onChange={handle} />
      <input name="phone" type="tel" placeholder="Phone Number" required onChange={handle} />
      <select name="qualification" required onChange={handle} defaultValue="">
        <option value="" disabled>Select Your Primary Qualification</option>
        {nursingQualifications.map((q) => (<option key={q} value={q}>{q}</option>))}
      </select>
      <input name="experience" placeholder="Years of Experience" type="number" min="0" required onChange={handle} />
      <div style={{ background: "#f9fafb", borderRadius: 10, padding: "14px 16px", marginBottom: 4, border: "1px solid #e0e0e0" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Nursing Council Registration Details
        </p>
        <input
          name="registrationNumber"
          placeholder="Nursing Council Registration Number"
          required
          onChange={handle}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
        />
        <select
          name="stateNursingCouncil"
          required
          onChange={handle}
          defaultValue=""
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "white" }}
        >
          <option value="" disabled>Select State Nursing Council</option>
          {stateNursingCouncils.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <p style={{ fontSize: 12, color: "#888", marginTop: 8, marginBottom: 0 }}>
          Your registration number will be verified before activation.
        </p>
      </div>
      <label className="file-label">
        Upload Primary Certificate / Proof of Qualification
        <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setCertificate(e.target.files[0])} required />
      </label>
      {certificate && <p style={{ fontSize: 12, color: "#27ae60", marginTop: 4 }}>✅ {certificate.name}</p>}
      <input name="password" type="password" placeholder="Create Password" required onChange={handle} />
      <input name="confirmPassword" type="password" placeholder="Confirm Password" required onChange={handle} />
      <TermsBox agreed={agreed} setAgreed={setAgreed} />
      <button type="submit" disabled={loading || !agreed}>
        {loading ? "Submitting..." : "Submit Application"}
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
        options: { data: { role: "hospital" } },
      });
      if (authError) throw authError;

      const fileExt = document.name.split(".").pop();
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

      await sendEmail({
        to: form.email,
        subject: "Hospital Registration Received – LOCUM",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
            <h1 style="color: #1e3a5f;">LOCUM</h1>
            <h2>Hi ${form.hospitalName},</h2>
            <p>Thank you for registering on <strong>LOCUM</strong>.</p>
            <p>Your hospital registration is currently <strong>pending verification</strong> by our team.</p>
            <p>Once approved, your department accounts will be automatically created and you can start posting locum duties.</p>
            <br/>
            <p style="color: #888; font-size: 13px;">If you have any questions, reply to this email or contact us at <a href="mailto:locum.blr@gmail.com">locum.blr@gmail.com</a></p>
            <p style="color: #888; font-size: 13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
          </div>
        `,
      });

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
      <div style={{ background: "#e8f5e9", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#2e7d32", lineHeight: 1.6 }}>
        ℹ️ Your registration will be reviewed by our team. You will be notified once approved.
      </div>
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
      {document && <p style={{ fontSize: 12, color: "#27ae60", marginTop: 4 }}>✅ {document.name}</p>}
      <input name="password" type="password" placeholder="Create Password" required onChange={handle} />
      <input name="confirmPassword" type="password" placeholder="Confirm Password" required onChange={handle} />
      <TermsBox agreed={agreed} setAgreed={setAgreed} />
      <button type="submit" disabled={loading || !agreed}>
        {loading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

export default Register;

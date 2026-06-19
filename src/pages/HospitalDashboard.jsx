import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./HospitalDashboard.css";

const RESEND_API_KEY = "re_ioKynYaT_7PSAWgetJWydU68JNvkJG3NG";

const sendEmail = async ({ to, subject, html }) => {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: "noreply@bookmylocum.com", reply_to: "locum.blr@gmail.com", to: [to], subject, html }),
    });
  } catch (err) { console.error("Email error:", err); }
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString("default", { month: "long" });
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${monthName} ${day}${suffix}, ${year}`;
};

const allQualifications = [
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
  "BDS / MDS (Dentistry)", "B.Pharm / M.Pharm (Pharmacy)", "B.Sc Nursing / M.Sc Nursing",
  "Diploma in Anaesthesiology (DA)", "Diploma in Child Health (DCH)",
  "Diploma in Obstetrics & Gynaecology (DGO)", "Diploma in Orthopaedics (D.Ortho)",
  "Diploma in Ophthalmology (DO)", "Diploma in ENT", "Diploma in Radiology (DMRD)",
  "Diploma in Radiology (DMRD) with PCPNDT Certification",
  "PCPNDT Certified Sonologist", "Fellowship in Emergency Medicine (FCEM)", "Other",
];

const NURSING_AREAS = ["Ward", "OT", "ICU", "Dialysis", "ER"];
const OT_SUBTYPES = ["General Surgery", "Orthopaedics", "Neurosurgery", "Obstetrics & Gynaecology"];

function NursingAreaPicker({ selected, onSelect }) {
  const isOT = selected.length > 0 && selected[0].startsWith("OT");
  const showOTSubs = isOT || selected[0] === undefined && false;

  const selectArea = (area) => {
    if (area === "OT") {
      onSelect(["OT"]);
    } else {
      onSelect([area]);
    }
  };

  const selectOTSub = (sub) => {
    onSelect([`OT - ${sub}`]);
  };

  const activeArea = selected[0]?.startsWith("OT") ? "OT" : selected[0];
  const activeOTSub = selected[0]?.startsWith("OT - ") ? selected[0].replace("OT - ", "") : null;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {NURSING_AREAS.map(area => (
          <button key={area} type="button" onClick={() => selectArea(area)}
            style={{ padding: "9px 18px", borderRadius: 20, border: `2px solid ${activeArea === area ? "#1e3a5f" : "#ddd"}`,
              background: activeArea === area ? "#1e3a5f" : "white", color: activeArea === area ? "white" : "#333",
              fontWeight: activeArea === area ? 700 : 400, cursor: "pointer", fontSize: 14 }}>
            {area}
          </button>
        ))}
      </div>
      {activeArea === "OT" && (
        <div style={{ marginLeft: 8, paddingLeft: 16, borderLeft: "3px solid #1e3a5f", marginTop: 10 }}>
          <p style={{ fontSize: 13, color: "#555", marginBottom: 8, fontWeight: 600 }}>Select OT specialty:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {OT_SUBTYPES.map(sub => (
              <button key={sub} type="button" onClick={() => selectOTSub(sub)}
                style={{ padding: "7px 14px", borderRadius: 20, border: `2px solid ${activeOTSub === sub ? "#6a0dad" : "#ddd"}`,
                  background: activeOTSub === sub ? "#6a0dad" : "white", color: activeOTSub === sub ? "white" : "#333",
                  fontWeight: activeOTSub === sub ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}
      {selected.length > 0 && selected[0] !== "OT" && (
        <p style={{ fontSize: 13, color: "#27ae60", marginTop: 10 }}>✓ {selected[0]}</p>
      )}
    </div>
  );
}

const emptyForm = { date: "", start_time: "", end_time: "", qualifications: [], pay: "", notes: "" };

const isRadiology = (qualifications) =>
  qualifications.some(q => q.toLowerCase().includes("radio") || q.toLowerCase().includes("pcpndt") || q.toLowerCase().includes("sonolog"));

const inputStyle = {
  display: "block",
  width: "100%",
  maxWidth: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 16,
  boxSizing: "border-box",
  WebkitAppearance: "none",
  background: "white",
  fontFamily: "inherit",
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#555",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 6,
};

const fieldStyle = {
  marginBottom: 16,
  width: "100%",
};

const CONSULTATION_SPECIALTIES = [
  "Rheumatology", "Haematology", "Medical Oncology", "Surgical Oncology",
  "Nephrology", "Gastroenterology", "Hepatology", "Endocrinology",
  "Neurology", "Pulmonology", "Infectious Disease", "Clinical Immunology",
  "Neonatology", "Paediatric Cardiology", "Geriatrics", "Palliative Care",
  "Psychiatry", "Dermatology", "Allergy & Immunology", "Clinical Genetics",
];

const CONSULT_SLOTS = ["Morning (8am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–8pm)"];
const SLOT_TIMES = {
  "Morning (8am–12pm)": { start_time: "08:00", end_time: "12:00" },
  "Afternoon (12pm–5pm)": { start_time: "12:00", end_time: "17:00" },
  "Evening (5pm–8pm)": { start_time: "17:00", end_time: "20:00" },
};

const emptyConsultForm = { qualification: "", date: "", slot: "", pay: "", notes: "" };

function QualificationPicker({ qualifications, selected, onAdd, onRemove }) {
  const [current, setCurrent] = useState("");
  const available = qualifications.filter(q => !selected.includes(q));

  const handleAdd = () => {
    if (current && !selected.includes(current)) {
      onAdd(current);
      setCurrent("");
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
        <select
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        >
          <option value="">Select a qualification...</option>
          {available.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!current}
          style={{ padding: "10px 16px", background: current ? "#1e3a5f" : "#ccc", color: "white", border: "none", borderRadius: 8, cursor: current ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
        >
          + Add
        </button>
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {selected.map(q => (
            <span key={q} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1e3a5f", color: "white", padding: "5px 12px", borderRadius: 20, fontSize: 13, maxWidth: "100%", wordBreak: "break-word" }}>
              {q}
              <button type="button" onClick={() => onRemove(q)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HospitalDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalEmail, setHospitalEmail] = useState("");
  const [hospitalId, setHospitalId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [payingDutyId, setPayingDutyId] = useState(null);
  const [showConsultForm, setShowConsultForm] = useState(false);
  const [consultForm, setConsultForm] = useState(emptyConsultForm);
  const [submittingConsult, setSubmittingConsult] = useState(false);

  useEffect(() => { fetchHospitalData(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hospitalId) checkExpiredDuties(hospitalId);
    }, 60000);
    return () => clearInterval(interval);
  }, [hospitalId]);

  const fetchHospitalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setHospitalId(user.id);
    const { data } = await supabase.from("hospitals").select("hospital_name, status, email").eq("id", user.id).single();
    if (!data || data.status === "frozen" || data.status === "rejected") {
      await supabase.auth.signOut(); navigate("/login"); return;
    }
    setHospitalName(data.hospital_name);
    setHospitalEmail(data.email);
    fetchDuties(user.id);
    fetchNotifications(user.id);
    checkExpiredDuties(user.id);
  };

  const checkExpiredDuties = async (uid) => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: expiredDuties } = await supabase
      .from("locum_duties")
      .select("*, doctors(first_name, last_name, qualification, phone, email)")
      .eq("hospital_id", uid)
      .eq("booking_status", "locked")
      .lt("locked_at", fourHoursAgo);
    if (!expiredDuties || expiredDuties.length === 0) return;
    for (const duty of expiredDuties) {
      await supabase.from("locum_duties").update({
        booking_status: "expired", booked: false, booked_by: null, locked_at: null,
      }).eq("id", duty.id);
      await supabase.from("notifications").insert({
        user_id: uid,
        title: "⏰ Duty Expired — Payment Not Received",
        message: `The ${duty.qualification} duty on ${formatDate(duty.date)} was not confirmed within 4 hours and has expired.`,
      });
      const staff = duty.doctors || duty.nurses;
      if (staff?.email) {
        await sendEmail({
          to: staff.email,
          subject: "Duty Expired – LOCUM",
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
            <h1 style="color:#1e3a5f;">LOCUM</h1>
            <h2 style="color:#e74c3c;">⏰ Duty Expired</h2>
            <p>Hi ${staff.first_name},</p>
            <p>The hospital did not confirm your <strong>${duty.qualification}</strong> duty on <strong>${formatDate(duty.date)}</strong> within 4 hours. You are now free to book other duties.</p>
            <a href="https://bookmylocum.com/login" style="display:inline-block;padding:14px 28px;background:#1e3a5f;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">Find Other Duties</a>
            <p style="color:#888;font-size:13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
          </div>`,
        });
      }
    }
    fetchDuties(uid);
    fetchNotifications(uid);
  };

  const fetchDuties = async (uid) => {
    setLoading(true);
    console.log("Fetching duties for uid:", uid);
    const { data, error } = await supabase
      .from("locum_duties")
     .select("*, doctors(first_name, last_name, qualification, phone, email)")
      .eq("hospital_id", uid)
      .eq("completed", false)
      .order("created_at", { ascending: false });
    console.log("DATA:", JSON.stringify(data));
    console.log("ERROR:", JSON.stringify(error));
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const fetchNotifications = async (uid) => {
    const { data } = await supabase.from("notifications").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    setNotifications(data || []);
    setUnreadCount((data || []).filter(n => !n.read).length);
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", hospitalId);
    fetchNotifications(hospitalId);
  };

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const addQual = (q) => setForm({ ...form, qualifications: [...form.qualifications, q] });
  const removeQual = (q) => setForm({ ...form, qualifications: form.qualifications.filter(x => x !== q) });

  const submit = async () => {
    if (form.qualifications.length === 0) { alert(showForm === "nurse" ? "Please select a duty area." : "Please select at least one qualification."); return; }
    if (showForm === "nurse" && form.qualifications[0] === "OT") { alert("Please select an OT specialty (General Surgery, Orthopaedics, Neurosurgery, or OBG)."); return; }
    if (!form.date || !form.start_time || !form.end_time || !form.pay) { alert("Please fill in all required fields."); return; }
    setSubmitting(true);
    const grossPay = parseFloat(form.pay);
    const platformFee = Math.round(grossPay * 0.2);
    const platformRevenue = Math.round(platformFee / 1.18);
    const gstOnFee = platformFee - platformRevenue;
    const { error } = await supabase.from("locum_duties").insert({
      hospital_id: hospitalId,
      date: form.date, start_time: form.start_time, end_time: form.end_time,
      qualification: form.qualifications[0], qualifications: form.qualifications,
      pay: grossPay, gross_pay: grossPay, platform_fee: platformFee,
      gst_on_fee: gstOnFee, notes: form.notes,
      booked: false, completed: false, booking_status: "open", payment_status: "unpaid",
      duty_type: showForm,
    });
    if (error) {
      alert("Error posting duty: " + error.message);
    } else {
      for (const q of form.qualifications) {
        await supabase.functions.invoke("send-push", {
          body: {
            qualification: q,
            title: "New Locum Duty Available!",
            body: `New duty on ${formatDate(form.date)}. Rs.${grossPay.toLocaleString()}`,
            url: showForm === "nurse" ? "/nurse/dashboard" : "/doctor/dashboard",
          },
        });
      }
      alert("Duty posted successfully!");
      setForm(emptyForm); setShowForm(null);
      fetchDuties(hospitalId);
    }
    setSubmitting(false);
  };

  const handleConsult = (e) => setConsultForm({ ...consultForm, [e.target.name]: e.target.value });

  const submitConsult = async () => {
    if (!consultForm.qualification) { alert("Please select a specialty."); return; }
    if (!consultForm.date || !consultForm.slot || !consultForm.pay) { alert("Please fill in all required fields."); return; }
    setSubmittingConsult(true);
    const perConsultPay = parseFloat(consultForm.pay);
    const grossPay = perConsultPay * 3;
    const platformFee = Math.round(grossPay * 0.2);
    const { start_time, end_time } = SLOT_TIMES[consultForm.slot];
    const { error } = await supabase.from("locum_duties").insert({
      hospital_id: hospitalId,
      duty_type: "consultation",
      qualification: consultForm.qualification,
      qualifications: [consultForm.qualification],
      date: consultForm.date,
      start_time, end_time,
      pay: perConsultPay,
      gross_pay: grossPay,
      platform_fee: platformFee,
      notes: consultForm.notes,
      booked: false, completed: false, booking_status: "open", payment_status: "unpaid",
    });
    if (error) {
      alert("Error posting consultation: " + error.message);
    } else {
      await supabase.functions.invoke("send-push", {
        body: {
          qualification: consultForm.qualification,
          title: "New Consultation Request!",
          body: `In-patient ${consultForm.qualification} consultation on ${formatDate(consultForm.date)}. Rs.${grossPay.toLocaleString()} (3 sessions)`,
          url: "/doctor/dashboard",
        },
      });
      alert("Consultation posted successfully!");
      setConsultForm(emptyConsultForm);
      setShowConsultForm(false);
      fetchDuties(hospitalId);
    }
    setSubmittingConsult(false);
  };

  const cancelLockedDuty = async (duty) => {
    const confirmed = window.confirm("Cancel this duty? The doctor/nurse will be notified and freed to take other duties.");
    if (!confirmed) return;
    await supabase.from("locum_duties").update({
      booking_status: "expired", booked: false, booked_by: null, locked_at: null,
    }).eq("id", duty.id);
    const staff = duty.doctors || duty.nurses;
    if (staff?.email) {
      await sendEmail({
        to: staff.email,
        subject: "Duty Cancelled – LOCUM",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
          <h1 style="color:#1e3a5f;">LOCUM</h1>
          <h2 style="color:#e74c3c;">Duty Cancelled</h2>
          <p>Hi ${staff.first_name},</p>
          <p>The hospital has cancelled the <strong>${duty.qualification}</strong> duty on <strong>${formatDate(duty.date)}</strong>. You are free to book other duties.</p>
          <a href="https://bookmylocum.com/login" style="display:inline-block;padding:14px 28px;background:#1e3a5f;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">Find Other Duties</a>
          <p style="color:#888;font-size:13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
        </div>`,
      });
    }
    await supabase.from("notifications").insert({
      user_id: hospitalId,
      title: "Duty Cancelled",
      message: `The ${duty.qualification} duty on ${formatDate(duty.date)} has been cancelled.`,
    });
    fetchDuties(hospitalId);
  };

  const payPlatformFee = async (duty) => {
    setPayingDutyId(duty.id);
    const staff = duty.doctors || duty.nurses;
    const staffType = duty.doctors ? "Doctor" : "Nurse";
    const staffTitle = duty.doctors ? "Dr. " : "";
    alert(
      `Platform Fee Payment\n\nDuty: ${duty.qualification} on ${formatDate(duty.date)}\n${staffType}: ${staffTitle}${staff?.first_name} ${staff?.last_name}\n\nAmount: Rs.${(duty.platform_fee || 0).toLocaleString()} (incl. GST)\n\nPayment gateway coming soon. Please contact locum.blr@gmail.com to complete payment and confirm this duty.`
    );
    setPayingDutyId(null);
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const getTimeRemaining = (lockedAt) => {
    if (!lockedAt) return null;
    const expiry = new Date(new Date(lockedAt).getTime() + 4 * 60 * 60 * 1000);
    const diff = expiry - new Date();
    if (diff <= 0) return "Expiring...";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m remaining`;
  };

  const getStatusLabel = (duty) => {
    if (duty.booking_status === "confirmed") return <span className="status-badge status-confirmed">✅ Confirmed</span>;
    if (duty.booking_status === "locked") return <span className="status-badge status-pending">🔒 Locked — Awaiting Payment</span>;
    if (duty.booking_status === "expired") return <span className="status-badge" style={{ background: "#f5f5f5", color: "#999" }}>⏰ Expired</span>;
    if (duty.booking_status === "reopened") return <span className="status-badge status-reopened">🔄 Re-opened</span>;
    return <span className="status-badge status-open">Open</span>;
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, paddingTop: 16, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ color: "#1e3a5f", fontSize: 28, fontWeight: 700, margin: 0 }}>Hospital Dashboard</h1>
          {hospitalName && <p style={{ color: "#888", fontSize: 14, margin: "4px 0 0" }}>{hospitalName}</p>}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => navigate("/hospital/locums")} style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#1e3a5f", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>My Locums</button>
          <button onClick={() => navigate("/hospital/profile")} style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#1e3a5f", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Profile</button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ position: "relative", padding: "10px 16px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
              {unreadCount > 0 && <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "#e74c3c", borderRadius: "50%" }} />}
              ⋮
            </button>
            {showMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 200, minWidth: 180, overflow: "hidden" }}>
                <button onClick={() => { setShowNotifications(!showNotifications); markAllRead(); setShowMenu(false); }} style={{ width: "100%", padding: "14px 18px", background: "none", border: "none", textAlign: "left", fontSize: 14, color: "#333", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
                  🔔 Notifications {unreadCount > 0 && <span style={{ background: "#e74c3c", color: "white", borderRadius: 20, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{unreadCount}</span>}
                </button>
                <button onClick={() => { navigate("/help"); setShowMenu(false); }} style={{ width: "100%", padding: "14px 18px", background: "none", border: "none", textAlign: "left", fontSize: 14, color: "#333", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>❓ Help</button>
                <button onClick={logout} style={{ width: "100%", padding: "14px 18px", background: "none", border: "none", textAlign: "left", fontSize: 14, color: "#e74c3c", cursor: "pointer" }}>🚪 Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {showNotifications && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <h3 style={{ color: "#1e3a5f", marginBottom: 16, fontSize: 16 }}>🔔 Notifications</h3>
          {notifications.length === 0 ? <p style={{ color: "#888", fontSize: 14 }}>No notifications yet</p> :
            notifications.map(n => (
              <div key={n.id} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0", borderLeft: n.read ? "none" : "3px solid #1e3a5f", paddingLeft: n.read ? 0 : 10 }}>
                <p style={{ fontWeight: 600, color: "#1e3a5f", fontSize: 14, marginBottom: 4 }}>{n.title}</p>
                <p style={{ color: "#555", fontSize: 13, marginBottom: 4, lineHeight: 1.5 }}>{n.message}</p>
                <p style={{ color: "#aaa", fontSize: 12 }}>{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))}
        </div>
      )}

      {/* Post Buttons */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexDirection: "column" }}>
        <button onClick={() => { setShowForm(showForm === "doctor" ? null : "doctor"); setForm(emptyForm); setShowConsultForm(false); }}
          style={{ padding: "16px 20px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%" }}>
          {showForm === "doctor" ? "Cancel" : "+ Post Doctor Locum"}
        </button>
        <button onClick={() => { setShowForm(showForm === "nurse" ? null : "nurse"); setForm(emptyForm); setShowConsultForm(false); }}
          style={{ padding: "16px 20px", background: "#6a0dad", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%" }}>
          {showForm === "nurse" ? "Cancel" : "+ Post Nurse Locum"}
        </button>
        <button onClick={() => { setShowConsultForm(!showConsultForm); setShowForm(null); setConsultForm(emptyConsultForm); }}
          style={{ padding: "16px 20px", background: "#1565c0", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", width: "100%" }}>
          {showConsultForm ? "Cancel" : "+ Post Specialist Consultation"}
        </button>
      </div>

      {/* Consultation Form */}
      {showConsultForm && (
        <div style={{ background: "white", borderRadius: 16, padding: "20px 16px", marginBottom: 32, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: "100%", boxSizing: "border-box" }}>
          <h2 style={{ color: "#1565c0", marginBottom: 8, fontSize: 20 }}>Post a Specialist Consultation</h2>
          <div style={{ background: "#e3f2fd", border: "1px solid #1565c0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1565c0" }}>
            🏥 For admitted in-patients needing a specialist opinion. Minimum 3 sessions: initial consult, review with investigations, and discharge advice.
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Specialty Required</label>
            <select name="qualification" value={consultForm.qualification} onChange={handleConsult} style={inputStyle}>
              <option value="">Select a specialty...</option>
              {CONSULTATION_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Date of First Consultation</label>
            <input name="date" type="date" value={consultForm.date} onChange={handleConsult} style={inputStyle} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Preferred Time Slot</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {CONSULT_SLOTS.map(slot => (
                <button key={slot} type="button" onClick={() => setConsultForm({ ...consultForm, slot })}
                  style={{ padding: "10px 18px", borderRadius: 8, border: `2px solid ${consultForm.slot === slot ? "#1565c0" : "#ddd"}`,
                    background: consultForm.slot === slot ? "#1565c0" : "white", color: consultForm.slot === slot ? "white" : "#333",
                    fontWeight: consultForm.slot === slot ? 700 : 400, cursor: "pointer", fontSize: 14 }}>
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Fee per Consultation (Rs.)</label>
            <input name="pay" type="number" placeholder="e.g. 2000" value={consultForm.pay} onChange={handleConsult} style={inputStyle} />
            {consultForm.pay && parseFloat(consultForm.pay) > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: "10px 14px", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>👨‍⚕️ Specialist receives (total 3 sessions)</span>
                  <span>Rs.{(parseFloat(consultForm.pay) * 3).toLocaleString()}</span>
                </div>
                <div style={{ background: "#e3f2fd", color: "#1565c0", padding: "10px 14px", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>🏢 Platform fee (20%, incl. GST)</span>
                  <span>Rs.{Math.round(parseFloat(consultForm.pay) * 3 * 0.2).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Additional Notes (optional)</label>
            <textarea name="notes" placeholder="e.g. Patient has lupus nephritis, admitted for 5 days..." value={consultForm.notes} onChange={handleConsult} rows={3} style={inputStyle} />
          </div>

          <button type="button" onClick={submitConsult} disabled={submittingConsult}
            style={{ width: "100%", padding: 14, background: submittingConsult ? "#aaa" : "#1565c0", color: "white", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: submittingConsult ? "not-allowed" : "pointer", marginTop: 8 }}>
            {submittingConsult ? "Posting..." : "Post Consultation Request"}
          </button>
        </div>
      )}

      {/* Post Form */}
      {showForm && (
        <div style={{ background: "white", borderRadius: 16, padding: "20px 16px", marginBottom: 32, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: "100%", boxSizing: "border-box" }}>
          <h2 style={{ color: "#1e3a5f", marginBottom: 20, fontSize: 20 }}>Post a {showForm === "nurse" ? "Nurse" : "Doctor"} Locum Duty</h2>

          {showForm === "nurse" && (
            <div style={{ background: "#f3e5f5", border: "1px solid #6a0dad", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#4a0080" }}>
              💜 You are posting a <strong>Nurse Locum</strong> duty
            </div>
          )}

          <div style={{ background: "#e3f2fd", border: "1px solid #1565c0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1565c0" }}>
            ℹ️ Duty goes live immediately. When a doctor/nurse accepts, you'll be notified to pay the platform fee (20% of duty pay) to confirm. You have 4 hours to pay, after which the duty is cancelled.
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Date</label>
            <input name="date" type="date" required onChange={handle} value={form.date} style={inputStyle} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Start Time</label>
            <input name="start_time" type="time" required onChange={handle} value={form.start_time} style={inputStyle} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>End Time</label>
            <input name="end_time" type="time" required onChange={handle} value={form.end_time} style={inputStyle} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              {showForm === "nurse" ? "Duty Area" : "Required Qualifications"}{" "}
              {showForm !== "nurse" && form.qualifications.length > 0 && <span style={{ color: "#27ae60", fontSize: 13, textTransform: "none" }}>({form.qualifications.length} selected)</span>}
            </label>
            {showForm === "nurse" ? (
              <NursingAreaPicker
                selected={form.qualifications}
                onSelect={(areas) => setForm({ ...form, qualifications: areas })}
              />
            ) : (
              <>
                {isRadiology(form.qualifications) && (
                  <div style={{ background: "#fff8e1", border: "1px solid #ffcc02", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#795500", marginBottom: 8 }}>
                    ⚠️ <strong>PCPNDT Notice:</strong> Select <strong>"with PCPNDT Certification"</strong> if this duty involves ultrasound examinations.
                  </div>
                )}
                <QualificationPicker
                  qualifications={allQualifications}
                  selected={form.qualifications}
                  onAdd={addQual}
                  onRemove={removeQual}
                />
              </>
            )}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Pay to {showForm === "nurse" ? "Nurse" : "Doctor"} (Rs.)</label>
            <input name="pay" type="number" placeholder="e.g. 10000" required onChange={handle} value={form.pay} style={inputStyle} />
            {form.pay && parseFloat(form.pay) > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: "#e8f5e9", color: "#2e7d32", padding: "10px 14px", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>👨‍⚕️ {showForm === "nurse" ? "Nurse" : "Doctor"} receives</span>
                  <span>Rs.{parseFloat(form.pay).toLocaleString()}</span>
                </div>
                <div style={{ background: "#e3f2fd", color: "#1565c0", padding: "10px 14px", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>🏢 Platform fee (20%, incl. GST)</span>
                  <span>Rs.{Math.round(parseFloat(form.pay) * 0.2).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Additional Notes (optional)</label>
            <textarea name="notes" placeholder="Any special requirements..." onChange={handle} value={form.notes} rows={3} style={inputStyle} />
          </div>

          <button type="button" onClick={submit} disabled={submitting}
            style={{ width: "100%", padding: 14, background: submitting ? "#aaa" : "#1e3a5f", color: "white", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", marginTop: 8 }}>
            {submitting ? "Posting..." : "Post Duty"}
          </button>
        </div>
      )}

      {/* Posted Duties */}
      <h2 style={{ color: "#1e3a5f", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Posted Duties</h2>
      {loading ? <p style={{ color: "#888" }}>Loading...</p> :
        duties.length === 0 ? <p style={{ color: "#888", textAlign: "center", padding: "40px 20px" }}>No duties posted yet.</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {duties.map((duty) => {
            const staff = duty.doctors || duty.nurses;
            const staffTitle = duty.doctors ? "Dr. " : "";
            const isLocked = duty.booking_status === "locked";
            const isConfirmed = duty.booking_status === "confirmed";
            const isExpired = duty.booking_status === "expired";
            return (
              <div key={duty.id} style={{ background: "white", borderRadius: 12, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.07)", opacity: isExpired ? 0.6 : 1, borderLeft: isConfirmed || isLocked ? "4px solid #f39c12" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                  <h3 style={{ color: "#1e3a5f", fontSize: 15, fontWeight: 600, flex: 1, lineHeight: 1.4, margin: 0 }}>
                    {duty.qualifications && duty.qualifications.length > 1 ? `${duty.qualifications.length} Qualifications` : duty.qualification}
                  </h3>
                  <span style={{ background: "#e8f5e9", color: "#2e7d32", padding: "4px 10px", borderRadius: 20, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                    Rs.{(duty.gross_pay || duty.pay).toLocaleString()}
                  </span>
                </div>
                <div>
                  <p style={{ color: "#555", fontSize: 14, marginBottom: 6 }}>📅 {formatDate(duty.date)}</p>
                  <p style={{ color: "#555", fontSize: 14, marginBottom: 6 }}>🕐 {duty.start_time} - {duty.end_time}</p>
                  {duty.duty_type === "nurse" && (
                    <span style={{ background: "#f3e5f5", color: "#6a0dad", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Nurse Duty</span>
                  )}
                  {duty.qualifications && duty.qualifications.length > 1 && (
                    <div style={{ marginTop: 6 }}>
                      {duty.qualifications.map(q => (
                        <span key={q} style={{ display: "inline-block", background: "#e3f2fd", color: "#1565c0", borderRadius: 20, padding: "2px 10px", fontSize: 12, marginRight: 4, marginBottom: 4 }}>{q}</span>
                      ))}
                    </div>
                  )}
                  {duty.notes && <p style={{ color: "#555", fontSize: 14, marginBottom: 6 }}>📝 {duty.notes}</p>}

                  {isConfirmed && staff && (
                    <div style={{ marginTop: 10, background: "#e8f5e9", borderRadius: 8, padding: "10px 12px" }}>
                      <p style={{ fontWeight: 700, color: "#2e7d32", marginBottom: 6, fontSize: 13 }}>✅ Confirmed Staff</p>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>👤 {staffTitle}{staff.first_name} {staff.last_name}</p>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>🎓 {staff.qualification}</p>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>📞 {staff.phone}</p>
                    </div>
                  )}

                  {isLocked && (
                    <div style={{ marginTop: 10, background: "#fff8e1", borderRadius: 8, padding: "10px 12px" }}>
                      <p style={{ fontWeight: 700, color: "#795500", marginBottom: 6, fontSize: 13 }}>🔒 A {duty.duty_type === "nurse" ? "nurse" : "doctor"} has accepted</p>
                      <p style={{ fontSize: 13, margin: "2px 0", color: "#888" }}>Pay platform fee to confirm and see full details</p>
                      <p style={{ fontSize: 12, color: "#e74c3c", margin: "4px 0" }}>⏰ {getTimeRemaining(duty.locked_at)}</p>
                      <p style={{ fontSize: 13, margin: "4px 0", fontWeight: 600, color: "#1e3a5f" }}>Platform fee: Rs.{(duty.platform_fee || 0).toLocaleString()} (incl. GST)</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button onClick={() => payPlatformFee(duty)} disabled={payingDutyId === duty.id}
                          style={{ padding: "10px 20px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          {payingDutyId === duty.id ? "Processing..." : "💳 Pay & Confirm"}
                        </button>
                        <button onClick={() => cancelLockedDuty(duty)}
                          style={{ padding: "10px 16px", background: "#fce4ec", color: "#c62828", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {getStatusLabel(duty)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HospitalDashboard;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./HospitalDashboard.css";

const allQualifications = [
  "MBBS (Bachelor of Medicine and Bachelor of Surgery)",
  "MD - General Medicine",
  "MD - Paediatrics",
  "MD - Psychiatry",
  "MD - Dermatology",
  "MD - Anaesthesiology",
  "MD - Radiology",
  "MD - Radiology with PCPNDT Certification",
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
  "Diploma in Radiology (DMRD) with PCPNDT Certification",
  "PCPNDT Certified Sonologist",
  "Fellowship in Emergency Medicine (FCEM)",
  "Other",
];

const nursingQualifications = [
  "GNM (General Nursing & Midwifery)",
  "B.Sc Nursing",
  "Post Basic B.Sc Nursing",
  "M.Sc Nursing",
  "Critical Care Nursing",
  "Operation Theatre Nursing",
  "Emergency & Trauma Nursing",
  "Paediatric Nursing",
  "Oncology Nursing",
  "Dialysis Nursing",
  "ICU Nursing",
  "NICU Nursing",
  "PICU Nursing",
  "Midwifery",
  "Community Health Nursing",
  "Psychiatric Nursing",
  "Other",
];

const emptyForm = {
  date: "", start_time: "", end_time: "",
  qualifications: [], pay: "", notes: "",
};

const isRadiology = (qualifications) =>
  qualifications.some(q =>
    q.toLowerCase().includes("radio") ||
    q.toLowerCase().includes("pcpndt") ||
    q.toLowerCase().includes("sonolog")
  );

function HospitalDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hospitalName, setHospitalName] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showQualDropdown, setShowQualDropdown] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    fetchHospitalData();
    fetchDuties();
    fetchNotifications();
    fetchPendingInvoice();
  }, []);

  const fetchHospitalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data } = await supabase.from("hospitals").select("hospital_name").eq("id", user.id).single();
    if (data) setHospitalName(data.hospital_name);
  };

  const fetchDuties = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*")
      .eq("hospital_id", user.id)
      .eq("completed", false)
      .order("created_at", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications(data || []);
    setUnreadCount((data || []).filter(n => !n.read).length);
  };

  const fetchPendingInvoice = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("monthly_invoices")
      .select("*")
      .eq("hospital_id", user.id)
      .neq("status", "paid")
      .eq("admin_verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      setPendingInvoice(data);
      // Show reminder if due date is within 2 days or past
      const dueDate = new Date(data.due_date);
      const today = new Date();
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 2) setShowPaymentReminder(true);
    }
  };

  const markAsPaid = async () => {
    if (!pendingInvoice) return;
    setMarkingPaid(true);
    await supabase.from("monthly_invoices").update({
      payment_requested: true,
      payment_requested_at: new Date().toISOString(),
      status: "payment_requested",
    }).eq("id", pendingInvoice.id);

    // Notify admin
    const { data: admins } = await supabase.from("admins").select("id");
    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        user_id: admin.id,
        title: "💰 Payment Received — Verification Required",
        message: `${hospitalName} has marked their invoice as paid. Total: ₹${pendingInvoice.total_due?.toLocaleString()}. Please verify and mark as cleared.`,
      });
    }

    alert("Payment marked! Admin has been notified and will verify shortly.");
    fetchPendingInvoice();
    setShowPaymentReminder(false);
    setMarkingPaid(false);
  };

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
    fetchNotifications();
  };

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleQualification = (q) => {
    const current = form.qualifications;
    if (current.includes(q)) {
      setForm({ ...form, qualifications: current.filter(x => x !== q) });
    } else {
      setForm({ ...form, qualifications: [...current, q] });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.qualifications.length === 0) {
      alert("Please select at least one qualification.");
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const grossPay = parseFloat(form.pay);
    const doctorPay = Math.round(grossPay * 0.8);
    const platformFee = Math.round(grossPay * 0.2);
    const { error } = await supabase.from("locum_duties").insert({
      hospital_id: user.id,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      qualification: form.qualifications[0],
      qualifications: form.qualifications,
      pay: grossPay,
      gross_pay: grossPay,
      doctor_pay: doctorPay,
      platform_fee: platformFee,
      notes: form.notes,
      booked: false,
      completed: false,
      booking_status: "open",
      payment_status: "unpaid",
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
            body: `A new duty is available on ${form.date}. ₹${doctorPay.toLocaleString()}`,
            url: "/doctor/dashboard",
          },
        });
      }
      alert("Locum duty posted successfully!");
      setForm(emptyForm);
      setShowForm(null);
      setShowQualDropdown(false);
      fetchDuties();
    }
    setSubmitting(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusLabel = (duty) => {
    if (duty.booking_status === "confirmed") return <span className="status-badge status-confirmed">✅ Confirmed</span>;
    if (duty.booking_status === "reopened") return <span className="status-badge status-reopened">🔄 Re-opened</span>;
    if (duty.booking_status === "pending_verification") return <span className="status-badge status-pending">⏳ Pending Verification</span>;
    return <span className="status-badge status-open">Open</span>;
  };

  const getMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  return (
    <div className="dashboard-container">

      {/* Payment Reminder Floating Banner */}
      {showPaymentReminder && pendingInvoice && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
          background: pendingInvoice.weeks_overdue > 0 ? "#c62828" : "#e65100",
          color: "white", padding: "16px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
                {pendingInvoice.weeks_overdue > 0 ? "🔴 Account at risk — Payment Overdue!" : "⚠️ Payment Due Soon"}
              </p>
              <p style={{ fontSize: 13, margin: "4px 0 0", opacity: 0.9 }}>
                Invoice for {getMonthLabel(pendingInvoice.billing_month)} — ₹{pendingInvoice.total_due?.toLocaleString()} due by {pendingInvoice.due_date}
                {pendingInvoice.fine_amount > 0 && ` (includes ₹${pendingInvoice.fine_amount} fine)`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!pendingInvoice.payment_requested ? (
                <button
                  onClick={markAsPaid}
                  disabled={markingPaid}
                  style={{ padding: "10px 20px", background: "white", color: "#1e3a5f", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  {markingPaid ? "Processing..." : "✅ Mark as PAID"}
                </button>
              ) : (
                <span style={{ background: "rgba(255,255,255,0.2)", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                  ⏳ Payment Verification Pending
                </span>
              )}
              <button onClick={() => setShowPaymentReminder(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.5)", color: "white", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-header" style={{ marginTop: showPaymentReminder ? 80 : 0 }}>
        <div>
          <h1>Hospital Dashboard</h1>
          {hospitalName && <p style={{ color: "#888", fontSize: 14 }}>{hospitalName}</p>}
        </div>
        <div className="header-buttons">
          <button className="notif-btn" onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
            🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button onClick={() => navigate("/hospital/locums")}>My Locums</button>
          <button onClick={() => navigate("/hospital/profile")}>Profile</button>
          <button onClick={() => navigate("/help")}>Help</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {showNotifications && (
        <div className="notifications-panel">
          <h3>🔔 Notifications</h3>
          {notifications.length === 0 ? (
            <p className="no-notif">No notifications yet</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
                <p className="notif-title">{n.title}</p>
                <p className="notif-message">{n.message}</p>
                <p className="notif-time">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending Invoice Card */}
      {pendingInvoice && !showPaymentReminder && (
        <div style={{
          background: pendingInvoice.weeks_overdue > 0 ? "#fce4ec" : "#fff8e1",
          border: `1px solid ${pendingInvoice.weeks_overdue > 0 ? "#e74c3c" : "#ff9800"}`,
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ color: pendingInvoice.weeks_overdue > 0 ? "#c62828" : "#e65100", marginBottom: 6 }}>
                {pendingInvoice.weeks_overdue > 0 ? "🔴 Overdue Invoice" : "📋 Invoice Pending"}
              </h3>
              <p style={{ color: "#555", fontSize: 14 }}>
                {getMonthLabel(pendingInvoice.billing_month)} — {pendingInvoice.total_duties} duties
              </p>
              <p style={{ color: "#555", fontSize: 14 }}>Due by: {pendingInvoice.due_date}</p>
              {pendingInvoice.fine_amount > 0 && (
                <p style={{ color: "#e74c3c", fontSize: 14, fontWeight: 600 }}>⚠️ Includes ₹{pendingInvoice.fine_amount} late fine</p>
              )}
              {pendingInvoice.payment_requested && (
                <p style={{ color: "#27ae60", fontSize: 14, fontWeight: 600 }}>⏳ Payment submitted — awaiting admin verification</p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#1e3a5f" }}>₹{pendingInvoice.total_due?.toLocaleString()}</p>
              {!pendingInvoice.payment_requested && (
                <button
                  onClick={markAsPaid}
                  disabled={markingPaid}
                  style={{ padding: "10px 24px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginTop: 8 }}
                >
                  {markingPaid ? "Processing..." : "✅ Mark as PAID"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="post-section">
        <button className="post-btn" onClick={() => { setShowForm(showForm === "doctor" ? null : "doctor"); setForm(emptyForm); }}>
          {showForm === "doctor" ? "Cancel" : "+ Post Doctor Locum"}
        </button>
        <button className="post-btn nurse-btn" onClick={() => { setShowForm(showForm === "nurse" ? null : "nurse"); setForm(emptyForm); }}>
          {showForm === "nurse" ? "Cancel" : "+ Post Nurse Locum"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="duty-form">
          <h2>Post a {showForm === "nurse" ? "Nurse" : "Doctor"} Locum Duty</h2>
          {showForm === "nurse" && (
            <div style={{ background: "#f3e5f5", border: "1px solid #6a0dad", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#4a0080" }}>
              💜 You are posting a <strong>Nurse Locum</strong> duty
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input name="date" type="date" required onChange={handle} value={form.date} />
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input name="start_time" type="time" required onChange={handle} value={form.start_time} />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input name="end_time" type="time" required onChange={handle} value={form.end_time} />
            </div>
          </div>

          <div className="form-group">
            <label>
              Required Qualifications{" "}
              {form.qualifications.length > 0 && (
                <span style={{ color: "#27ae60", fontSize: 13 }}>({form.qualifications.length} selected)</span>
              )}
            </label>
            {isRadiology(form.qualifications) && (
              <div style={{ background: "#fff8e1", border: "1px solid #ffcc02", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#795500", marginBottom: 8, lineHeight: 1.5 }}>
                ⚠️ <strong>PCPNDT Notice:</strong> Radiologists performing USG/Ultrasound procedures must hold a valid <strong>PCPNDT registration</strong>. Please select <strong>"with PCPNDT Certification"</strong> if this duty involves ultrasound examinations.
              </div>
            )}
            <div className="qual-dropdown-container">
              <div className="qual-dropdown-trigger" onClick={() => setShowQualDropdown(!showQualDropdown)}>
                {form.qualifications.length === 0
                  ? "Select qualifications..."
                  : form.qualifications.length === 1
                  ? form.qualifications[0]
                  : `${form.qualifications.length} qualifications selected`}
                <span style={{ float: "right" }}>{showQualDropdown ? "▲" : "▼"}</span>
              </div>
              {showQualDropdown && (
                <div className="qual-dropdown-list">
                  {(showForm === "nurse" ? nursingQualifications : allQualifications).map((q) => (
                    <label key={q} className={`qual-option ${form.qualifications.includes(q) ? "selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={form.qualifications.includes(q)}
                        onChange={() => toggleQualification(q)}
                        style={{ marginRight: 8 }}
                      />
                      {q}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {form.qualifications.length > 0 && (
              <div className="selected-quals">
                {form.qualifications.map(q => (
                  <span key={q} className="qual-tag">
                    {q}
                    <button type="button" onClick={() => toggleQualification(q)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Total Pay (₹)</label>
            <input name="pay" placeholder="e.g. 10000" type="number" required onChange={handle} value={form.pay} />
            {form.pay && parseFloat(form.pay) > 0 && (
              <div className="pay-split">
                <div className="split-item doctor">
                  <span>👨‍⚕️ {showForm === "nurse" ? "Nurse" : "Doctor"} receives</span>
                  <span>₹{Math.round(parseFloat(form.pay) * 0.8).toLocaleString()}</span>
                </div>
                <div className="split-item platform">
                  <span>🏢 Platform fee (20%)</span>
                  <span>₹{Math.round(parseFloat(form.pay) * 0.2).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Additional Notes (optional)</label>
            <textarea name="notes" placeholder="Any special requirements..." onChange={handle} value={form.notes} rows={3} />
          </div>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Posting..." : "Post Duty"}
          </button>
        </form>
      )}

      <h2>Posted Duties</h2>
      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : duties.length === 0 ? (
        <p className="empty-msg">No duties posted yet. Click "Post New Locum Duty" to get started.</p>
      ) : (
        <div className="duties-grid">
          {duties.map((duty) => (
            <div key={duty.id} className={`duty-card ${duty.booking_status === "confirmed" ? "booked" : duty.booking_status === "reopened" ? "reopened-card" : duty.booked ? "booked" : ""}`}>
              <div className="duty-header">
                <h3>
                  {duty.qualifications && duty.qualifications.length > 1
                    ? `${duty.qualifications.length} Qualifications`
                    : duty.qualification}
                </h3>
                <span className="pay">₹{duty.gross_pay || duty.pay}</span>
              </div>
              <div className="duty-details">
                <p>📅 {duty.date}</p>
                <p>🕐 {duty.start_time} - {duty.end_time}</p>
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
                {duty.notes && <p>📝 {duty.notes}</p>}
              </div>
              {getStatusLabel(duty)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HospitalDashboard;
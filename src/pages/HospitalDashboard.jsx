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

const nursingQualifications = [
  "GNM (General Nursing & Midwifery)", "B.Sc Nursing", "Post Basic B.Sc Nursing",
  "M.Sc Nursing", "Critical Care Nursing", "Operation Theatre Nursing",
  "Emergency & Trauma Nursing", "Paediatric Nursing", "Oncology Nursing",
  "Dialysis Nursing", "ICU Nursing", "NICU Nursing", "PICU Nursing",
  "Midwifery", "Community Health Nursing", "Psychiatric Nursing", "Other",
];

const emptyForm = { date: "", start_time: "", end_time: "", qualifications: [], pay: "", notes: "" };

const isRadiology = (qualifications) =>
  qualifications.some(q => q.toLowerCase().includes("radio") || q.toLowerCase().includes("pcpndt") || q.toLowerCase().includes("sonolog"));

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
  const [showQualDropdown, setShowQualDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [payingDutyId, setPayingDutyId] = useState(null);

  useEffect(() => { fetchHospitalData(); }, []);

  // Check for expired locked duties every minute
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
    // Find locked duties older than 4 hours and expire them
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data: expiredDuties } = await supabase
      .from("locum_duties")
      .select("*, doctors(first_name, last_name, email), nurses(first_name, last_name, email)")
      .eq("hospital_id", uid)
      .eq("booking_status", "locked")
      .lt("locked_at", fourHoursAgo);

    if (!expiredDuties || expiredDuties.length === 0) return;

    for (const duty of expiredDuties) {
      // Release duty back to open
      await supabase.from("locum_duties").update({
        booking_status: "expired",
        booked: false,
        booked_by: null,
        locked_at: null,
      }).eq("id", duty.id);

      // Notify hospital
      await supabase.from("notifications").insert({
        user_id: uid,
        title: "⏰ Duty Expired — Payment Not Received",
        message: `The ${duty.qualification} duty on ${duty.date} was not confirmed within 4 hours and has expired.`,
      });

      // Notify doctor/nurse
      const staff = duty.doctors || duty.nurses;
      if (staff?.email) {
        await sendEmail({
          to: staff.email,
          subject: "Duty Expired – LOCUM",
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
            <h1 style="color:#1e3a5f;">LOCUM</h1>
            <h2 style="color:#e74c3c;">⏰ Duty Expired</h2>
            <p>Hi ${staff.first_name},</p>
            <p>Unfortunately the hospital did not confirm your booking for the <strong>${duty.qualification}</strong> duty on <strong>${duty.date}</strong> within 4 hours.</p>
            <p>You are now free to book other duties.</p>
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
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, doctors(first_name, last_name, qualification, phone, email), nurses(first_name, last_name, qualification, phone, email)")
      .eq("hospital_id", uid)
      .eq("completed", false)
      .order("created_at", { ascending: false });
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

  const toggleQualification = (q) => {
    const current = form.qualifications;
    setForm({ ...form, qualifications: current.includes(q) ? current.filter(x => x !== q) : [...current, q] });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.qualifications.length === 0) { alert("Please select at least one qualification."); return; }
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
            body: `New duty on ${form.date}. Rs.${grossPay.toLocaleString()}`,
            url: showForm === "nurse" ? "/nurse/dashboard" : "/doctor/dashboard",
          },
        });
      }
      alert("Duty posted successfully!");
      setForm(emptyForm); setShowForm(null); setShowQualDropdown(false);
      fetchDuties(hospitalId);
    }
    setSubmitting(false);
  };

  const cancelLockedDuty = async (duty) => {
    const confirmed = window.confirm("Cancel this duty? The doctor will be notified and freed to take other duties.");
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
          <p>The hospital has cancelled the <strong>${duty.qualification}</strong> duty on <strong>${duty.date}</strong>.</p>
          <p>You are free to book other duties.</p>
          <a href="https://bookmylocum.com/login" style="display:inline-block;padding:14px 28px;background:#1e3a5f;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">Find Other Duties</a>
          <p style="color:#888;font-size:13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
        </div>`,
      });
    }
    await supabase.from("notifications").insert({
      user_id: hospitalId,
      title: "Duty Cancelled",
      message: `The ${duty.qualification} duty on ${duty.date} has been cancelled.`,
    });
    fetchDuties(hospitalId);
  };

  const payPlatformFee = async (duty) => {
    setPayingDutyId(duty.id);
    const staff = duty.doctors || duty.nurses;
    const staffType = duty.doctors ? "Doctor" : "Nurse";
    const staffTitle = duty.doctors ? "Dr. " : "";

    // Razorpay integration goes here — for now show payment details
    alert(
      `Platform Fee Payment\n\n` +
      `Duty: ${duty.qualification} on ${duty.date}\n` +
      `${staffType}: ${staffTitle}${staff?.first_name} ${staff?.last_name}\n\n` +
      `Amount: Rs.${(duty.platform_fee || 0).toLocaleString()} (incl. GST)\n\n` +
      `Payment gateway coming soon. Please contact locum.blr@gmail.com to complete payment and confirm this duty.`
    );

    // TODO: Replace above alert with Razorpay flow
    // On successful payment, call confirmDutyAfterPayment(duty)
    setPayingDutyId(null);
  };

  const confirmDutyAfterPayment = async (duty, paymentId) => {
    // Called after successful Razorpay payment
    const staff = duty.doctors || duty.nurses;
    const staffType = duty.doctors ? "doctor" : "nurse";
    const staffTitle = duty.doctors ? "Dr. " : "";

    await supabase.from("locum_duties").update({
      booking_status: "confirmed",
      payment_status: "paid",
      payment_id: paymentId,
    }).eq("id", duty.id);

    // Send full details to both parties
    const detailsHtml = (recipientName, showHospital) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
        <h1 style="color:#1e3a5f;">LOCUM</h1>
        <h2 style="color:#27ae60;">✅ Duty Confirmed!</h2>
        <p>Hi ${recipientName},</p>
        <p>Your duty has been confirmed. Here are the full details:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f5f7fa;"><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Date</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${duty.date}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Time</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${duty.start_time} – ${duty.end_time}</td></tr>
          <tr style="background:#f5f7fa;"><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Qualification</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${duty.qualification}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Pay</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">Rs.${(duty.gross_pay || duty.pay).toLocaleString()}</td></tr>
          ${showHospital ? `<tr style="background:#f5f7fa;"><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Hospital</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${duty.hospitals?.hospital_name || hospitalName}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Address</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${duty.hospitals?.address || "—"}</td></tr>
          <tr style="background:#f5f7fa;"><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Contact</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${duty.hospitals?.phone || "—"}</td></tr>` : ""}
          ${!showHospital ? `<tr style="background:#f5f7fa;"><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">${staffType === "doctor" ? "Doctor" : "Nurse"}</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${staffTitle}${staff?.first_name} ${staff?.last_name}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Qualification</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${staff?.qualification || "—"}</td></tr>
          <tr style="background:#f5f7fa;"><td style="padding:10px 14px;border:1px solid #e0e0e0;font-weight:600;color:#1e3a5f;">Phone</td><td style="padding:10px 14px;border:1px solid #e0e0e0;">${staff?.phone || "—"}</td></tr>` : ""}
        </table>
        <p style="color:#e74c3c;font-size:13px;font-weight:600;">⚠️ This duty cannot be cancelled by either party.</p>
        <p style="color:#888;font-size:13px;">— Team LOCUM | <a href="https://bookmylocum.com">bookmylocum.com</a></p>
      </div>
    `;

    // Email to staff (with hospital details)
    if (staff?.email) {
      await sendEmail({
        to: staff.email,
        subject: "Duty Confirmed — Full Details – LOCUM",
        html: detailsHtml(`${staffTitle}${staff.first_name}`, true),
      });
    }

    // Email to hospital (with staff details)
    await sendEmail({
      to: hospitalEmail,
      subject: "Duty Confirmed — Full Details – LOCUM",
      html: detailsHtml(hospitalName, false),
    });

    await supabase.from("notifications").insert({
      user_id: duty.booked_by,
      title: "✅ Duty Confirmed!",
      message: `Your ${duty.qualification} duty on ${duty.date} at ${hospitalName} is confirmed. Check your email for full details.`,
    });

    fetchDuties(hospitalId);
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const getTimeRemaining = (lockedAt) => {
    if (!lockedAt) return null;
    const expiry = new Date(new Date(lockedAt).getTime() + 4 * 60 * 60 * 1000);
    const now = new Date();
    const diff = expiry - now;
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
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Hospital Dashboard</h1>
          {hospitalName && <p style={{ color: "#888", fontSize: 14 }}>{hospitalName}</p>}
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/hospital/locums")}>My Locums</button>
          <button onClick={() => navigate("/hospital/profile")}>Profile</button>
          <div style={{ position: "relative" }}>
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
              {unreadCount > 0 && <span className="notif-dot" />}⋮
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <button onClick={() => { setShowNotifications(!showNotifications); markAllRead(); setShowMenu(false); }}>
                  🔔 Notifications {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                <button onClick={() => { navigate("/help"); setShowMenu(false); }}>❓ Help</button>
                <button className="logout-item" onClick={logout}>🚪 Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNotifications && (
        <div className="notifications-panel">
          <h3>🔔 Notifications</h3>
          {notifications.length === 0 ? <p className="no-notif">No notifications yet</p> :
            notifications.map(n => (
              <div key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
                <p className="notif-title">{n.title}</p>
                <p className="notif-message">{n.message}</p>
                <p className="notif-time">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))}
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
          <div style={{ background: "#e3f2fd", border: "1px solid #1565c0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1565c0" }}>
            ℹ️ Duty goes live immediately. When a doctor/nurse accepts, you'll be notified to pay the platform fee (20% of duty pay) to confirm. You have 4 hours to pay, after which the duty is cancelled.
          </div>
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
            <label>Required Qualifications {form.qualifications.length > 0 && <span style={{ color: "#27ae60", fontSize: 13 }}>({form.qualifications.length} selected)</span>}</label>
            {isRadiology(form.qualifications) && (
              <div style={{ background: "#fff8e1", border: "1px solid #ffcc02", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#795500", marginBottom: 8 }}>
                ⚠️ <strong>PCPNDT Notice:</strong> Select <strong>"with PCPNDT Certification"</strong> if this duty involves ultrasound examinations.
              </div>
            )}
            <div className="qual-dropdown-container">
              <div className="qual-dropdown-trigger" onClick={() => setShowQualDropdown(!showQualDropdown)}>
                {form.qualifications.length === 0 ? "Select qualifications..." :
                  form.qualifications.length === 1 ? form.qualifications[0] :
                  `${form.qualifications.length} qualifications selected`}
                <span style={{ float: "right" }}>{showQualDropdown ? "▲" : "▼"}</span>
              </div>
              {showQualDropdown && (
                <div className="qual-dropdown-list">
                  {(showForm === "nurse" ? nursingQualifications : allQualifications).map((q) => (
                    <label key={q} className={`qual-option ${form.qualifications.includes(q) ? "selected" : ""}`}>
                      <input type="checkbox" checked={form.qualifications.includes(q)} onChange={() => toggleQualification(q)} />
                      <span>{q}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {form.qualifications.length > 0 && (
              <div className="selected-quals">
                {form.qualifications.map(q => (
                  <span key={q} className="qual-tag">{q}<button type="button" onClick={() => toggleQualification(q)}>×</button></span>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Pay to {showForm === "nurse" ? "Nurse" : "Doctor"} (Rs.)</label>
            <input name="pay" placeholder="e.g. 10000" type="number" required onChange={handle} value={form.pay} />
            {form.pay && parseFloat(form.pay) > 0 && (
              <div className="pay-split">
                <div className="split-item doctor">
                  <span>👨‍⚕️ {showForm === "nurse" ? "Nurse" : "Doctor"} receives</span>
                  <span>Rs.{parseFloat(form.pay).toLocaleString()}</span>
                </div>
                <div className="split-item platform">
                  <span>🏢 Platform fee (20%, incl. GST) — paid on confirmation</span>
                  <span>Rs.{Math.round(parseFloat(form.pay) * 0.2).toLocaleString()}</span>
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
      {loading ? <p style={{ color: "#888" }}>Loading...</p> :
        duties.length === 0 ? <p className="empty-msg">No duties posted yet.</p> : (
        <div className="duties-grid">
          {duties.map((duty) => {
            const staff = duty.doctors || duty.nurses;
            const staffTitle = duty.doctors ? "Dr. " : "";
            const isLocked = duty.booking_status === "locked";
            const isConfirmed = duty.booking_status === "confirmed";
            const isExpired = duty.booking_status === "expired";
            return (
              <div key={duty.id} className={`duty-card ${isConfirmed ? "booked" : isLocked ? "booked" : ""}`}
                style={{ opacity: isExpired ? 0.6 : 1 }}>
                <div className="duty-header">
                  <h3>{duty.qualifications && duty.qualifications.length > 1 ? `${duty.qualifications.length} Qualifications` : duty.qualification}</h3>
                  <span className="pay">Rs.{(duty.gross_pay || duty.pay).toLocaleString()}</span>
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

                  {/* Show staff details only after confirmed */}
                  {isConfirmed && staff && (
                    <div style={{ marginTop: 10, background: "#e8f5e9", borderRadius: 8, padding: "10px 12px" }}>
                      <p style={{ fontWeight: 700, color: "#2e7d32", marginBottom: 6, fontSize: 13 }}>✅ Confirmed Staff</p>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>👤 {staffTitle}{staff.first_name} {staff.last_name}</p>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>🎓 {staff.qualification}</p>
                      <p style={{ fontSize: 13, margin: "2px 0" }}>📞 {staff.phone}</p>
                    </div>
                  )}

                  {/* Locked — show pay button */}
                  {isLocked && staff && (
                    <div style={{ marginTop: 10, background: "#fff8e1", borderRadius: 8, padding: "10px 12px" }}>
                      <p style={{ fontWeight: 700, color: "#795500", marginBottom: 6, fontSize: 13 }}>🔒 A {duty.duty_type === "nurse" ? "nurse" : "doctor"} has accepted</p>
                      <p style={{ fontSize: 13, margin: "2px 0", color: "#888" }}>Pay platform fee to see full details</p>
                      <p style={{ fontSize: 12, color: "#e74c3c", margin: "4px 0" }}>⏰ {getTimeRemaining(duty.locked_at)}</p>
                      <p style={{ fontSize: 13, margin: "4px 0", fontWeight: 600, color: "#1e3a5f" }}>
                        Platform fee: Rs.{(duty.platform_fee || 0).toLocaleString()} (incl. GST)
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => payPlatformFee(duty)}
                          disabled={payingDutyId === duty.id}
                          style={{ padding: "10px 20px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          {payingDutyId === duty.id ? "Processing..." : "💳 Pay & Confirm"}
                        </button>
                        <button
                          onClick={() => cancelLockedDuty(duty)}
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

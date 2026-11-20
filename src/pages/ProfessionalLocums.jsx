import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { withdrawApplication } from "../applications";
import "./DoctorLocums.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString("default", { month: "long" });
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${monthName} ${day}${suffix}, ${year}`;
};

const DUTY_COLUMNS = "id, date, start_time, end_time, qualification, pay, gross_pay, notes, area, duty_type, booking_status, completed, review_status, review_comment";

// "My Locums" for doctors, nurses and technicians: applications waiting on a
// hospital, confirmed bookings (hospital revealed, cover requests), and history.
function ProfessionalLocums({ role }) {
  const navigate = useNavigate();
  const [applied, setApplied] = useState([]);
  const [booked, setBooked] = useState([]);
  const [hospitalByDuty, setHospitalByDuty] = useState({});
  const [coverByDuty, setCoverByDuty] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("confirmed");
  const [requestingCover, setRequestingCover] = useState(null);
  const [coverReason, setCoverReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const [{ data: apps }, { data: duties }, { data: bookings }, { data: covers }] = await Promise.all([
      supabase.from("duty_applications")
        .select(`status, created_at, locum_duties(${DUTY_COLUMNS})`)
        .in("status", ["applied", "not_selected"])
        .order("created_at", { ascending: false }),
      supabase.from("locum_duties").select(DUTY_COLUMNS)
        .eq("booked_by", user.id).eq("booking_status", "confirmed")
        .order("date", { ascending: false }),
      supabase.rpc("get_my_bookings"),
      supabase.from("cover_requests").select("id, duty_id, status, reason")
        .eq("requesting_doctor_id", user.id).eq("status", "open"),
    ]);

    // A filled duty is no longer visible to unselected applicants, so keep only rows we can show.
    setApplied((apps || []).filter(a => a.locum_duties));
    setBooked(duties || []);
    setHospitalByDuty(Object.fromEntries((bookings || []).map(b => [b.duty_id, b])));
    setCoverByDuty(Object.fromEntries((covers || []).map(c => [c.duty_id, c])));
    setLoading(false);
  };

  const submitCoverRequest = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("request_cover", { p_duty_id: requestingCover.id, p_reason: coverReason });
    setSaving(false);
    if (error) { alert(error.message); return; }
    alert("Cover request sent. The hospital has been notified. You remain responsible for this duty until they confirm a replacement.");
    setRequestingCover(null);
    setCoverReason("");
    fetchAll();
  };

  const cancelCoverRequest = async (cover) => {
    if (!window.confirm("Cancel your cover request? You will attend this duty yourself.")) return;
    const { error } = await supabase.rpc("cancel_cover_request", { p_cover_request_id: cover.id });
    if (error) { alert(error.message); return; }
    fetchAll();
  };

  const withdraw = async (dutyId) => {
    if (!window.confirm("Withdraw your application? You can apply again while the duty is open.")) return;
    if (await withdrawApplication(dutyId)) fetchAll();
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const getReviewBadge = (duty) => {
    const labels = {
      satisfactory: { text: "✅ Satisfactory", style: "review-satisfactory" },
      unsatisfactory: { text: "⚠️ Unsatisfactory", style: "review-unsatisfactory" },
      late: { text: "🕐 Late to Duty", style: "review-late" },
      absent: { text: "❌ Absent", style: "review-absent" },
    };
    const review = labels[duty.review_status];
    if (!review) return <div className="status-badge review-satisfactory">✅ Completed</div>;
    return <div className={`status-badge ${review.style}`}>{review.text}</div>;
  };

  const confirmed = booked.filter(d => !d.completed);
  const completed = booked.filter(d => d.completed);
  const waiting = applied.filter(a => a.status === "applied");

  const tabs = [
    { key: "applied", label: "⏳ Applied", count: waiting.length },
    { key: "confirmed", label: "📋 Confirmed", count: confirmed.length },
    { key: "completed", label: "✅ Completed", count: completed.length },
  ];

  const hospitalDetails = (duty) => {
    const h = hospitalByDuty[duty.id];
    return (
      <>
        <p>📍 {h?.address || duty.area || "—"}</p>
        {h?.department_name && <p>🏥 {h.department_name}</p>}
        {h?.contact_person && <p>👤 {h.contact_person}</p>}
        {h?.hospital_phone && <p>📞 {h.hospital_phone}</p>}
      </>
    );
  };

  return (
    <div className="locums-container">
      <div className="locums-header">
        <h1>My Locum Duties</h1>
        <div className="header-buttons">
          <button onClick={() => navigate(`/${role}/dashboard`)}>Dashboard</button>
          <button onClick={() => navigate(`/${role}/profile`)}>Profile</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="duty-type-tabs">
        {tabs.map(t => (
          <button key={t.key} className={activeTab === t.key ? "active" : ""} onClick={() => setActiveTab(t.key)}>
            {t.label}
            {t.count > 0 && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading...</p> : <>

        {activeTab === "applied" && (
          applied.length === 0 ? (
            <div className="empty-state">
              <p>You haven't applied for any open duties.</p>
              <button onClick={() => navigate(`/${role}/dashboard`)}>Browse Available Duties</button>
            </div>
          ) : (
            <div className="duties-grid">
              {applied.map(({ status, locum_duties: duty }) => (
                <div key={duty.id} className="duty-card pending-card">
                  <div className="duty-header">
                    <h3>📍 {duty.area || "Bangalore"}</h3>
                    <span className="pay">Rs.{(duty.gross_pay || duty.pay || 0).toLocaleString()}</span>
                  </div>
                  <div className="duty-details">
                    <p>📅 {formatDate(duty.date)}</p>
                    <p>🕐 {duty.start_time} - {duty.end_time}</p>
                    <p>🎓 {duty.qualification}</p>
                    <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Hospital name shared after confirmation</p>
                  </div>
                  {status === "applied" ? <>
                    <div className="status-badge pending">⏳ Waiting for the hospital to choose</div>
                    <button className="cover-btn" onClick={() => withdraw(duty.id)}>Withdraw Application</button>
                  </> : (
                    <div className="status-badge" style={{ background: "#f5f5f5", color: "#888" }}>The hospital chose another applicant</div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "confirmed" && (
          confirmed.length === 0 ? (
            <div className="empty-state">
              <p>No confirmed duties yet. When a hospital confirms you, the duty and its full details appear here.</p>
              <button onClick={() => navigate(`/${role}/dashboard`)}>Browse Available Duties</button>
            </div>
          ) : (
            <div className="duties-grid">
              {confirmed.map((duty) => {
                const cover = coverByDuty[duty.id];
                return (
                  <div key={duty.id} className="duty-card confirmed">
                    <div className="duty-header">
                      <h3>{hospitalByDuty[duty.id]?.hospital_name || "Hospital"}</h3>
                      <span className="pay">Rs.{(duty.gross_pay || duty.pay || 0).toLocaleString()}</span>
                    </div>
                    <div className="duty-details">
                      {hospitalDetails(duty)}
                      <p>📅 {formatDate(duty.date)}</p>
                      <p>🕐 {duty.start_time} - {duty.end_time}</p>
                      <p>🎓 {duty.qualification}</p>
                      {duty.notes && <p>📝 {duty.notes}</p>}
                    </div>
                    {cover ? <>
                      <div className="status-badge cover-pending">🔍 Looking for cover — you are still responsible</div>
                      <div className="cover-request-info">
                        <p style={{ fontSize: 12, color: "#888" }}>
                          The hospital confirms the replacement. Until then, plan to attend.{cover.reason ? ` Reason: ${cover.reason}` : ""}
                        </p>
                      </div>
                      <button className="cover-btn" onClick={() => cancelCoverRequest(cover)}>Cancel Cover Request</button>
                    </> : <>
                      <div className="status-badge confirmed">✅ Confirmed</div>
                      <button className="cover-btn" onClick={() => { setRequestingCover(duty); setCoverReason(""); }}>
                        🔄 Request Cover
                      </button>
                    </>}
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === "completed" && (
          completed.length === 0 ? (
            <div className="empty-state"><p>No completed duties yet.</p></div>
          ) : (
            <div className="duties-grid">
              {completed.map((duty) => (
                <div key={duty.id} className="duty-card completed-card">
                  <div className="duty-header">
                    <h3>{hospitalByDuty[duty.id]?.hospital_name || "Hospital"}</h3>
                    <span className="pay">Rs.{(duty.gross_pay || duty.pay || 0).toLocaleString()}</span>
                  </div>
                  <div className="duty-details">
                    <p>📍 {hospitalByDuty[duty.id]?.address || duty.area || "—"}</p>
                    <p>📅 {formatDate(duty.date)}</p>
                    <p>🕐 {duty.start_time} - {duty.end_time}</p>
                    <p>🎓 {duty.qualification}</p>
                  </div>
                  {getReviewBadge(duty)}
                  {duty.review_comment && <div className="review-note"><p>💬 {duty.review_comment}</p></div>}
                </div>
              ))}
            </div>
          )
        )}
      </>}

      {requestingCover && (
        <div className="modal-overlay" onClick={() => setRequestingCover(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Request Cover</h2>
            <p style={{ color: "#888", marginBottom: 8 }}>{hospitalByDuty[requestingCover.id]?.hospital_name} — {formatDate(requestingCover.date)}</p>
            <p style={{ color: "#e65100", fontSize: 14, marginBottom: 20 }}>
              ⚠️ The hospital will be notified and the duty opens to other professionals. You remain responsible for attending until the hospital confirms a replacement.
            </p>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#333" }}>Reason (shared with the hospital)</label>
            <textarea
              className="cover-reason-input"
              placeholder="e.g. Family emergency"
              value={coverReason}
              onChange={(e) => setCoverReason(e.target.value)}
              rows={4}
            />
            <div className="modal-actions">
              <button className="verify-btn" disabled={saving} onClick={submitCoverRequest}>{saving ? "Sending..." : "Send Request"}</button>
              <button className="reject-btn" onClick={() => setRequestingCover(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfessionalLocums;

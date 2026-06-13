import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./DoctorLocums.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString("default", { month: "long" });
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${monthName} ${day}${suffix}, ${year}`;
};

function DoctorLocums() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [requestingCover, setRequestingCover] = useState(null);
  const [coverReason, setCoverReason] = useState("");

  useEffect(() => { fetchBookedDuties(); }, []);

  const fetchBookedDuties = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, address, phone, email), cover_requests(id, status, covering_doctor_id)")
      .eq("booked_by", user.id)
      .not("booking_status", "eq", "expired")
      .order("date", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const submitCoverRequest = async () => {
    if (!coverReason) { alert("Please provide a reason for requesting cover."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const existingRequest = requestingCover.cover_requests?.find(r => r.status === "open");
    if (existingRequest) { alert("You already have an open cover request for this duty."); setRequestingCover(null); return; }
    const { error } = await supabase.from("cover_requests").insert({
      duty_id: requestingCover.id,
      requesting_doctor_id: user.id,
      reason: coverReason,
      status: "open",
    });
    if (error) { alert("Error: " + error.message); return; }
    alert("Cover request submitted!");
    setRequestingCover(null);
    setCoverReason("");
    fetchBookedDuties();
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const getStatusBadge = (duty) => {
    const openCoverRequest = duty.cover_requests?.find(r => r.status === "open");
    const acceptedCoverRequest = duty.cover_requests?.find(r => r.status === "accepted");
    if (acceptedCoverRequest) return <div className="status-badge cover-accepted">✅ Cover Found — You are released</div>;
    if (openCoverRequest) return <div className="status-badge cover-pending">🔍 Looking for Cover...</div>;
    if (duty.booking_status === "confirmed") return <div className="status-badge confirmed">✅ Confirmed</div>;
    if (duty.booking_status === "locked") return <div className="status-badge pending">🔒 Awaiting Hospital Payment</div>;
    if (duty.booking_status === "reopened") return <div className="status-badge reopened">🔄 Cover Accepted — Pending Re-verification</div>;
    return <div className="status-badge pending">⏳ Pending</div>;
  };

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

  const activeDuties = duties.filter(d => !d.completed);
  const completedDuties = duties.filter(d => d.completed);

  return (
    <div className="locums-container">
      <div className="locums-header">
        <h1>My Locum Duties</h1>
        <div className="header-buttons">
          <button onClick={() => navigate("/doctor/dashboard")}>Dashboard</button>
          <button onClick={() => navigate("/doctor/profile")}>Profile</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="duty-type-tabs">
        <button className={activeTab === "active" ? "active" : ""} onClick={() => setActiveTab("active")}>
          📋 Active Duties
          {activeDuties.length > 0 && <span className="tab-count">{activeDuties.length}</span>}
        </button>
        <button className={activeTab === "completed" ? "active" : ""} onClick={() => setActiveTab("completed")}>
          ✅ Completed Duties
          {completedDuties.length > 0 && <span className="tab-count">{completedDuties.length}</span>}
        </button>
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading...</p> :
        activeTab === "active" ? (
          activeDuties.length === 0 ? (
            <div className="empty-state">
              <p>No active locum duties.</p>
              <button onClick={() => navigate("/doctor/dashboard")}>Browse Available Duties</button>
            </div>
          ) : (
            <div className="duties-grid">
              {activeDuties.map((duty) => {
                const openCoverRequest = duty.cover_requests?.find(r => r.status === "open");
                const acceptedCoverRequest = duty.cover_requests?.find(r => r.status === "accepted");
                const isConfirmed = duty.booking_status === "confirmed";
                const isLocked = duty.booking_status === "locked";
                return (
                  <div key={duty.id} className={`duty-card ${isConfirmed ? "confirmed" : acceptedCoverRequest ? "cover-found" : "pending-card"}`}>
                    <div className="duty-header">
                      <h3>{isConfirmed ? (duty.hospitals?.hospital_name || "Hospital") : "📍 " + (duty.hospitals?.area || "Bangalore")}</h3>
                      <span className="pay">Rs.{(duty.gross_pay || duty.pay || 0).toLocaleString()}</span>
                    </div>
                    <div className="duty-details">
                      {isConfirmed && <p>📍 {duty.hospitals?.address || "—"}</p>}
                      <p>📅 {formatDate(duty.date)}</p>
                      <p>🕐 {duty.start_time} - {duty.end_time}</p>
                      <p>🎓 {duty.qualification}</p>
                      {isConfirmed && duty.hospitals?.phone && <p>📞 {duty.hospitals.phone}</p>}
                      {isConfirmed && duty.hospitals?.email && <p>✉️ {duty.hospitals.email}</p>}
                      {!isConfirmed && <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Full details shared after hospital confirms</p>}
                      {duty.notes && <p>📝 {duty.notes}</p>}
                      {isLocked && (
                        <div style={{ marginTop: 8, background: "#fff8e1", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#795500" }}>
                          ⏳ Hospital has been notified to pay the platform fee. You'll be confirmed once payment is received.
                        </div>
                      )}
                    </div>
                    {getStatusBadge(duty)}
                    {openCoverRequest && (
                      <div className="cover-request-info">
                        <p>🔍 Your cover request is active.</p>
                        <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Reason: {openCoverRequest.reason}</p>
                      </div>
                    )}
                    {acceptedCoverRequest && (
                      <div className="cover-accepted-info">
                        <p>✅ A doctor has agreed to cover your duty.</p>
                      </div>
                    )}
                    {!openCoverRequest && !acceptedCoverRequest && !duty.completed && isConfirmed && (
                      <button className="cover-btn" onClick={() => { setRequestingCover(duty); setCoverReason(""); }}>
                        🔄 Request Cover
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          completedDuties.length === 0 ? (
            <div className="empty-state"><p>No completed duties yet.</p></div>
          ) : (
            <div className="duties-grid">
              {completedDuties.map((duty) => (
                <div key={duty.id} className="duty-card completed-card">
                  <div className="duty-header">
                    <h3>{duty.hospitals?.hospital_name || "Hospital"}</h3>
                    <span className="pay">Rs.{(duty.gross_pay || duty.pay || 0).toLocaleString()}</span>
                  </div>
                  <div className="duty-details">
                    <p>📍 {duty.hospitals?.address || "—"}</p>
                    <p>📅 {formatDate(duty.date)}</p>
                    <p>🕐 {duty.start_time} - {duty.end_time}</p>
                    <p>🎓 {duty.qualification}</p>
                    {duty.notes && <p>📝 {duty.notes}</p>}
                  </div>
                  {getReviewBadge(duty)}
                  {duty.review_comment && <div className="review-note"><p>💬 {duty.review_comment}</p></div>}
                </div>
              ))}
            </div>
          )
        )
      }

      {requestingCover && (
        <div className="modal-overlay" onClick={() => setRequestingCover(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Request Cover</h2>
            <p style={{ color: "#888", marginBottom: 8 }}>{requestingCover.hospitals?.hospital_name} — {formatDate(requestingCover.date)}</p>
            <p style={{ color: "#e65100", fontSize: 14, marginBottom: 20 }}>⚠️ You remain responsible until another doctor accepts.</p>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#333" }}>Reason for requesting cover</label>
            <textarea
              className="cover-reason-input"
              placeholder="Please explain why you need cover..."
              value={coverReason}
              onChange={(e) => setCoverReason(e.target.value)}
              rows={4}
            />
            <div className="modal-actions">
              <button className="verify-btn" onClick={submitCoverRequest}>Submit Request</button>
              <button className="reject-btn" onClick={() => setRequestingCover(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorLocums;

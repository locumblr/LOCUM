import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import DutyApplicants from "../DutyApplicants";
import "./HospitalLocums.css";

const TYPE_TABS = [
  { key: "doctor", label: "👨‍⚕️ Doctor Duties", matches: d => !d.duty_type || d.duty_type === "doctor" || d.duty_type === "consultation" },
  { key: "nurse", label: "👩‍⚕️ Nurse Duties", matches: d => d.duty_type === "nurse" },
  { key: "technician", label: "🔬 Technician Duties", matches: d => d.duty_type === "technician" },
];

function HospitalLocums() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [overview, setOverview] = useState({});
  const [coverByDuty, setCoverByDuty] = useState({});
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dutyTypeTab, setDutyTypeTab] = useState("doctor");
  const [statusTab, setStatusTab] = useState("open");
  const [reviewingDuty, setReviewingDuty] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => { fetchDuties(); }, []);

  const fetchDuties = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data: h } = await supabase.from("hospitals").select("status, hospital_name, email").eq("id", user.id).single();
    if (!h || h.status === "frozen") {
      await supabase.auth.signOut();
      navigate("/login");
      return;
    }
    setHospital(h);
    const [{ data, error }, { data: ov }, { data: covers }] = await Promise.all([
      supabase.from("locum_duties").select("*").eq("hospital_id", user.id).order("date", { ascending: false }),
      supabase.rpc("get_duty_overview"),
      supabase.rpc("get_hospital_cover_requests"),
    ]);
    if (!error) setDuties(data || []);
    setOverview(Object.fromEntries((ov || []).map(o => [o.duty_id, o])));
    setCoverByDuty(Object.fromEntries((covers || []).map(c => [c.duty_id, c])));
    setLoading(false);
  };

  const submitReview = async () => {
    if (!reviewStatus) { alert("Please select a review status."); return; }
    if (reviewStatus !== "satisfactory" && !reviewComment) { alert("Please provide a comment."); return; }
    const { error } = await supabase.rpc("submit_duty_review", {
      p_duty_id: reviewingDuty.id, p_status: reviewStatus, p_comment: reviewComment,
    });
    if (error) { alert(error.message); return; }
    alert("Review submitted!");
    setReviewingDuty(null);
    setReviewStatus("");
    setReviewComment("");
    fetchDuties();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isPastDuty = (date) => new Date(date) < new Date();

  const getStatusBadge = (duty) => {
    if (duty.completed) {
      const labels = { satisfactory: "✅ Satisfactory", unsatisfactory: "⚠️ Unsatisfactory", late: "🕐 Late", absent: "❌ Absent" };
      return <div className={`status-badge review-${duty.review_status}`}>{labels[duty.review_status] || "✅ Completed"}</div>;
    }
    if (duty.booking_status === "confirmed") return <div className="status-badge status-confirmed">✅ Confirmed</div>;
    if (duty.booking_status === "expired") return <div className="status-badge" style={{ background: "#f5f5f5", color: "#999" }}>Closed</div>;
    if (overview[duty.id]?.paid) return <div className="status-badge status-pending">Paid — select an applicant</div>;
    return <div className="status-badge status-open">Open</div>;
  };

  const tab = TYPE_TABS.find(t => t.key === dutyTypeTab);
  const byType = duties.filter(tab.matches);
  const openDuties = byType.filter(d => !d.completed);
  const completedDuties = byType.filter(d => d.completed);
  const displayDuties = statusTab === "open" ? openDuties : completedDuties;

  return (
    <div className="locums-container">
      <div className="locums-header">
        <h1>My Locum Duties</h1>
        <div className="header-buttons">
          <button onClick={() => navigate("/hospital/dashboard")}>Dashboard</button>
          <button onClick={() => navigate("/hospital/profile")}>Profile</button>
          <div style={{ position: "relative" }}>
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
            {showMenu && (
              <div className="dropdown-menu">
                <button className="logout-item" onClick={logout}>🚪 Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="duty-type-tabs">
        {TYPE_TABS.map(t => {
          const n = duties.filter(t.matches).length;
          return (
            <button key={t.key} className={`${dutyTypeTab === t.key ? "active" : ""} ${t.key === "nurse" ? "nurse-tab" : ""}`} onClick={() => setDutyTypeTab(t.key)}>
              {t.label}
              {n > 0 && <span className="tab-count">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="status-tabs">
        <button className={statusTab === "open" ? "active" : ""} onClick={() => setStatusTab("open")}>
          📋 Open Duties
          {openDuties.length > 0 && <span className="tab-count">{openDuties.length}</span>}
        </button>
        <button className={statusTab === "completed" ? "active" : ""} onClick={() => setStatusTab("completed")}>
          ✅ Completed
          {completedDuties.length > 0 && <span className="tab-count">{completedDuties.length}</span>}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : displayDuties.length === 0 ? (
        <div className="empty-state">
          <p>No {statusTab} {dutyTypeTab} duties.</p>
          {statusTab === "open" && (
            <button onClick={() => navigate("/hospital/dashboard")}>Post a Locum Duty</button>
          )}
        </div>
      ) : (
        <div className="duties-grid">
          {displayDuties.map((duty) => {
            const isNurse = duty.duty_type === "nurse";
            return (
              <div key={duty.id} className={`duty-card ${duty.completed ? "completed" : duty.booking_status === "confirmed" ? "confirmed" : overview[duty.id]?.applicants ? "booked" : ""} ${isNurse ? "nurse-card" : ""}`}>
                <div className="duty-header">
                  <h3>{duty.qualifications && duty.qualifications.length > 1 ? `${duty.qualifications.length} Qualifications` : duty.qualification}</h3>
                  <span className="pay">Rs.{(duty.gross_pay || duty.pay || 0).toLocaleString()}</span>
                </div>
                <div className="duty-details">
                  <p>📅 {duty.date}</p>
                  <p>🕐 {duty.start_time} - {duty.end_time}</p>
                  {duty.qualifications && duty.qualifications.length > 1 && (
                    <div style={{ marginTop: 6 }}>
                      {duty.qualifications.map(q => (
                        <span key={q} style={{ display: "inline-block", background: isNurse ? "#f3e5f5" : "#e3f2fd", color: isNurse ? "#6a0dad" : "#1565c0", borderRadius: 20, padding: "2px 10px", fontSize: 12, marginRight: 4, marginBottom: 4 }}>{q}</span>
                      ))}
                    </div>
                  )}
                  {duty.notes && <p>📝 {duty.notes}</p>}
                </div>
                {getStatusBadge(duty)}
                {!duty.completed && (
                  <DutyApplicants
                    duty={duty}
                    overview={overview[duty.id]}
                    cover={coverByDuty[duty.id]}
                    payer={{ name: hospital?.hospital_name, email: hospital?.email }}
                    onChange={fetchDuties}
                  />
                )}
                {duty.booking_status === "confirmed" && !duty.completed && isPastDuty(duty.date) && (
                  <button className="review-btn" onClick={() => { setReviewingDuty(duty); setReviewStatus(""); setReviewComment(""); }}>
                    📝 Submit Review
                  </button>
                )}
                {duty.completed && duty.review_comment && (
                  <div className="review-note"><p>💬 {duty.review_comment}</p></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reviewingDuty && (
        <div className="modal-overlay" onClick={() => setReviewingDuty(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Review Duty</h2>
            <p style={{ color: "#888", marginBottom: 20 }}>{reviewingDuty.qualification} — {reviewingDuty.date}</p>
            <div className="review-options">
              {[
                { value: "satisfactory", label: "✅ Satisfactory" },
                { value: "unsatisfactory", label: "⚠️ Unsatisfactory" },
                { value: "late", label: "🕐 Late to Duty" },
                { value: "absent", label: "❌ Absent" },
              ].map(option => (
                <label key={option.value} className={`review-option ${reviewStatus === option.value ? "selected" : ""}`}>
                  <input type="radio" name="review" value={option.value} checked={reviewStatus === option.value} onChange={() => setReviewStatus(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
            {reviewStatus !== "satisfactory" && reviewStatus && (
              <textarea className="review-comment" placeholder="Please provide details..." value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={4} />
            )}
            <div className="modal-actions">
              <button className="verify-btn" onClick={submitReview}>Submit Review</button>
              <button className="reject-btn" onClick={() => setReviewingDuty(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HospitalLocums;

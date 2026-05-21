import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./HospitalLocums.css";

function HospitalLocums() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
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
    const { data: hospital } = await supabase.from("hospitals").select("status").eq("id", user.id).single();
    if (!hospital || hospital.status === "frozen") {
      await supabase.auth.signOut();
      navigate("/login");
      return;
    }
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, doctors(id, first_name, last_name, phone, email, qualification, experience, document_url), nurses(id, first_name, last_name, phone, email, qualification, experience, document_url)")
      .eq("hospital_id", user.id)
      .order("date", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const viewDocument = async (documentUrl) => {
    if (!documentUrl) { alert("No document uploaded."); return; }
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(documentUrl, 60);
    if (error) { alert("Error: " + error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const verifyBooking = async (dutyId) => {
    const confirmed = window.confirm("Confirm credentials verified and approve for this duty?");
    if (!confirmed) return;
    await supabase.from("locum_duties").update({ booking_status: "confirmed" }).eq("id", dutyId);
    alert("Professional confirmed!");
    fetchDuties();
  };

  const rejectBooking = async (duty) => {
    const reason = window.prompt("Reason for rejecting this professional:");
    if (!reason) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: hospital } = await supabase.from("hospitals").select("hospital_name").eq("id", user.id).single();
    const isNurse = duty.duty_type === "nurse";
    const professional = isNurse ? duty.nurses : duty.doctors;
    if (professional) {
      await supabase.from(isNurse ? "nurses" : "doctors").update({
        flagged: true, flag_reason: reason,
        flagged_by: hospital?.hospital_name || "A hospital",
      }).eq("id", professional.id);
    }
    await supabase.from("locum_duties").update({ booking_status: "open", booked: false, booked_by: null }).eq("id", duty.id);
    alert("Professional rejected. Duty is now open again.");
    fetchDuties();
  };

  const submitReview = async () => {
    if (!reviewStatus) { alert("Please select a review status."); return; }
    if (reviewStatus !== "satisfactory" && !reviewComment) { alert("Please provide a comment."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: hospital } = await supabase.from("hospitals").select("hospital_name").eq("id", user.id).single();
    await supabase.from("locum_duties").update({
      review_status: reviewStatus,
      review_comment: reviewComment,
      reviewed_at: new Date().toISOString(),
      completed: true,
    }).eq("id", reviewingDuty.id);
    if (reviewStatus !== "satisfactory") {
      const isNurse = reviewingDuty.duty_type === "nurse";
      const professional = isNurse ? reviewingDuty.nurses : reviewingDuty.doctors;
      const flagReason = reviewStatus === "late" ? "Late to duty" :
        reviewStatus === "absent" ? "Absent from duty" :
        `Unsatisfactory: ${reviewComment}`;
      if (professional) {
        await supabase.from(isNurse ? "nurses" : "doctors").update({
          flagged: true, flag_reason: flagReason,
          flagged_by: hospital?.hospital_name || "A hospital",
        }).eq("id", professional.id);
      }
    }
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
    if (duty.booking_status === "reopened") return <div className="status-badge status-reopened">🔄 Re-opened</div>;
    if (duty.booking_status === "pending_verification" || duty.booked) return <div className="status-badge status-pending">⏳ Pending Verification</div>;
    return <div className="status-badge status-open">Open</div>;
  };

  const doctorDuties = duties.filter(d => d.duty_type === "doctor" || !d.duty_type);
  const nurseDuties = duties.filter(d => d.duty_type === "nurse");
  const byType = dutyTypeTab === "doctor" ? doctorDuties : nurseDuties;
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

      {/* Doctor / Nurse tabs */}
      <div className="duty-type-tabs">
        <button className={dutyTypeTab === "doctor" ? "active" : ""} onClick={() => setDutyTypeTab("doctor")}>
          👨‍⚕️ Doctor Duties
          {doctorDuties.length > 0 && <span className="tab-count">{doctorDuties.length}</span>}
        </button>
        <button className={`${dutyTypeTab === "nurse" ? "active" : ""} nurse-tab`} onClick={() => setDutyTypeTab("nurse")}>
          👩‍⚕️ Nurse Duties
          {nurseDuties.length > 0 && <span className="tab-count">{nurseDuties.length}</span>}
        </button>
      </div>

      {/* Open / Completed sub-tabs */}
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
            <button onClick={() => navigate("/hospital/dashboard")}>
              Post a {dutyTypeTab === "doctor" ? "Doctor" : "Nurse"} Locum
            </button>
          )}
        </div>
      ) : (
        <div className="duties-grid">
          {displayDuties.map((duty) => {
            const isNurse = duty.duty_type === "nurse";
            const professional = isNurse ? duty.nurses : duty.doctors;
            return (
              <div key={duty.id} className={`duty-card ${duty.completed ? "completed" : duty.booking_status === "confirmed" ? "confirmed" : duty.booked ? "booked" : ""} ${isNurse ? "nurse-card" : ""}`}>
                <div className="duty-header">
                  <h3>{duty.qualifications && duty.qualifications.length > 1 ? `${duty.qualifications.length} Qualifications` : duty.qualification}</h3>
                  <span className="pay">Rs.{duty.gross_pay || duty.pay}</span>
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
                {duty.booked && professional && (
                  <div className="doctor-details">
                    <h4>Booked {isNurse ? "Nurse" : "Doctor"}</h4>
                    <p>👤 {isNurse ? "" : "Dr."} {professional.first_name} {professional.last_name}</p>
                    <p>🎓 {professional.qualification}</p>
                    <p>📞 {professional.phone}</p>
                    <p>✉️ {professional.email}</p>
                    <p>🏥 {professional.experience} years experience</p>
                    <button className="view-doc-btn" onClick={() => viewDocument(professional.document_url)}>📄 View Certificate</button>
                    {duty.booking_status !== "confirmed" && !duty.completed && (
                      <div className="action-buttons">
                        <button className="verify-btn" onClick={() => verifyBooking(duty.id)}>✅ Verify</button>
                        <button className="reject-btn" onClick={() => rejectBooking(duty)}>❌ Reject</button>
                      </div>
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
            <p style={{ color: "#888", marginBottom: 20 }}>
              {(() => {
                const isNurse = reviewingDuty.duty_type === "nurse";
                const p = isNurse ? reviewingDuty.nurses : reviewingDuty.doctors;
                return `${isNurse ? "" : "Dr."} ${p?.first_name} ${p?.last_name} — ${reviewingDuty.date}`;
              })()}
            </p>
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
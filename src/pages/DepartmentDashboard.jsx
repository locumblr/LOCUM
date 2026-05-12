import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./HospitalDashboard.css";

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
  "BDS / MDS (Dentistry)", "B.Pharm / M.Pharm (Pharmacy)",
  "Diploma in Anaesthesiology (DA)", "Diploma in Child Health (DCH)",
  "Diploma in Obstetrics & Gynaecology (DGO)", "Diploma in Orthopaedics (D.Ortho)",
  "Diploma in Ophthalmology (DO)", "Diploma in ENT",
  "Diploma in Radiology (DMRD)", "Diploma in Radiology (DMRD) with PCPNDT Certification",
  "PCPNDT Certified Sonologist", "Fellowship in Emergency Medicine (FCEM)", "Other",
];

const nursingQualifications = [
  "GNM (General Nursing & Midwifery)", "B.Sc Nursing", "Post Basic B.Sc Nursing",
  "M.Sc Nursing", "Critical Care Nursing", "Operation Theatre Nursing",
  "Emergency & Trauma Nursing", "Paediatric Nursing", "Oncology Nursing",
  "Dialysis Nursing", "ICU Nursing", "NICU Nursing", "PICU Nursing",
  "Midwifery", "Community Health Nursing", "Psychiatric Nursing", "Other",
];

const emptyForm = { date: "", start_time: "", end_time: "", qualifications: [], notes: "" };

const isRadiology = (qualifications) =>
  qualifications.some(q =>
    q.toLowerCase().includes("radio") ||
    q.toLowerCase().includes("pcpndt") ||
    q.toLowerCase().includes("sonolog")
  );

function DepartmentDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [duties, setDuties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showQualDropdown, setShowQualDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [reviewingDuty, setReviewingDuty] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("dept_session");
    if (!stored) { navigate("/department/login"); return; }
    const s = JSON.parse(stored);
    setSession(s);
    fetchDuties(s);
  }, []);

  const fetchDuties = async (s) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, doctors(id, first_name, last_name, phone, email, qualification, experience, document_url), nurses(id, first_name, last_name, phone, email, qualification, experience, document_url)")
      .eq("department_id", s.id)
      .order("date", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

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
    if (form.qualifications.length === 0) { alert("Please select at least one qualification."); return; }
    if (!session.fixed_pay || session.fixed_pay === 0) {
      alert("No fixed pay has been set for your department. Please contact HR to set a pay rate before posting duties.");
      return;
    }
    setSubmitting(true);
    const grossPay = parseFloat(session.fixed_pay);
    const doctorPay = Math.round(grossPay * 0.8);
    const platformFee = Math.round(grossPay * 0.2);
    const { error } = await supabase.from("locum_duties").insert({
      hospital_id: session.hospital_id,
      department_id: session.id,
      posted_by_department: true,
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
            body: `New duty at ${session.hospital_name} on ${form.date}. Rs.${doctorPay.toLocaleString()}`,
            url: showForm === "nurse" ? "/nurse/dashboard" : "/doctor/dashboard",
          },
        });
      }
      alert("Duty posted successfully!");
      setForm(emptyForm);
      setShowForm(null);
      setShowQualDropdown(false);
      fetchDuties(session);
    }
    setSubmitting(false);
  };

  const viewDocument = async (documentUrl) => {
    if (!documentUrl) { alert("No document uploaded."); return; }
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(documentUrl, 60);
    if (error) { alert("Error: " + error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const verifyBooking = async (dutyId) => {
    const confirmed = window.confirm("Confirm that you have verified this professional's credentials and approve them for this duty?");
    if (!confirmed) return;
    await supabase.from("locum_duties").update({ booking_status: "confirmed" }).eq("id", dutyId);
    fetchDuties(session);
  };

  const rejectBooking = async (duty) => {
    const reason = window.prompt("Please provide a reason for rejecting this professional:");
    if (!reason) return;
    const isNurse = duty.duty_type === "nurse";
    const professional = isNurse ? duty.nurses : duty.doctors;
    if (professional) {
      await supabase.from(isNurse ? "nurses" : "doctors").update({
        flagged: true,
        flag_reason: reason,
        flagged_by: `${session.hospital_name} — ${session.department_name}`,
      }).eq("id", professional.id);
    }
    await supabase.from("locum_duties").update({
      booking_status: "open",
      booked: false,
      booked_by: null,
    }).eq("id", duty.id);
    fetchDuties(session);
  };

  const submitReview = async () => {
    if (!reviewStatus) { alert("Please select a review status."); return; }
    if (reviewStatus !== "satisfactory" && !reviewComment) {
      alert("Please provide a comment."); return;
    }
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
          flagged: true,
          flag_reason: flagReason,
          flagged_by: `${session.hospital_name} — ${session.department_name}`,
        }).eq("id", professional.id);
      }
    }
    alert("Review submitted!");
    setReviewingDuty(null);
    setReviewStatus("");
    setReviewComment("");
    fetchDuties(session);
  };

  const logout = () => {
    localStorage.removeItem("dept_session");
    navigate("/department/login");
  };

  const isPastDuty = (date) => new Date(date) < new Date();

  const getStatusBadge = (duty) => {
    if (duty.completed) {
      const labels = { satisfactory: "✅ Satisfactory", unsatisfactory: "⚠️ Unsatisfactory", late: "🕐 Late", absent: "❌ Absent" };
      return <div className={`status-badge review-${duty.review_status}`}>{labels[duty.review_status] || "✅ Completed"}</div>;
    }
    if (duty.booking_status === "confirmed") return <div className="status-badge status-confirmed">✅ Confirmed</div>;
    if (duty.booking_status === "pending_verification" || duty.booked) return <div className="status-badge status-pending">⏳ Pending Verification</div>;
    return <div className="status-badge status-open">Open</div>;
  };

  const activeDuties = duties.filter(d => !d.completed);
  const completedDuties = duties.filter(d => d.completed);

  if (!session) return null;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{session.department_name}</h1>
          <p style={{ color: "#888", fontSize: 14 }}>{session.hospital_name} · {session.department_code}</p>
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/department/profile")}>Profile</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {session.fixed_pay === 0 && (
        <div style={{ background: "#fff3e0", border: "1px solid #ff9800", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "#e65100" }}>
          ⚠️ No fixed pay set for this department. Contact HR to set a pay rate before posting duties.
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
        <form onSubmit={submit} className="duty-form" style={{ overflow: "hidden" }}>
          <h2>Post a {showForm === "nurse" ? "Nurse" : "Doctor"} Locum Duty</h2>
          <div style={{ background: "#e8f5e9", border: "1px solid #27ae60", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#2e7d32" }}>
            💰 Fixed pay for this duty: <strong>Rs.{parseFloat(session.fixed_pay || 0).toLocaleString()}</strong> (set by HR)
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input name="date" type="date" required onChange={(e) => setForm({ ...form, date: e.target.value })} value={form.date} />
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input name="start_time" type="time" required onChange={(e) => setForm({ ...form, start_time: e.target.value })} value={form.start_time} />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input name="end_time" type="time" required onChange={(e) => setForm({ ...form, end_time: e.target.value })} value={form.end_time} />
            </div>
          </div>
          <div className="form-group">
            <label>Required Qualifications {form.qualifications.length > 0 && <span style={{ color: "#27ae60", fontSize: 13 }}>({form.qualifications.length} selected)</span>}</label>
            {isRadiology(form.qualifications) && (
              <div style={{ background: "#fff8e1", border: "1px solid #ffcc02", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#795500", marginBottom: 8 }}>
                ⚠️ <strong>PCPNDT Notice:</strong> Select "with PCPNDT Certification" if this duty involves ultrasound examinations.
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
            <label>Additional Notes (optional)</label>
            <textarea name="notes" placeholder="Any special requirements..." onChange={(e) => setForm({ ...form, notes: e.target.value })} value={form.notes} rows={3} />
          </div>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Posting..." : "Post Duty"}
          </button>
        </form>
      )}

      <div className="duty-type-tabs" style={{ marginTop: 24 }}>
        <button className={activeTab === "active" ? "active" : ""} onClick={() => setActiveTab("active")}>
          📋 Active Duties {activeDuties.length > 0 && <span className="tab-count">{activeDuties.length}</span>}
        </button>
        <button className={activeTab === "completed" ? "active" : ""} onClick={() => setActiveTab("completed")}>
          ✅ Completed {completedDuties.length > 0 && <span className="tab-count">{completedDuties.length}</span>}
        </button>
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading...</p> : (
        <div className="duties-grid">
          {(activeTab === "active" ? activeDuties : completedDuties).length === 0 ? (
            <p className="empty-msg">No {activeTab} duties.</p>
          ) : (
            (activeTab === "active" ? activeDuties : completedDuties).map(duty => {
              const isNurse = duty.duty_type === "nurse";
              const professional = isNurse ? duty.nurses : duty.doctors;
              return (
                <div key={duty.id} className={`duty-card ${duty.completed ? "completed" : duty.booking_status === "confirmed" ? "confirmed" : duty.booked ? "booked" : ""} ${isNurse ? "nurse-card" : ""}`}>
                  <div className="duty-header">
                    <h3>{duty.qualifications?.length > 1 ? `${duty.qualifications.length} Qualifications` : duty.qualification}</h3>
                  </div>
                  <div className="duty-details">
                    <p>📅 {duty.date}</p>
                    <p>🕐 {duty.start_time} - {duty.end_time}</p>
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {reviewingDuty && (
        <div className="modal-overlay" onClick={() => setReviewingDuty(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Review Duty</h2>
            <p style={{ color: "#888", marginBottom: 20 }}>
              {reviewingDuty.duty_type === "nurse" ? reviewingDuty.nurses?.first_name : `Dr. ${reviewingDuty.doctors?.first_name}`} — {reviewingDuty.date}
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

export default DepartmentDashboard;
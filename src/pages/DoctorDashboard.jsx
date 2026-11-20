import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  fetchMyApplications, fetchOpenCoverRequests, applyToDuty, withdrawApplication,
  applyForCover, withdrawCoverApplication,
} from "../applications";
import ApplyButton from "../ApplyButton";
import "./DoctorDashboard.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString("default", { month: "long" });
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${monthName} ${day}${suffix}, ${year}`;
};

// Every qualification a doctor holds: the main one plus any added on their profile
// (stored as "degree||certificatePath").
const allQualifications = (doctor) => [
  doctor.qualification,
  ...(doctor.additional_qualifications || []).map(q => q.split("||")[0]),
].filter(Boolean);

// PostgREST filter matching duties that accept any of the given qualifications.
// Values are quoted because qualification names contain brackets and commas,
// which otherwise break the filter and silently return no duties.
const qualificationFilter = (qualifications) => {
  const list = qualifications.map(q => `"${q.replace(/"/g, '\\"')}"`).join(",");
  return `qualification.in.(${list}),qualifications.ov.{${list}}`;
};

function DoctorDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [coverRequests, setCoverRequests] = useState([]);
  const [applications, setApplications] = useState({});
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState("");
  const [doctorQualifications, setDoctorQualifications] = useState([]);
  const [searchDate, setSearchDate] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("locum");
  const [consultations, setConsultations] = useState([]);
  const [consultLoading, setConsultLoading] = useState(false);

  useEffect(() => { fetchDoctorData(); }, []);

  const fetchDoctorData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data: doctor } = await supabase
      .from("doctors")
      .select("first_name, last_name, qualification, additional_qualifications, status")
      .eq("id", user.id)
      .single();
    if (!doctor || doctor.status !== "active") { navigate("/login"); return; }
    setDoctorName(`${doctor.first_name} ${doctor.last_name}`);
    const qualifications = allQualifications(doctor);
    setDoctorQualifications(qualifications);
    refresh(qualifications);
    subscribeToPush(doctor.qualification, user.id);
  };

  const refresh = (qualifications = doctorQualifications) => {
    fetchDuties(qualifications);
    fetchConsultations(qualifications);
    fetchMyApplications().then(setApplications);
    fetchOpenCoverRequests().then(setCoverRequests);
  };

  const subscribeToPush = async (qualification, uid) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BIRe1rpvBs-8IxaS8YG9dvCm5Jk-12bP2GTtan-lRPKH7JaDQUwSCjVB9-CdCBBb66jREzWif0NW7XSk0YRVl9o'
      });
      await supabase.from('push_subscriptions').upsert({
        doctor_id: uid, qualification, subscription: JSON.stringify(subscription),
      }, { onConflict: 'doctor_id' });
    } catch (err) { console.error('Push subscription error:', err); }
  };

  // Open duties only carry the area; the hospital is revealed once a booking is confirmed.
  const DUTY_COLUMNS = "id, date, start_time, end_time, qualification, qualifications, pay, gross_pay, notes, area, duty_type";

  const fetchDuties = async (qualifications) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select(DUTY_COLUMNS)
      .or(qualificationFilter(qualifications))
      .neq("duty_type", "consultation")
      .eq("booking_status", "open")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const fetchConsultations = async (qualifications) => {
    setConsultLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select(DUTY_COLUMNS)
      .eq("duty_type", "consultation")
      .or(qualificationFilter(qualifications))
      .eq("booking_status", "open")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true });
    if (!error) setConsultations(data || []);
    setConsultLoading(false);
  };

  const getSlotLabel = (startTime) => {
    if (!startTime) return "";
    if (startTime < "12:00") return "Morning (8am–12pm)";
    if (startTime < "17:00") return "Afternoon (12pm–5pm)";
    return "Evening (5pm–8pm)";
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const filteredDuties = duties.filter(duty => {
    const matchesDate = searchDate ? duty.date === searchDate : true;
    const matchesLocation = searchLocation
      ? duty.area?.toLowerCase().includes(searchLocation.toLowerCase())
      : true;
    return matchesDate && matchesLocation;
  });

  const appliedCount = Object.values(applications).filter(s => s === "applied").length;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Doctor Dashboard</h1>
          {doctorName && <p style={{ color: "#888", fontSize: 14 }}>Dr. {doctorName}</p>}
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/doctor/locums")}>My Locums</button>
          <button onClick={() => navigate("/doctor/profile")}>Profile</button>
          <div style={{ position: "relative" }}>
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>⋮</button>
            {showMenu && (
              <div className="dropdown-menu">
                <button onClick={() => { navigate("/help"); setShowMenu(false); }}>❓ Help</button>
                <button className="logout-item" onClick={logout}>🚪 Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {appliedCount > 0 && (
        <div style={{ background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, padding: "12px 18px", margin: "0 0 20px", fontSize: 14, color: "#2e7d32" }}>
          You have applied for <strong>{appliedCount}</strong> {appliedCount === 1 ? "duty" : "duties"}. We'll notify you when a hospital confirms you; confirmed duties appear in My Locums.
        </div>
      )}

      {coverRequests.length > 0 && (
        <div className="cover-requests-section">
          <h2>🔄 Cover Needed</h2>
          <p className="subtitle">A booked colleague can't make it. Apply to cover — the hospital confirms the replacement.</p>
          <div className="duties-grid">
            {coverRequests.map((cr) => (
              <div key={cr.cover_request_id} className="duty-card cover-request-card">
                <div className="cover-badge">Cover Needed</div>
                <div className="duty-header">
                  <h3>📍 {cr.area || "Bangalore"}</h3>
                  <span className="pay">Rs.{(cr.pay || 0).toLocaleString()}</span>
                </div>
                <div className="duty-details">
                  <p>📅 {formatDate(cr.date)}</p>
                  <p>🕐 {cr.start_time} - {cr.end_time}</p>
                  <p>🎓 {cr.qualification}</p>
                  {cr.notes && <p>📝 {cr.notes}</p>}
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>Hospital name shared after confirmation</p>
                </div>
                <ApplyButton
                  status={cr.my_application_status}
                  label="Apply to Cover"
                  confirmText={`Apply to cover the ${cr.qualification} duty in ${cr.area || "Bangalore"} on ${formatDate(cr.date)}?\n\nThe hospital reviews cover applicants and confirms one. If you're confirmed, you are responsible for attending.`}
                  onApply={() => applyForCover(cr.cover_request_id)}
                  onWithdraw={() => withdrawCoverApplication(cr.cover_request_id)}
                  onDone={() => refresh()}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #eee" }}>
        <button onClick={() => setActiveTab("locum")}
          style={{ padding: "10px 22px", border: "none", background: "none", cursor: "pointer", fontSize: 15, fontWeight: activeTab === "locum" ? 700 : 400, color: activeTab === "locum" ? "#1e3a5f" : "#888", borderBottom: activeTab === "locum" ? "3px solid #1e3a5f" : "3px solid transparent", marginBottom: -2 }}>
          Locum Duties
        </button>
        <button onClick={() => setActiveTab("consultation")}
          style={{ padding: "10px 22px", border: "none", background: "none", cursor: "pointer", fontSize: 15, fontWeight: activeTab === "consultation" ? 700 : 400, color: activeTab === "consultation" ? "#1e3a5f" : "#888", borderBottom: activeTab === "consultation" ? "3px solid #1e3a5f" : "3px solid transparent", marginBottom: -2 }}>
          In-Patient Consultations
        </button>
      </div>

      {activeTab === "locum" && <>
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label">📅 Filter by Date</label>
          <input type="date" className="search-input" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">📍 Filter by Area</label>
          <input type="text" className="search-input" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} placeholder="e.g. Whitefield, Koramangala..." />
        </div>
        {(searchDate || searchLocation) && (
          <button className="clear-btn" onClick={() => { setSearchDate(""); setSearchLocation(""); }}>✕ Clear Filters</button>
        )}
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading duties...</p> :
        duties.length === 0 ? <p style={{ color: "#888" }}>No available duties matching your qualifications at the moment.</p> :
        filteredDuties.length === 0 ? (
          <p style={{ color: "#888" }}>No duties match your filters. <span style={{ color: "#1e3a5f", cursor: "pointer" }} onClick={() => { setSearchDate(""); setSearchLocation(""); }}>Clear filters</span></p>
        ) : (
          <div className="duties-grid">
            {filteredDuties.map((duty) => (
              <div key={duty.id} className="duty-card">
                <div className="duty-header">
                  <h3>📍 {duty.area || "Bangalore"}</h3>
                  <span className="pay">Rs.{(duty.gross_pay || duty.pay).toLocaleString()}</span>
                </div>
                <div className="duty-details">
                  <p>📅 {formatDate(duty.date)}</p>
                  <p>🕐 {duty.start_time} - {duty.end_time}</p>
                  <p>🎓 {duty.qualification}</p>
                  {duty.notes && <p>📝 {duty.notes}</p>}
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>Hospital name shared after confirmation</p>
                </div>
                <ApplyButton
                  status={applications[duty.id]}
                  confirmText={`Apply for this duty in ${duty.area || "Bangalore"} on ${formatDate(duty.date)}?\n\nThe hospital reviews applicants and confirms one. You'll be notified if you're selected. Once confirmed, you are responsible for attending.`}
                  onApply={() => applyToDuty(duty.id)}
                  onWithdraw={() => withdrawApplication(duty.id)}
                  onDone={() => refresh()}
                />
              </div>
            ))}
          </div>
        )
      }
      </>}

      {activeTab === "consultation" && <>
        <p className="subtitle" style={{ marginBottom: 16 }}>In-patient consultation requests matching your specialty — minimum 3 sessions per booking.</p>
        {consultLoading ? <p style={{ color: "#888" }}>Loading consultations...</p> :
          consultations.length === 0 ? <p style={{ color: "#888" }}>No consultation requests for your specialty at the moment.</p> : (
          <div className="duties-grid">
            {consultations.map((duty) => (
              <div key={duty.id} className="duty-card" style={{ borderLeft: "4px solid #1565c0" }}>
                <div style={{ display: "inline-block", background: "#e3f2fd", color: "#1565c0", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  In-Patient Consultation
                </div>
                <div className="duty-header">
                  <h3>📍 {duty.area || "Bangalore"}</h3>
                  <div style={{ textAlign: "right" }}>
                    <div className="pay" style={{ fontSize: 15 }}>Rs.{(duty.gross_pay || (duty.pay * 3)).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>Rs.{(duty.pay || 0).toLocaleString()} × 3 sessions</div>
                  </div>
                </div>
                <div className="duty-details">
                  <p>📅 First consult: {formatDate(duty.date)}</p>
                  <p>🕐 Preferred slot: {getSlotLabel(duty.start_time)}</p>
                  <p>🎓 {duty.qualification}</p>
                  <p style={{ fontSize: 12, color: "#1565c0", marginTop: 6 }}>3 sessions: Initial · Review · Discharge</p>
                  {duty.notes && <p>📝 {duty.notes}</p>}
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Hospital name shared after confirmation</p>
                </div>
                <ApplyButton
                  status={applications[duty.id]}
                  confirmText={`Apply for this ${duty.qualification} consultation in ${duty.area || "Bangalore"} on ${formatDate(duty.date)}?\n\nThis covers 3 sessions: initial consult, review with investigations, and discharge advice. The hospital reviews applicants and confirms one.`}
                  onApply={() => applyToDuty(duty.id)}
                  onWithdraw={() => withdrawApplication(duty.id)}
                  onDone={() => refresh()}
                />
              </div>
            ))}
          </div>
        )}
      </>}
    </div>
  );
}

export default DoctorDashboard;

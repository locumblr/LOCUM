import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  fetchMyApplications, fetchOpenCoverRequests, applyToDuty, withdrawApplication,
  applyForCover, withdrawCoverApplication,
} from "../applications";
import ApplyButton from "../ApplyButton";
import "./NurseDashboard.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString("default", { month: "long" });
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${monthName} ${day}${suffix}, ${year}`;
};

function NurseDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [coverRequests, setCoverRequests] = useState([]);
  const [applications, setApplications] = useState({});
  const [loading, setLoading] = useState(true);
  const [nurseName, setNurseName] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [activeTab, setActiveTab] = useState("All");

  useEffect(() => { fetchNurseData(); }, []);

  const fetchNurseData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data: nurse } = await supabase
      .from("nurses")
      .select("first_name, last_name, status")
      .eq("id", user.id)
      .single();
    if (!nurse || nurse.status !== "active") { navigate("/login"); return; }
    setNurseName(`${nurse.first_name} ${nurse.last_name}`);
    refresh();
  };

  const refresh = () => {
    fetchDuties();
    fetchMyApplications().then(setApplications);
    fetchOpenCoverRequests().then(setCoverRequests);
  };

  // Open duties only carry the area; the hospital is revealed once a booking is confirmed.
  const fetchDuties = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("id, date, start_time, end_time, qualification, pay, gross_pay, notes, area")
      .eq("duty_type", "nurse")
      .eq("booking_status", "open")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const TABS = ["All", "Ward", "OT", "ICU", "Dialysis", "ER"];

  const filteredDuties = duties.filter(duty => {
    const matchesDate = searchDate ? duty.date === searchDate : true;
    const matchesLocation = searchLocation
      ? duty.area?.toLowerCase().includes(searchLocation.toLowerCase())
      : true;
    const matchesTab = activeTab === "All" ? true
      : activeTab === "OT" ? duty.qualification?.startsWith("OT")
      : duty.qualification === activeTab;
    return matchesDate && matchesLocation && matchesTab;
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Nurse Dashboard</h1>
          {nurseName && <p style={{ color: "#888", fontSize: 14 }}>{nurseName}</p>}
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/nurse/locums")}>My Locums</button>
          <button onClick={() => navigate("/nurse/profile")}>Profile</button>
          <button onClick={logout} className="logout">Logout</button>
        </div>
      </div>

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
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>Hospital name shared after confirmation</p>
                </div>
                <ApplyButton
                  status={cr.my_application_status}
                  label="Apply to Cover"
                  confirmText={`Apply to cover the ${cr.qualification} duty in ${cr.area || "Bangalore"} on ${formatDate(cr.date)}?\n\nThe hospital reviews cover applicants and confirms one. If you're confirmed, you are responsible for attending.`}
                  onApply={() => applyForCover(cr.cover_request_id)}
                  onWithdraw={() => withdrawCoverApplication(cr.cover_request_id)}
                  onDone={refresh}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <h2>Available Nurse Locum Duties</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 16px" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: "8px 18px", borderRadius: 20, border: `2px solid ${activeTab === tab ? "#1e3a5f" : "#ddd"}`,
              background: activeTab === tab ? "#1e3a5f" : "white", color: activeTab === tab ? "white" : "#555",
              fontWeight: activeTab === tab ? 700 : 400, cursor: "pointer", fontSize: 14 }}>
            {tab}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <input type="date" className="search-input" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
        <input type="text" className="search-input" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} placeholder="🔍 Search by area (e.g. Whitefield)..." />
        {(searchDate || searchLocation) && (
          <button className="clear-btn" onClick={() => { setSearchDate(""); setSearchLocation(""); }}>✕ Clear</button>
        )}
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading duties...</p> :
        duties.length === 0 ? <p style={{ color: "#888" }}>No available nurse duties at the moment.</p> :
        filteredDuties.length === 0 ? (
          <p style={{ color: "#888" }}>No duties match your search. <span style={{ color: "#1e3a5f", cursor: "pointer" }} onClick={() => { setSearchDate(""); setSearchLocation(""); }}>Clear filters</span></p>
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
                  onDone={refresh}
                />
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

export default NurseDashboard;

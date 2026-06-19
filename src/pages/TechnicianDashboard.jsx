import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./NurseDashboard.css";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString("default", { month: "long" });
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${monthName} ${day}${suffix}, ${year}`;
};

function TechnicianDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [techName, setTechName] = useState("");
  const [techQualification, setTechQualification] = useState("");
  const [techId, setTechId] = useState(null);
  const [booking, setBooking] = useState(null);
  const [searchDate, setSearchDate] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [myLockedDuty, setMyLockedDuty] = useState(null);

  useEffect(() => { fetchTechData(); }, []);

  const fetchTechData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setTechId(user.id);
    const { data: tech } = await supabase
      .from("technicians")
      .select("first_name, last_name, qualification, status")
      .eq("id", user.id)
      .single();
    if (!tech || tech.status !== "active") { navigate("/login"); return; }
    setTechName(`${tech.first_name} ${tech.last_name}`);
    setTechQualification(tech.qualification);
    fetchDuties(tech.qualification, user.id);
    fetchMyLockedDuty(user.id);
  };

  const fetchMyLockedDuty = async (uid) => {
    const { data } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, area)")
      .eq("booked_by", uid)
      .eq("booking_status", "locked")
      .single();
    setMyLockedDuty(data || null);
  };

  const fetchDuties = async (qualification, uid) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, area, address)")
      .eq("duty_type", "technician")
      .eq("qualification", qualification)
      .eq("booked", false)
      .eq("completed", false)
      .eq("booking_status", "open")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const bookDuty = async (duty) => {
    const confirmed = window.confirm(
      `Accept this ${duty.qualification} duty at ${duty.hospitals?.area || "the hospital"} on ${formatDate(duty.date)}?\n\nThe hospital will be notified to confirm and pay the platform fee within 4 hours. Once confirmed, neither party can cancel.`
    );
    if (!confirmed) return;
    setBooking(duty.id);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: latest } = await supabase.from("locum_duties").select("booked, booking_status").eq("id", duty.id).single();
    if (latest?.booked || latest?.booking_status !== "open") {
      alert("Sorry, this duty was just taken by someone else!");
      setBooking(null);
      fetchDuties(techQualification, techId);
      return;
    }

    const { error } = await supabase.from("locum_duties")
      .update({ booked: true, booked_by: user.id, booking_status: "locked", locked_at: new Date().toISOString() })
      .eq("id", duty.id)
      .eq("booked", false);

    if (error) { alert("Error accepting duty: " + error.message); setBooking(null); return; }

    await supabase.from("notifications").insert({
      user_id: duty.hospital_id,
      title: "🔒 Duty Accepted — Pay to Confirm",
      message: `${techName} (${duty.qualification}) has accepted your duty on ${formatDate(duty.date)}. Pay the platform fee of Rs.${(duty.platform_fee || 0).toLocaleString()} within 4 hours to confirm.`,
    });

    alert("Duty accepted! Waiting for hospital to confirm payment. You'll be notified once confirmed.");
    fetchDuties(techQualification, techId);
    fetchMyLockedDuty(user.id);
    setBooking(null);
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const getTimeRemaining = (lockedAt) => {
    if (!lockedAt) return null;
    const expiry = new Date(new Date(lockedAt).getTime() + 4 * 60 * 60 * 1000);
    const diff = expiry - new Date();
    if (diff <= 0) return "Expiring soon...";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const filteredDuties = duties.filter(duty => {
    const matchesDate = searchDate ? duty.date === searchDate : true;
    const matchesLocation = searchLocation
      ? duty.hospitals?.area?.toLowerCase().includes(searchLocation.toLowerCase())
      : true;
    return matchesDate && matchesLocation;
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Technician Dashboard</h1>
          {techName && <p style={{ color: "#888", fontSize: 14 }}>{techName} — {techQualification}</p>}
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/technician/locums")}>My Locums</button>
          <button onClick={() => navigate("/technician/profile")}>Profile</button>
          <button onClick={logout} className="logout">Logout</button>
        </div>
      </div>

      {myLockedDuty && (
        <div style={{ background: "#fff8e1", border: "1px solid #f39c12", borderRadius: 10, padding: "14px 20px", margin: "0 0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={{ fontWeight: 700, color: "#795500", margin: 0, fontSize: 14 }}>🔒 Pending Confirmation</p>
            <p style={{ color: "#795500", margin: "4px 0 0", fontSize: 13 }}>
              {myLockedDuty.qualification} duty on {formatDate(myLockedDuty.date)} — awaiting hospital payment
            </p>
          </div>
          <p style={{ color: "#e74c3c", fontSize: 13, fontWeight: 600, margin: 0 }}>
            ⏰ {getTimeRemaining(myLockedDuty.locked_at)} left
          </p>
        </div>
      )}

      <h2>Available Duties — {techQualification}</h2>

      <div className="search-bar">
        <input type="date" className="search-input" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
        <input type="text" className="search-input" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} placeholder="🔍 Search by area (e.g. Whitefield)..." />
        {(searchDate || searchLocation) && (
          <button className="clear-btn" onClick={() => { setSearchDate(""); setSearchLocation(""); }}>✕ Clear</button>
        )}
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading duties...</p> :
        duties.length === 0 ? <p style={{ color: "#888" }}>No available {techQualification} duties at the moment.</p> :
        filteredDuties.length === 0 ? (
          <p style={{ color: "#888" }}>No duties match your search. <span style={{ color: "#1e3a5f", cursor: "pointer" }} onClick={() => { setSearchDate(""); setSearchLocation(""); }}>Clear filters</span></p>
        ) : (
          <div className="duties-grid">
            {filteredDuties.map((duty) => (
              <div key={duty.id} className="duty-card">
                <div className="duty-header">
                  <h3>📍 {duty.hospitals?.area || "Bangalore"}</h3>
                  <span className="pay">Rs.{(duty.gross_pay || duty.pay).toLocaleString()}</span>
                </div>
                <div className="duty-details">
                  <p>📅 {formatDate(duty.date)}</p>
                  <p>🕐 {duty.start_time} - {duty.end_time}</p>
                  <p>🎓 {duty.qualification}</p>
                  {duty.notes && <p>📝 {duty.notes}</p>}
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>Hospital name shared after confirmation</p>
                </div>
                <button className="book-btn" onClick={() => bookDuty(duty)} disabled={booking === duty.id || !!myLockedDuty}>
                  {booking === duty.id ? "Accepting..." : myLockedDuty ? "Duty Pending" : "Accept Duty"}
                </button>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

export default TechnicianDashboard;

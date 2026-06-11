import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./DoctorDashboard.css";

function DoctorDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [coverRequests, setCoverRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState("");
  const [doctorQualification, setDoctorQualification] = useState("");
  const [doctorId, setDoctorId] = useState(null);
  const [booking, setBooking] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [searchDate, setSearchDate] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [myLockedDuty, setMyLockedDuty] = useState(null);

  useEffect(() => { fetchDoctorData(); }, []);

  const fetchDoctorData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setDoctorId(user.id);
    const { data: doctor } = await supabase
      .from("doctors")
      .select("first_name, last_name, qualification, status")
      .eq("id", user.id)
      .single();
    if (!doctor || doctor.status !== "active") { navigate("/login"); return; }
    setDoctorName(`${doctor.first_name} ${doctor.last_name}`);
    setDoctorQualification(doctor.qualification);
    fetchDuties(doctor.qualification, user.id);
    fetchCoverRequests(doctor.qualification, user.id);
    fetchMyLockedDuty(user.id);
    subscribeToPush(doctor.qualification, user.id);
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

  const fetchDuties = async (qualification, uid) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, area, address)")
      .or(`qualification.eq.${qualification},qualifications.cs.{${qualification}}`)
      .eq("booked", false)
      .eq("completed", false)
      .eq("booking_status", "open")
      .order("date", { ascending: true });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const fetchCoverRequests = async (qualification, userId) => {
    const { data, error } = await supabase
      .from("cover_requests")
      .select("*, locum_duties(*, hospitals(hospital_name, area, address)), doctors(first_name, last_name)")
      .eq("status", "open")
      .neq("requesting_doctor_id", userId);
    if (!error) {
      const filtered = (data || []).filter(cr => cr.locum_duties?.qualification === qualification);
      setCoverRequests(filtered);
    }
  };

  const bookDuty = async (duty) => {
    const confirmed = window.confirm(
      `Accept this duty at ${duty.hospitals?.area || "the hospital"} on ${duty.date}?\n\nThe hospital will be notified to confirm and pay the platform fee within 4 hours. Once confirmed, neither party can cancel.`
    );
    if (!confirmed) return;
    setBooking(duty.id);
    const { data: { user } } = await supabase.auth.getUser();

    // Race condition check
    const { data: latest } = await supabase.from("locum_duties").select("booked, booking_status").eq("id", duty.id).single();
    if (latest?.booked || latest?.booking_status !== "open") {
      alert("Sorry, this duty was just taken by someone else!");
      setBooking(null);
      fetchDuties(doctorQualification, doctorId);
      return;
    }

    const { error } = await supabase.from("locum_duties")
      .update({ booked: true, booked_by: user.id, booking_status: "locked", locked_at: new Date().toISOString() })
      .eq("id", duty.id)
      .eq("booked", false);

    if (error) { alert("Error accepting duty: " + error.message); setBooking(null); return; }

    // Notify hospital to pay
    await supabase.from("notifications").insert({
      user_id: duty.hospital_id,
      title: "🔒 Duty Accepted — Pay to Confirm",
      message: `Dr. ${doctorName} has accepted your ${duty.qualification} duty on ${duty.date}. Pay the platform fee of Rs.${(duty.platform_fee || 0).toLocaleString()} within 4 hours to confirm. After 4 hours the duty will be cancelled.`,
    });

    alert("Duty accepted! Waiting for hospital to confirm payment. You'll be notified once confirmed.");
    fetchDuties(doctorQualification, doctorId);
    fetchMyLockedDuty(user.id);
    setBooking(null);
  };

  const acceptCover = async (coverRequest) => {
    const confirmed = window.confirm(`Accept cover for duty at ${coverRequest.locum_duties?.hospitals?.area || "hospital"} on ${coverRequest.locum_duties?.date}?`);
    if (!confirmed) return;
    setAccepting(coverRequest.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: coveringDoctor } = await supabase.from("doctors").select("first_name, last_name").eq("id", user.id).single();
    await supabase.from("cover_requests").update({ status: "accepted", covering_doctor_id: user.id }).eq("id", coverRequest.id);
    const { error } = await supabase.from("locum_duties").update({
      booked_by: user.id, booked: true, booking_status: "locked", locked_at: new Date().toISOString(),
    }).eq("id", coverRequest.duty_id);
    if (error) { alert("Error accepting cover: " + error.message); setAccepting(null); return; }
    await supabase.from("notifications").insert({
      user_id: coverRequest.locum_duties?.hospital_id,
      title: "🔒 Cover Accepted — Pay to Confirm",
      message: `Dr. ${coveringDoctor?.first_name} ${coveringDoctor?.last_name} has accepted cover for the ${coverRequest.locum_duties?.qualification} duty on ${coverRequest.locum_duties?.date}. Pay the platform fee to confirm.`,
    });
    alert("Cover accepted! Waiting for hospital to confirm payment.");
    fetchDuties(doctorQualification, doctorId);
    fetchCoverRequests(doctorQualification, doctorId);
    fetchMyLockedDuty(doctorId);
    setAccepting(null);
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

      {/* Locked duty banner */}
      {myLockedDuty && (
        <div style={{ background: "#fff8e1", border: "1px solid #f39c12", borderRadius: 10, padding: "14px 20px", margin: "0 0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <p style={{ fontWeight: 700, color: "#795500", margin: 0, fontSize: 14 }}>🔒 Pending Confirmation</p>
            <p style={{ color: "#795500", margin: "4px 0 0", fontSize: 13 }}>
              {myLockedDuty.qualification} duty on {myLockedDuty.date} — awaiting hospital payment
            </p>
          </div>
          <p style={{ color: "#e74c3c", fontSize: 13, fontWeight: 600, margin: 0 }}>
            ⏰ {getTimeRemaining(myLockedDuty.locked_at)} left
          </p>
        </div>
      )}

      {coverRequests.length > 0 && (
        <div className="cover-requests-section">
          <h2>🔄 Cover Requests</h2>
          <p className="subtitle">A colleague needs cover — can you help?</p>
          <div className="duties-grid">
            {coverRequests.map((cr) => (
              <div key={cr.id} className="duty-card cover-request-card">
                <div className="cover-badge">Cover Needed</div>
                <div className="duty-header">
                  <h3>{cr.locum_duties?.hospitals?.area || "Hospital Area"}</h3>
                  <span className="pay">Rs.{(cr.locum_duties?.gross_pay || cr.locum_duties?.pay || 0).toLocaleString()}</span>
                </div>
                <div className="duty-details">
                  <p>📍 {cr.locum_duties?.hospitals?.area || "—"}</p>
                  <p>📅 {cr.locum_duties?.date}</p>
                  <p>🕐 {cr.locum_duties?.start_time} - {cr.locum_duties?.end_time}</p>
                  <p>🎓 {cr.locum_duties?.qualification}</p>
                  <p style={{ fontSize: 13, color: "#888" }}>Requested by Dr. {cr.doctors?.first_name} {cr.doctors?.last_name}</p>
                </div>
                <button className="book-btn" style={{ background: "#27ae60" }} onClick={() => acceptCover(cr)} disabled={accepting === cr.id}>
                  {accepting === cr.id ? "Accepting..." : "✅ Accept Cover"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2>Available Locum Duties</h2>
      {doctorQualification && <p className="subtitle">Showing duties for: <strong>{doctorQualification}</strong></p>}

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
        duties.length === 0 ? <p style={{ color: "#888" }}>No available duties matching your qualification at the moment.</p> :
        filteredDuties.length === 0 ? (
          <p style={{ color: "#888" }}>No duties match your filters. <span style={{ color: "#1e3a5f", cursor: "pointer" }} onClick={() => { setSearchDate(""); setSearchLocation(""); }}>Clear filters</span></p>
        ) : (
          <div className="duties-grid">
            {filteredDuties.map((duty) => (
              <div key={duty.id} className="duty-card">
                <div className="duty-header">
                  <h3>📍 {duty.hospitals?.area || "Bangalore"}</h3>
                  <span className="pay">Rs.{(duty.gross_pay || duty.pay).toLocaleString()}</span>
                </div>
                <div className="duty-details">
                  <p>📅 {duty.date}</p>
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

export default DoctorDashboard;

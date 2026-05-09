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
  const [booking, setBooking] = useState(null);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const fetchDoctorData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data: doctor } = await supabase
      .from("doctors")
      .select("first_name, last_name, qualification")
      .eq("id", user.id)
      .single();
    if (doctor) {
      setDoctorName(`${doctor.first_name} ${doctor.last_name}`);
      setDoctorQualification(doctor.qualification);
      fetchDuties(doctor.qualification);
      fetchCoverRequests(doctor.qualification, user.id);
      subscribeToPush(doctor.qualification);
    }
  };

  const subscribeToPush = async (qualification) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BIRe1rpvBs-8IxaS8YG9dvCm5Jk-12bP2GTtan-lRPKH7JaDQUwSCjVB9-CdCBBb66jREzWif0NW7XSk0YRVl9o'
      });
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('push_subscriptions').upsert({
        doctor_id: user.id,
        qualification: qualification,
        subscription: JSON.stringify(subscription),
      }, { onConflict: 'doctor_id' });
    } catch (err) {
      console.error('Push subscription error:', err);
    }
  };

  const fetchDuties = async (qualification) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, address)")
      .eq("qualification", qualification)
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
      .select("*, locum_duties(*, hospitals(hospital_name, address)), doctors(first_name, last_name)")
      .eq("status", "open")
      .neq("requesting_doctor_id", userId);
    if (!error) {
      const filtered = (data || []).filter(cr => cr.locum_duties?.qualification === qualification);
      setCoverRequests(filtered);
    }
  };

  const bookDuty = async (duty) => {
    const confirmed = window.confirm(
      `Confirm booking at ${duty.hospitals?.hospital_name} on ${duty.date}?\n\nNote: Once booked, this cannot be cancelled.`
    );
    if (!confirmed) return;
    setBooking(duty.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: latest } = await supabase
      .from("locum_duties")
      .select("booked, booking_status")
      .eq("id", duty.id)
      .single();
    if (latest?.booked || latest?.booking_status !== "open") {
      alert("Sorry, this duty was just booked by someone else!");
      setBooking(null);
      fetchDuties(doctorQualification);
      return;
    }
    const { error } = await supabase
      .from("locum_duties")
      .update({ booked: true, booked_by: user.id, booking_status: "pending_verification" })
      .eq("id", duty.id)
      .eq("booked", false);
    if (error) {
      alert("Error booking duty: " + error.message);
    } else {
      alert("Booking confirmed! The hospital will verify your credentials before the duty date.");
      fetchDuties(doctorQualification);
    }
    setBooking(null);
  };

  const acceptCover = async (coverRequest) => {
    const confirmed = window.confirm(
      `Accept cover for duty at ${coverRequest.locum_duties?.hospitals?.hospital_name} on ${coverRequest.locum_duties?.date}?\n\nYou will take over this duty from Dr. ${coverRequest.doctors?.first_name} ${coverRequest.doctors?.last_name}.`
    );
    if (!confirmed) return;
    setAccepting(coverRequest.id);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: coveringDoctor } = await supabase
      .from("doctors")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    await supabase.from("cover_requests").update({
      status: "accepted",
      covering_doctor_id: user.id,
    }).eq("id", coverRequest.id);

    const { error } = await supabase.from("locum_duties").update({
      booked_by: user.id,
      booked: true,
      booking_status: "reopened",
    }).eq("id", coverRequest.duty_id);

    if (error) {
      alert("Error accepting cover: " + error.message);
      setAccepting(null);
      return;
    }

    // Notify hospital
    await supabase.from("notifications").insert({
      user_id: coverRequest.locum_duties?.hospital_id,
      title: "🔄 Booking Re-opened — Re-verification Required",
      message: `Dr. ${coverRequest.doctors?.first_name} ${coverRequest.doctors?.last_name} has requested cover for the ${coverRequest.locum_duties?.qualification} duty on ${coverRequest.locum_duties?.date}. Dr. ${coveringDoctor?.first_name} ${coveringDoctor?.last_name} has agreed to cover and requires your verification.`,
    });

    alert("You have accepted the cover! The hospital has been notified and will need to re-verify your credentials.");
    fetchDuties(doctorQualification);
    fetchCoverRequests(doctorQualification, user.id);
    setAccepting(null);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

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
          <button onClick={() => navigate("/help")}>Help</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {coverRequests.length > 0 && (
        <div className="cover-requests-section">
          <h2>🔄 Cover Requests</h2>
          <p className="subtitle">A colleague needs cover for these duties — can you help?</p>
          <div className="duties-grid">
            {coverRequests.map((cr) => (
              <div key={cr.id} className="duty-card cover-request-card">
                <div className="cover-badge">Cover Needed</div>
                <div className="duty-header">
                  <h3>{cr.locum_duties?.hospitals?.hospital_name}</h3>
                  <span className="pay">₹{cr.locum_duties?.pay}</span>
                </div>
                <div className="duty-details">
                  <p>📍 {cr.locum_duties?.hospitals?.address}</p>
                  <p>📅 {cr.locum_duties?.date}</p>
                  <p>🕐 {cr.locum_duties?.start_time} - {cr.locum_duties?.end_time}</p>
                  <p>🎓 {cr.locum_duties?.qualification}</p>
                  <p>📋 Reason: {cr.reason}</p>
                </div>
                <button
                  className="book-btn"
                  style={{ background: "#27ae60" }}
                  onClick={() => acceptCover(cr)}
                  disabled={accepting === cr.id}
                >
                  {accepting === cr.id ? "Accepting..." : "✅ Accept Cover"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2>Available Locum Duties</h2>
      <p className="subtitle">
        {doctorQualification ? `Showing duties matching: ${doctorQualification}` : "Loading..."}
      </p>

      {loading ? (
        <p style={{ color: "#888" }}>Loading duties...</p>
      ) : duties.length === 0 ? (
        <p style={{ color: "#888" }}>No available duties matching your qualification at the moment.</p>
      ) : (
        <div className="duties-grid">
          {duties.map((duty) => (
            <div key={duty.id} className="duty-card">
              <div className="duty-header">
                <h3>{duty.hospitals?.hospital_name || "Hospital"}</h3>
                <span className="pay">₹{duty.pay}</span>
              </div>
              <div className="duty-details">
                <p>📍 {duty.hospitals?.address || "Address not provided"}</p>
                <p>📅 {duty.date}</p>
                <p>🕐 {duty.start_time} - {duty.end_time}</p>
                <p>🎓 {duty.qualification}</p>
                {duty.notes && <p>📝 {duty.notes}</p>}
              </div>
              <button
                className="book-btn"
                onClick={() => bookDuty(duty)}
                disabled={booking === duty.id}
              >
                {booking === duty.id ? "Booking..." : "Book Duty"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
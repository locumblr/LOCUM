import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./DoctorDashboard.css";

function DoctorDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState("");
  const [doctorQualification, setDoctorQualification] = useState("");
  const [booking, setBooking] = useState(null);

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
      .order("date", { ascending: true });

    if (!error) setDuties(data || []);
    setLoading(false);
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
      .select("booked")
      .eq("id", duty.id)
      .single();

    if (latest?.booked) {
      alert("Sorry, this duty was just booked by someone else!");
      setBooking(null);
      fetchDuties(doctorQualification);
      return;
    }

    const { error } = await supabase
      .from("locum_duties")
      .update({ booked: true, booked_by: user.id })
      .eq("id", duty.id)
      .eq("booked", false);

    if (error) {
      alert("Error booking duty: " + error.message);
    } else {
      alert("Booking confirmed! You will be notified with full details shortly.");
      fetchDuties(doctorQualification);
    }

    setBooking(null);
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
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <h2>Available Locum Duties</h2>
      <p className="subtitle">
        {doctorQualification
          ? `Showing duties matching: ${doctorQualification}`
          : "Loading your qualifications..."}
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
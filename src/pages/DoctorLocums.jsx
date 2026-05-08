import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./DoctorLocums.css";

function DoctorLocums() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookedDuties();
  }, []);

  const fetchBookedDuties = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, address, phone, email)")
      .eq("booked_by", user.id)
      .order("date", { ascending: true });

    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (duty) => {
    if (duty.booking_status === "confirmed") {
      return <div className="status-badge confirmed">✅ Confirmed by Hospital</div>;
    }
    return <div className="status-badge pending">⏳ Pending Verification</div>;
  };

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

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : duties.length === 0 ? (
        <div className="empty-state">
          <p>You haven't booked any locum duties yet.</p>
          <button onClick={() => navigate("/doctor/dashboard")}>
            Browse Available Duties
          </button>
        </div>
      ) : (
        <div className="duties-grid">
          {duties.map((duty) => (
            <div key={duty.id} className={`duty-card ${duty.booking_status === "confirmed" ? "confirmed" : "pending-card"}`}>
              <div className="duty-header">
                <h3>{duty.hospitals?.hospital_name || "Hospital"}</h3>
                <span className="pay">₹{duty.pay}</span>
              </div>
              <div className="duty-details">
                <p>📍 {duty.hospitals?.address || "—"}</p>
                <p>📅 {duty.date}</p>
                <p>🕐 {duty.start_time} - {duty.end_time}</p>
                <p>🎓 {duty.qualification}</p>
                {duty.booking_status === "confirmed" && (
                  <>
                    <p>📞 {duty.hospitals?.phone || "—"}</p>
                    <p>✉️ {duty.hospitals?.email || "—"}</p>
                  </>
                )}
                {duty.notes && <p>📝 {duty.notes}</p>}
              </div>
              {getStatusBadge(duty)}
              {duty.booking_status !== "confirmed" && (
                <p className="verification-note">
                  The hospital is reviewing your credentials. You will be notified once confirmed.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DoctorLocums;
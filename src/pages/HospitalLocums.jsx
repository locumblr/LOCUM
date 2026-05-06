import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./HospitalLocums.css";

function HospitalLocums() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDuties();
  }, []);

  const fetchDuties = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, doctors(first_name, last_name, phone, qualification)")
      .eq("hospital_id", user.id)
      .order("date", { ascending: true });

    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="locums-container">
      <div className="locums-header">
        <h1>Posted Locum Duties</h1>
        <div className="header-buttons">
          <button onClick={() => navigate("/hospital/dashboard")}>Dashboard</button>
          <button onClick={() => navigate("/hospital/profile")}>Profile</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : duties.length === 0 ? (
        <div className="empty-state">
          <p>You haven't posted any locum duties yet.</p>
          <button onClick={() => navigate("/hospital/dashboard")}>
            Post a Duty
          </button>
        </div>
      ) : (
        <div className="duties-grid">
          {duties.map((duty) => (
            <div key={duty.id} className={`duty-card ${duty.booked ? "booked" : ""}`}>
              <div className="duty-header">
                <h3>{duty.qualification}</h3>
                <span className="pay">₹{duty.pay}</span>
              </div>
              <div className="duty-details">
                <p>📅 {duty.date}</p>
                <p>🕐 {duty.start_time} - {duty.end_time}</p>
                {duty.notes && <p>📝 {duty.notes}</p>}
              </div>

              {duty.booked && duty.doctors ? (
                <div className="booked-info">
                  <div className="status-badge status-booked">Booked</div>
                  <p className="booked-by">👤 Dr. {duty.doctors.first_name} {duty.doctors.last_name}</p>
                  <p className="booked-by">🎓 {duty.doctors.qualification}</p>
                  <p className="booked-by">📞 {duty.doctors.phone}</p>
                </div>
              ) : (
                <div className="status-badge status-open">Open</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HospitalLocums;
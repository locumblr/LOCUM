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
      .select("*, doctors(id, first_name, last_name, phone, email, qualification, experience, document_url)")
      .eq("hospital_id", user.id)
      .order("date", { ascending: true });

    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const viewDocument = async (documentUrl) => {
    if (!documentUrl) { alert("No document uploaded by this doctor."); return; }
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(documentUrl, 60);
    if (error) { alert("Error accessing document: " + error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const verifyDoctor = async (dutyId) => {
    const confirmed = window.confirm("Confirm that you have verified this doctor's credentials and approve them for this duty?");
    if (!confirmed) return;
    const { error } = await supabase
      .from("locum_duties")
      .update({ booking_status: "confirmed" })
      .eq("id", dutyId);
    if (error) { alert("Error: " + error.message); return; }
    alert("Doctor verified and confirmed for this duty!");
    fetchDuties();
  };

  const rejectDoctor = async (duty) => {
    const reason = window.prompt("Please provide a reason for rejecting this doctor:");
    if (!reason) return;

    // Get hospital name
    const { data: { user } } = await supabase.auth.getUser();
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("hospital_name")
      .eq("id", user.id)
      .single();

    // Flag the doctor
    await supabase
      .from("doctors")
      .update({
        flagged: true,
        flag_reason: reason,
        flagged_by: hospital?.hospital_name || "A hospital",
      })
      .eq("id", duty.doctors.id);

    // Reset duty back to open
    await supabase
      .from("locum_duties")
      .update({
        booking_status: "open",
        booked: false,
        booked_by: null,
      })
      .eq("id", duty.id);

    alert("Doctor rejected and flagged for admin review. The duty is now available for other doctors.");
    fetchDuties();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusBadge = (duty) => {
    if (duty.booking_status === "confirmed") return <div className="status-badge status-confirmed">Confirmed</div>;
    if (duty.booking_status === "pending_verification" || duty.booked) return <div className="status-badge status-pending">Pending Verification</div>;
    return <div className="status-badge status-open">Open</div>;
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
          <button onClick={() => navigate("/hospital/dashboard")}>Post a Duty</button>
        </div>
      ) : (
        <div className="duties-grid">
          {duties.map((duty) => (
            <div key={duty.id} className={`duty-card ${duty.booking_status === "confirmed" ? "confirmed" : duty.booked ? "booked" : ""}`}>
              <div className="duty-header">
                <h3>{duty.qualification}</h3>
                <span className="pay">₹{duty.pay}</span>
              </div>
              <div className="duty-details">
                <p>📅 {duty.date}</p>
                <p>🕐 {duty.start_time} - {duty.end_time}</p>
                {duty.notes && <p>📝 {duty.notes}</p>}
              </div>

              {getStatusBadge(duty)}

              {duty.booked && duty.doctors && (
                <div className="doctor-details">
                  <h4>Booked Doctor</h4>
                  <p>👤 Dr. {duty.doctors.first_name} {duty.doctors.last_name}</p>
                  <p>🎓 {duty.doctors.qualification}</p>
                  <p>📞 {duty.doctors.phone}</p>
                  <p>✉️ {duty.doctors.email}</p>
                  <p>🏥 {duty.doctors.experience} years experience</p>

                  <button
                    className="view-doc-btn"
                    onClick={() => viewDocument(duty.doctors.document_url)}
                  >
                    📄 View Certificate
                  </button>

                  {duty.booking_status !== "confirmed" && (
                    <div className="action-buttons">
                      <button className="verify-btn" onClick={() => verifyDoctor(duty.id)}>
                        ✅ Verify Doctor
                      </button>
                      <button className="reject-btn" onClick={() => rejectDoctor(duty)}>
                        ❌ Reject Doctor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HospitalLocums;
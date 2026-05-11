import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal");
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dutyHistory, setDutyHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [personal, setPersonal] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", hospitalName: "",
    address: "", registrationNumber: "", contactPerson: "",
  });

  const [qualification, setQualification] = useState({
    degree: "", experience: "",
  });

  const [password, setPassword] = useState({
    newPass: "", confirm: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const userRole = user.user_metadata?.role;
    setRole(userRole);

    if (userRole === "doctor") {
      const { data } = await supabase.from("doctors").select("*").eq("id", user.id).single();
      if (data) {
        setPersonal({ firstName: data.first_name || "", lastName: data.last_name || "", email: data.email || "", phone: data.phone || "" });
        setQualification({ degree: data.qualification || "", experience: data.experience || "" });
      }
    } else if (userRole === "nurse") {
      const { data } = await supabase.from("nurses").select("*").eq("id", user.id).single();
      if (data) {
        setPersonal({ firstName: data.first_name || "", lastName: data.last_name || "", email: data.email || "", phone: data.phone || "" });
        setQualification({ degree: data.qualification || "", experience: data.experience || "" });
      }
    } else if (userRole === "hospital") {
      const { data } = await supabase.from("hospitals").select("*").eq("id", user.id).single();
      if (data) {
        setPersonal({
          hospitalName: data.hospital_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          registrationNumber: data.registration_number || "",
          contactPerson: data.contact_person || "",
        });
      }
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (role === "doctor" || role === "nurse") {
      const { data } = await supabase
        .from("locum_duties")
        .select("*, hospitals(hospital_name, address)")
        .eq("booked_by", user.id)
        .order("date", { ascending: false });
      setDutyHistory(data || []);
    } else if (role === "hospital") {
      const { data } = await supabase
        .from("locum_duties")
        .select("*, doctors(first_name, last_name), nurses(first_name, last_name)")
        .eq("hospital_id", user.id)
        .order("date", { ascending: false });
      setDutyHistory(data || []);
    }
    setHistoryLoading(false);
  };

  const savePersonal = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (role === "doctor" || role === "nurse") {
      const table = role === "nurse" ? "nurses" : "doctors";
      const { error } = await supabase.from(table).update({
        first_name: personal.firstName,
        last_name: personal.lastName,
        phone: personal.phone,
      }).eq("id", user.id);
      if (error) { alert("Error: " + error.message); return; }
    } else {
      const { error } = await supabase.from("hospitals").update({
        hospital_name: personal.hospitalName,
        phone: personal.phone,
        address: personal.address,
        contact_person: personal.contactPerson,
      }).eq("id", user.id);
      if (error) { alert("Error: " + error.message); return; }
    }
    alert("Details updated successfully!");
  };

  const saveQualification = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const table = role === "nurse" ? "nurses" : "doctors";
    const { error } = await supabase.from(table).update({
      qualification: qualification.degree,
      experience: parseInt(qualification.experience),
    }).eq("id", user.id);
    if (error) { alert("Error: " + error.message); return; }
    alert("Qualification updated successfully!");
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (password.newPass !== password.confirm) { alert("Passwords do not match!"); return; }
    const { error } = await supabase.auth.updateUser({ password: password.newPass });
    if (error) { alert("Error: " + error.message); return; }
    alert("Password changed successfully!");
    setPassword({ newPass: "", confirm: "" });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getDutyStatusBadge = (duty) => {
    if (duty.completed) {
      const labels = { satisfactory: "✅ Satisfactory", unsatisfactory: "⚠️ Unsatisfactory", late: "🕐 Late", absent: "❌ Absent" };
      return <span className="history-badge completed">{labels[duty.review_status] || "✅ Completed"}</span>;
    }
    if (duty.booking_status === "confirmed") return <span className="history-badge confirmed">✅ Confirmed</span>;
    if (duty.booking_status === "reopened") return <span className="history-badge reopened">🔄 Re-opened</span>;
    if (duty.booking_status === "pending_verification") return <span className="history-badge pending">⏳ Pending</span>;
    return <span className="history-badge open">Open</span>;
  };

  const getStaffName = (duty) => {
    if (duty.duty_type === "nurse") {
      return duty.nurses ? `${duty.nurses.first_name} ${duty.nurses.last_name}` : "—";
    }
    return duty.doctors ? `Dr. ${duty.doctors.first_name} ${duty.doctors.last_name}` : "—";
  };

  const completedDuties = dutyHistory.filter(d => d.completed);
  const upcomingDuties = dutyHistory.filter(d => !d.completed && d.booking_status === "confirmed");
  const pendingDuties = dutyHistory.filter(d => !d.completed && d.booking_status !== "confirmed");

  if (loading) return <p style={{ textAlign: "center", padding: 40, color: "#888" }}>Loading...</p>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>My Profile</h1>
        <div className="header-buttons">
          <button onClick={() => navigate(-1)}>← Back</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="profile-card">
        <div className="photo-circle">
          <span>{role === "nurse" ? "👩‍⚕️" : role === "doctor" ? "👨‍⚕️" : "🏥"}</span>
        </div>
        <div className="profile-name">
          <h2>
            {role === "doctor" ? `Dr. ${personal.firstName} ${personal.lastName}` :
             role === "nurse" ? `${personal.firstName} ${personal.lastName}` :
             personal.hospitalName}
          </h2>
          <p>{role === "doctor" || role === "nurse" ? qualification.degree : personal.email}</p>
          {role === "nurse" && <span style={{ background: "#f3e5f5", color: "#6a0dad", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Nurse</span>}
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === "personal" ? "active" : ""} onClick={() => setActiveTab("personal")}>
          Personal Details
        </button>
        {(role === "doctor" || role === "nurse") && (
          <button className={activeTab === "qualification" ? "active" : ""} onClick={() => setActiveTab("qualification")}>
            Qualification
          </button>
        )}
        <button className={activeTab === "password" ? "active" : ""} onClick={() => setActiveTab("password")}>
          Change Password
        </button>
        <button className={activeTab === "history" ? "active" : ""} onClick={() => { setActiveTab("history"); fetchHistory(); }}>
          Duty History
        </button>
      </div>

      {activeTab === "personal" && (
        <form onSubmit={savePersonal} className="profile-form">
          {role === "doctor" || role === "nurse" ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input value={personal.firstName} onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input value={personal.lastName} onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={personal.email} disabled style={{ background: "#f5f5f5" }} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Hospital Name</label>
                <input value={personal.hospitalName} onChange={(e) => setPersonal({ ...personal, hospitalName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={personal.email} disabled style={{ background: "#f5f5f5" }} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contact Person</label>
                <input value={personal.contactPerson} onChange={(e) => setPersonal({ ...personal, contactPerson: e.target.value })} />
              </div>
            </>
          )}
          <button type="submit" className="save-btn">Save Changes</button>
        </form>
      )}

      {activeTab === "qualification" && (role === "doctor" || role === "nurse") && (
        <form onSubmit={saveQualification} className="profile-form">
          <div className="form-group">
            <label>Qualification</label>
            <input value={qualification.degree} onChange={(e) => setQualification({ ...qualification, degree: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Years of Experience</label>
            <input type="number" value={qualification.experience} onChange={(e) => setQualification({ ...qualification, experience: e.target.value })} required />
          </div>
          <button type="submit" className="save-btn">Save Changes</button>
        </form>
      )}

      {activeTab === "password" && (
        <form onSubmit={savePassword} className="profile-form">
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={password.newPass} onChange={(e) => setPassword({ ...password, newPass: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} required />
          </div>
          <button type="submit" className="save-btn">Change Password</button>
        </form>
      )}

      {activeTab === "history" && (
        <div className="history-section">
          {historyLoading ? (
            <p style={{ color: "#888", textAlign: "center", padding: 40 }}>Loading history...</p>
          ) : dutyHistory.length === 0 ? (
            <p style={{ color: "#888", textAlign: "center", padding: 40 }}>No duty history yet.</p>
          ) : (
            <>
              <div className="history-stats">
                <div className="history-stat">
                  <h3>{completedDuties.length}</h3>
                  <p>Completed</p>
                </div>
                <div className="history-stat">
                  <h3>{upcomingDuties.length}</h3>
                  <p>Upcoming</p>
                </div>
                <div className="history-stat">
                  <h3>{pendingDuties.length}</h3>
                  <p>Pending</p>
                </div>
                {(role === "doctor" || role === "nurse") && (
                  <div className="history-stat green">
                    <h3>₹{completedDuties.reduce((sum, d) => sum + (d.doctor_pay || Math.round((d.pay || 0) * 0.8)), 0).toLocaleString()}</h3>
                    <p>Total Earned</p>
                  </div>
                )}
                {role === "hospital" && (
                  <div className="history-stat green">
                    <h3>{dutyHistory.length}</h3>
                    <p>Total Posted</p>
                  </div>
                )}
              </div>

              {upcomingDuties.length > 0 && (
                <>
                  <h3 className="history-section-title">📅 Upcoming Duties</h3>
                  {upcomingDuties.map(duty => (
                    <div key={duty.id} className="history-card upcoming">
                      <div className="history-card-header">
                        <div>
                          <p className="history-card-title">
                            {role === "doctor" || role === "nurse"
                              ? duty.hospitals?.hospital_name
                              : getStaffName(duty)}
                          </p>
                          <p className="history-card-sub">
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.address : duty.qualification}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p className="history-card-pay">₹{(role === "doctor" || role === "nurse" ? (duty.doctor_pay || Math.round(duty.pay * 0.8)) : (duty.gross_pay || duty.pay)).toLocaleString()}</p>
                          {getDutyStatusBadge(duty)}
                        </div>
                      </div>
                      <p className="history-card-date">📅 {duty.date} &nbsp; 🕐 {duty.start_time} - {duty.end_time}</p>
                    </div>
                  ))}
                </>
              )}

              {pendingDuties.length > 0 && (
                <>
                  <h3 className="history-section-title">⏳ Pending Duties</h3>
                  {pendingDuties.map(duty => (
                    <div key={duty.id} className="history-card pending-card">
                      <div className="history-card-header">
                        <div>
                          <p className="history-card-title">
                            {role === "doctor" || role === "nurse"
                              ? duty.hospitals?.hospital_name
                              : getStaffName(duty)}
                          </p>
                          <p className="history-card-sub">
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.address : duty.qualification}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p className="history-card-pay">₹{(role === "doctor" || role === "nurse" ? (duty.doctor_pay || Math.round(duty.pay * 0.8)) : (duty.gross_pay || duty.pay)).toLocaleString()}</p>
                          {getDutyStatusBadge(duty)}
                        </div>
                      </div>
                      <p className="history-card-date">📅 {duty.date} &nbsp; 🕐 {duty.start_time} - {duty.end_time}</p>
                    </div>
                  ))}
                </>
              )}

              {completedDuties.length > 0 && (
                <>
                  <h3 className="history-section-title">✅ Completed Duties</h3>
                  {completedDuties.map(duty => (
                    <div key={duty.id} className="history-card completed-card">
                      <div className="history-card-header">
                        <div>
                          <p className="history-card-title">
                            {role === "doctor" || role === "nurse"
                              ? duty.hospitals?.hospital_name
                              : getStaffName(duty)}
                          </p>
                          <p className="history-card-sub">
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.address : duty.qualification}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p className="history-card-pay">₹{(role === "doctor" || role === "nurse" ? (duty.doctor_pay || Math.round(duty.pay * 0.8)) : (duty.gross_pay || duty.pay)).toLocaleString()}</p>
                          {getDutyStatusBadge(duty)}
                        </div>
                      </div>
                      <p className="history-card-date">📅 {duty.date} &nbsp; 🕐 {duty.start_time} - {duty.end_time}</p>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Profile;
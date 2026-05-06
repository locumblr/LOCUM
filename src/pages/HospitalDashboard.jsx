import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./HospitalDashboard.css";

const qualifications = [
  "MBBS (Bachelor of Medicine and Bachelor of Surgery)",
  "MD - General Medicine",
  "MD - Paediatrics",
  "MD - Psychiatry",
  "MD - Dermatology",
  "MD - Anaesthesiology",
  "MD - Radiology",
  "MD - Pathology",
  "MD - Microbiology",
  "MD - Biochemistry",
  "MD - Community Medicine",
  "MS - General Surgery",
  "MS - Orthopaedics",
  "MS - Ophthalmology",
  "MS - ENT (Otorhinolaryngology)",
  "MS - Obstetrics & Gynaecology",
  "MCh - Neurosurgery",
  "MCh - Cardiothoracic Surgery",
  "MCh - Plastic Surgery",
  "MCh - Urology",
  "DM - Cardiology",
  "DM - Neurology",
  "DM - Nephrology",
  "DM - Gastroenterology",
  "DM - Endocrinology",
  "DM - Oncology",
  "DNB - General Medicine",
  "DNB - General Surgery",
  "DNB - Paediatrics",
  "DNB - Obstetrics & Gynaecology",
  "DNB - Orthopaedics",
  "DNB - Anaesthesiology",
  "BDS / MDS (Dentistry)",
  "B.Pharm / M.Pharm (Pharmacy)",
  "B.Sc Nursing / M.Sc Nursing",
  "Diploma in Anaesthesiology (DA)",
  "Diploma in Child Health (DCH)",
  "Diploma in Obstetrics & Gynaecology (DGO)",
  "Diploma in Orthopaedics (D.Ortho)",
  "Diploma in Ophthalmology (DO)",
  "Diploma in ENT",
  "Diploma in Radiology (DMRD)",
  "Fellowship in Emergency Medicine (FCEM)",
  "Other",
];

const emptyForm = {
  date: "", start_time: "", end_time: "",
  qualification: "", pay: "", notes: "",
};

function HospitalDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hospitalName, setHospitalName] = useState("");

  useEffect(() => {
    fetchHospitalData();
    fetchDuties();
  }, []);

  const fetchHospitalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    const { data } = await supabase.from("hospitals").select("hospital_name").eq("id", user.id).single();
    if (data) setHospitalName(data.hospital_name);
  };

  const fetchDuties = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*")
      .eq("hospital_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("locum_duties").insert({
      hospital_id: user.id,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      qualification: form.qualification,
      pay: parseFloat(form.pay),
      notes: form.notes,
      booked: false,
    });
    if (error) {
      alert("Error posting duty: " + error.message);
    } else {
      alert("Locum duty posted successfully!");
      setForm(emptyForm);
      setShowForm(false);
      fetchDuties();
    }
    setSubmitting(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Hospital Dashboard</h1>
          {hospitalName && <p style={{ color: "#888", fontSize: 14 }}>{hospitalName}</p>}
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/hospital/locums")}>My Locums</button>
          <button onClick={() => navigate("/hospital/profile")}>Profile</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="post-section">
        <button className="post-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Post New Locum Duty"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="duty-form">
          <h2>Post a Locum Duty</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input name="date" type="date" required onChange={handle} value={form.date} />
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input name="start_time" type="time" required onChange={handle} value={form.start_time} />
            </div>
            <div className="form-group">
              <label>End Time</label>
              <input name="end_time" type="time" required onChange={handle} value={form.end_time} />
            </div>
          </div>
          <div className="form-group">
            <label>Required Qualification</label>
            <select name="qualification" required onChange={handle} value={form.qualification} defaultValue="">
              <option value="" disabled>Select Required Qualification</option>
              {qualifications.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Pay (₹)</label>
            <input name="pay" placeholder="e.g. 8000" type="number" required onChange={handle} value={form.pay} />
          </div>
          <div className="form-group">
            <label>Additional Notes (optional)</label>
            <textarea name="notes" placeholder="Any special requirements..." onChange={handle} value={form.notes} rows={3} />
          </div>
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Posting..." : "Post Duty"}
          </button>
        </form>
      )}

      <h2>Posted Duties</h2>

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : duties.length === 0 ? (
        <p className="empty-msg">No duties posted yet. Click "Post New Locum Duty" to get started.</p>
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
              <div className={`status-badge ${duty.booked ? "status-booked" : "status-open"}`}>
                {duty.booked ? "Booked" : "Open"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HospitalDashboard;
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./AdminRecords.css";

function AdminRecords() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    checkAdmin();
    fetchRecords();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/admin/login"); return; }
    const { data } = await supabase.from("admins").select("id").eq("id", user.id).single();
    if (!data) { navigate("/"); return; }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, address, phone, email), doctors(first_name, last_name, phone, email, qualification)")
      .order("date", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const markCompleted = async (id) => {
    const { error } = await supabase.from("locum_duties").update({ completed: true }).eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    fetchRecords();
  };

  const filtered = duties.filter(d => {
    const matchesFilter =
      filter === "all" ? true :
      filter === "completed" ? d.completed :
      filter === "booked" ? d.booked && !d.completed :
      filter === "open" ? !d.booked && !d.completed : true;
    const matchesSearch = search === "" ? true :
      d.hospitals?.hospital_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.doctors?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.doctors?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.qualification?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="records-container">
      <div className="records-header">
        <div>
          <h1>LOCUM Records</h1>
          <p>Complete history of all locum duties</p>
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate("/admin")}>← Admin Panel</button>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </div>
      <div className="records-stats">
        <div className="stat-card"><h3>{duties.length}</h3><p>Total Duties</p></div>
        <div className="stat-card blue"><h3>{duties.filter(d => !d.booked && !d.completed).length}</h3><p>Open</p></div>
        <div className="stat-card orange"><h3>{duties.filter(d => d.booked && !d.completed).length}</h3><p>Booked</p></div>
        <div className="stat-card green"><h3>{duties.filter(d => d.completed).length}</h3><p>Completed</p></div>
      </div>
      <div className="records-toolbar">
        <input className="search-input" placeholder="Search by hospital, doctor or qualification..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="filter-tabs">
          {["all", "open", "booked", "completed"].map(f => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {loading ? <p className="loading">Loading records...</p> : filtered.length === 0 ? <p className="empty">No records found.</p> : (
        <div className="records-table-container">
          <table className="records-table">
            <thead>
              <tr>
                <th>Date</th><th>Hospital</th><th>Qualification</th>
                <th>Time</th><th>Pay</th><th>Doctor</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(duty => (
                <tr key={duty.id}>
                  <td>{duty.date}</td>
                  <td><p className="bold">{duty.hospitals?.hospital_name || "—"}</p><p className="sub">{duty.hospitals?.address || ""}</p></td>
                  <td>{duty.qualification}</td>
                  <td>{duty.start_time} - {duty.end_time}</td>
                  <td>₹{duty.pay}</td>
                  <td>{duty.doctors ? <><p className="bold">Dr. {duty.doctors.first_name} {duty.doctors.last_name}</p><p className="sub">{duty.doctors.phone}</p></> : <p className="sub">Not booked</p>}</td>
                  <td><span className={`status-pill ${duty.completed ? "completed" : duty.booked ? "booked" : "open"}`}>{duty.completed ? "Completed" : duty.booked ? "Booked" : "Open"}</span></td>
                  <td>{duty.booked && !duty.completed && <button className="complete-btn" onClick={() => markCompleted(duty.id)}>Mark Complete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminRecords;

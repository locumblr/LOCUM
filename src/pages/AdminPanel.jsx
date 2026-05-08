import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./AdminPanel.css";

function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("doctors");
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    checkAdmin();
    fetchData();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/admin/login"); return; }
    const { data } = await supabase.from("admins").select("id").eq("id", user.id).single();
    if (!data) { navigate("/"); return; }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: doc } = await supabase.from("doctors").select("*").order("created_at", { ascending: false });
    const { data: hosp } = await supabase.from("hospitals").select("*").order("created_at", { ascending: false });
    setDoctors(doc || []);
    setHospitals(hosp || []);
    setLoading(false);
  };

  const updateStatus = async (table, id, status) => {
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    alert(`Account ${status === "active" ? "activated" : status === "frozen" ? "frozen" : "updated"}!`);
    setSelected(null);
    fetchData();
  };

  const clearFlag = async (id) => {
    await supabase.from("doctors").update({ flagged: false, flag_reason: null, flagged_by: null }).eq("id", id);
    fetchData();
  };

  const deleteAccount = async (table, id) => {
    const confirmed = window.confirm("Are you sure you want to permanently delete this account? This cannot be undone.\n\nActive duties will be deleted. Completed duties will be retained as records.");
    if (!confirmed) return;
    if (table === "hospitals") {
      await supabase.from("locum_duties").delete().eq("hospital_id", id).eq("completed", false);
    }
    if (table === "doctors") {
      await supabase.from("locum_duties").update({ booked: false, booked_by: null, booking_status: "open" }).eq("booked_by", id).eq("completed", false);
    }
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { alert("Error deleting: " + error.message); return; }
    await supabase.rpc("delete_user_account", { user_id: id });
    alert("Account deleted successfully!");
    setSelected(null);
    fetchData();
  };

  const viewDocument = async (documentUrl) => {
    if (!documentUrl) { alert("No document uploaded."); return; }
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(documentUrl, 60);
    if (error) { alert("Error: " + error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const flaggedDoctors = doctors.filter(d => d.flagged);
  const frozenDoctors = doctors.filter(d => d.status === "frozen");
  const frozenHospitals = hospitals.filter(h => h.status === "frozen");

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>LOCUM Admin Panel</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={{ padding: "10px 20px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }} onClick={() => navigate("/admin/records")}>
            Records
          </button>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><h3>{doctors.filter(d => d.status === "active").length}</h3><p>Active Doctors</p></div>
        <div className="stat-card green"><h3>{hospitals.filter(h => h.status === "active").length}</h3><p>Active Hospitals</p></div>
        <div className="stat-card"><h3>{frozenDoctors.length + frozenHospitals.length}</h3><p>Frozen Accounts</p></div>
        <div className="stat-card red"><h3>{flaggedDoctors.length}</h3><p>Flagged Doctors</p></div>
      </div>

      <div className="tabs">
        <button className={activeTab === "doctors" ? "active" : ""} onClick={() => setActiveTab("doctors")}>
          Doctors
        </button>
        <button className={activeTab === "hospitals" ? "active" : ""} onClick={() => setActiveTab("hospitals")}>
          Hospitals
        </button>
        <button className={activeTab === "flagged" ? "active" : ""} onClick={() => setActiveTab("flagged")}>
          Flagged {flaggedDoctors.length > 0 && <span className="badge" style={{ background: "#e74c3c" }}>{flaggedDoctors.length}</span>}
        </button>
      </div>

      {loading ? <p className="loading">Loading...</p> : (
        <div className="table-container">
          {activeTab === "doctors" && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th>
                  <th>Qualification</th><th>Experience</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.length === 0 ? (
                  <tr><td colSpan="7" className="empty">No doctors registered yet</td></tr>
                ) : doctors.map(doc => (
                  <tr key={doc.id}>
                    <td>{doc.first_name} {doc.last_name} {doc.flagged && <span style={{ color: "#e74c3c", fontSize: 11 }}>⚑ Flagged</span>}</td>
                    <td>{doc.email}</td>
                    <td>{doc.phone}</td>
                    <td>{doc.qualification}</td>
                    <td>{doc.experience} yrs</td>
                    <td><span className={`status-pill ${doc.status}`}>{doc.status}</span></td>
                    <td>
                      <button className="view-btn" onClick={() => setSelected({ ...doc, type: "doctor" })}>View</button>
                      {doc.status === "active" && <button className="freeze-btn" onClick={() => updateStatus("doctors", doc.id, "frozen")}>Freeze</button>}
                      {doc.status === "frozen" && <button className="unfreeze-btn" onClick={() => updateStatus("doctors", doc.id, "active")}>Unfreeze</button>}
                      <button className="delete-btn" onClick={() => deleteAccount("doctors", doc.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "hospitals" && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hospital</th><th>Email</th><th>Phone</th>
                  <th>Contact Person</th><th>Reg. No.</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.length === 0 ? (
                  <tr><td colSpan="7" className="empty">No hospitals registered yet</td></tr>
                ) : hospitals.map(hosp => (
                  <tr key={hosp.id}>
                    <td>{hosp.hospital_name}</td>
                    <td>{hosp.email}</td>
                    <td>{hosp.phone}</td>
                    <td>{hosp.contact_person}</td>
                    <td>{hosp.registration_number}</td>
                    <td><span className={`status-pill ${hosp.status}`}>{hosp.status}</span></td>
                    <td>
                      <button className="view-btn" onClick={() => setSelected({ ...hosp, type: "hospital" })}>View</button>
                      {hosp.status === "active" && <button className="freeze-btn" onClick={() => updateStatus("hospitals", hosp.id, "frozen")}>Freeze</button>}
                      {hosp.status === "frozen" && <button className="unfreeze-btn" onClick={() => updateStatus("hospitals", hosp.id, "active")}>Unfreeze</button>}
                      <button className="delete-btn" onClick={() => deleteAccount("hospitals", hosp.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "flagged" && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th>
                  <th>Qualification</th><th>Flagged By</th>
                  <th>Reason</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedDoctors.length === 0 ? (
                  <tr><td colSpan="7" className="empty">No flagged doctors</td></tr>
                ) : flaggedDoctors.map(doc => (
                  <tr key={doc.id} style={{ background: "#fff8f8" }}>
                    <td>{doc.first_name} {doc.last_name}</td>
                    <td>{doc.email}</td>
                    <td>{doc.phone}</td>
                    <td>{doc.qualification}</td>
                    <td>{doc.flagged_by || "—"}</td>
                    <td>{doc.flag_reason || "—"}</td>
                    <td>
                      <button className="view-btn" onClick={() => setSelected({ ...doc, type: "doctor" })}>View</button>
                      <button className="approve-btn" onClick={() => clearFlag(doc.id)}>Clear Flag</button>
                      <button className="freeze-btn" onClick={() => updateStatus("doctors", doc.id, "frozen")}>Freeze</button>
                      <button className="delete-btn" onClick={() => deleteAccount("doctors", doc.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Account Details</h2>
            <div className="detail-grid">
              {selected.type === "doctor" ? <>
                <div><label>Name</label><p>Dr. {selected.first_name} {selected.last_name}</p></div>
                <div><label>Email</label><p>{selected.email}</p></div>
                <div><label>Phone</label><p>{selected.phone}</p></div>
                <div><label>Qualification</label><p>{selected.qualification}</p></div>
                <div><label>Experience</label><p>{selected.experience} years</p></div>
                <div><label>Status</label><p>{selected.status}</p></div>
                {selected.flagged && <>
                  <div><label>Flagged By</label><p>{selected.flagged_by}</p></div>
                  <div><label>Flag Reason</label><p>{selected.flag_reason}</p></div>
                </>}
              </> : <>
                <div><label>Hospital</label><p>{selected.hospital_name}</p></div>
                <div><label>Email</label><p>{selected.email}</p></div>
                <div><label>Phone</label><p>{selected.phone}</p></div>
                <div><label>Address</label><p>{selected.address}</p></div>
                <div><label>Reg. No.</label><p>{selected.registration_number}</p></div>
                <div><label>Contact Person</label><p>{selected.contact_person}</p></div>
                <div><label>Status</label><p>{selected.status}</p></div>
              </>}
              <div><label>Registered On</label><p>{new Date(selected.created_at).toLocaleDateString()}</p></div>
              {selected.document_url && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Document</label>
                  <button onClick={() => viewDocument(selected.document_url)} style={{ padding: "8px 16px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 6 }}>
                    📄 View Document
                  </button>
                </div>
              )}
            </div>
            {selected.status === "active" && (
              <div className="modal-actions">
                <button className="freeze-btn" onClick={() => updateStatus(selected.type === "doctor" ? "doctors" : "hospitals", selected.id, "frozen")}>Freeze Account</button>
                <button className="delete-btn" onClick={() => deleteAccount(selected.type === "doctor" ? "doctors" : "hospitals", selected.id)}>Delete Account</button>
              </div>
            )}
            {selected.status === "frozen" && (
              <div className="modal-actions">
                <button className="unfreeze-btn" onClick={() => updateStatus(selected.type === "doctor" ? "doctors" : "hospitals", selected.id, "active")}>Unfreeze Account</button>
                <button className="delete-btn" onClick={() => deleteAccount(selected.type === "doctor" ? "doctors" : "hospitals", selected.id)}>Delete Account</button>
              </div>
            )}
            {selected.flagged && (
              <div className="modal-actions">
                <button className="approve-btn" onClick={() => clearFlag(selected.id)}>Clear Flag</button>
              </div>
            )}
            <button className="close-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
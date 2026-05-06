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

    const record = table === "doctors"
      ? doctors.find(d => d.id === id)
      : hospitals.find(h => h.id === id);

    const name = table === "doctors"
      ? `Dr. ${record.first_name} ${record.last_name}`
      : record.hospital_name;

    if (status === "active") {
      await supabase.functions.invoke("send-email", {
        body: {
          to: record.email,
          subject: "Your LOCUM Account Has Been Approved!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
              <h1 style="color: #1e3a5f;">LOCUM</h1>
              <h2>Congratulations, ${name}!</h2>
              <p>Your account has been verified and approved by our admin team.</p>
              <p>You can now log in to the LOCUM platform and ${table === "doctors" ? "start browsing available locum duties." : "start posting locum duties."}</p>
              <a href="http://localhost:5173/login" style="display: inline-block; padding: 14px 28px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Login Now</a>
              <p style="margin-top: 30px; color: #888; font-size: 13px;">If you have any questions, please contact our support team.</p>
            </div>
          `,
        },
      });
    }

    alert(`Account ${status === "active" ? "approved" : status === "frozen" ? "frozen" : status === "rejected" ? "rejected" : "updated"}!`);
    setSelected(null);
    fetchData();
  };

 const deleteAccount = async (table, id) => {
    const confirmed = window.confirm("Are you sure you want to permanently delete this account? This cannot be undone.\n\nActive duties will be deleted. Completed duties will be retained as records.");
    if (!confirmed) return;

    // If deleting a hospital, delete only their active (incomplete) duties
    if (table === "hospitals") {
      await supabase
        .from("locum_duties")
        .delete()
        .eq("hospital_id", id)
        .eq("completed", false);
    }

    // If deleting a doctor, unbook their active bookings
    if (table === "doctors") {
      await supabase
        .from("locum_duties")
        .update({ booked: false, booked_by: null })
        .eq("booked_by", id)
        .eq("completed", false);
    }

    // Delete from doctors/hospitals table
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { alert("Error deleting: " + error.message); return; }

    // Also delete from auth
    await supabase.rpc("delete_user_account", { user_id: id });

    alert("Account deleted successfully!");
    setSelected(null);
    fetchData();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const pendingDoctors = doctors.filter(d => d.status === "pending");
  const pendingHospitals = hospitals.filter(h => h.status === "pending");

  return (
    <div className="admin-container">
      <div className="admin-header">
  <h1>LOCUM Admin Panel</h1>
  <div style={{ display: "flex", gap: 12 }}>
    <button
      style={{ padding: "10px 20px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
      onClick={() => navigate("/admin/records")}
    >
      Records
    </button>
    <button className="logout-btn" onClick={logout}>Logout</button>
  </div>
</div>

      <div className="stats-row">
        <div className="stat-card"><h3>{pendingDoctors.length}</h3><p>Pending Doctors</p></div>
        <div className="stat-card"><h3>{pendingHospitals.length}</h3><p>Pending Hospitals</p></div>
        <div className="stat-card green"><h3>{doctors.filter(d => d.status === "active").length}</h3><p>Active Doctors</p></div>
        <div className="stat-card green"><h3>{hospitals.filter(h => h.status === "active").length}</h3><p>Active Hospitals</p></div>
      </div>

      <div className="tabs">
        <button className={activeTab === "doctors" ? "active" : ""} onClick={() => setActiveTab("doctors")}>
          Doctors {pendingDoctors.length > 0 && <span className="badge">{pendingDoctors.length}</span>}
        </button>
        <button className={activeTab === "hospitals" ? "active" : ""} onClick={() => setActiveTab("hospitals")}>
          Hospitals {pendingHospitals.length > 0 && <span className="badge">{pendingHospitals.length}</span>}
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
                    <td>{doc.first_name} {doc.last_name}</td>
                    <td>{doc.email}</td>
                    <td>{doc.phone}</td>
                    <td>{doc.qualification}</td>
                    <td>{doc.experience} yrs</td>
                    <td><span className={`status-pill ${doc.status}`}>{doc.status}</span></td>
                    <td>
                      <button className="view-btn" onClick={() => setSelected({ ...doc, type: "doctor" })}>View</button>
                      {doc.status === "pending" && <>
                        <button className="approve-btn" onClick={() => updateStatus("doctors", doc.id, "active")}>Approve</button>
                        <button className="reject-btn" onClick={() => updateStatus("doctors", doc.id, "rejected")}>Reject</button>
                      </>}
                      {doc.status === "active" && (
                        <button className="freeze-btn" onClick={() => updateStatus("doctors", doc.id, "frozen")}>Freeze</button>
                      )}
                      {doc.status === "frozen" && (
                        <button className="unfreeze-btn" onClick={() => updateStatus("doctors", doc.id, "active")}>Unfreeze</button>
                      )}
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
                      {hosp.status === "pending" && <>
                        <button className="approve-btn" onClick={() => updateStatus("hospitals", hosp.id, "active")}>Approve</button>
                        <button className="reject-btn" onClick={() => updateStatus("hospitals", hosp.id, "rejected")}>Reject</button>
                      </>}
                      {hosp.status === "active" && (
                        <button className="freeze-btn" onClick={() => updateStatus("hospitals", hosp.id, "frozen")}>Freeze</button>
                      )}
                      {hosp.status === "frozen" && (
                        <button className="unfreeze-btn" onClick={() => updateStatus("hospitals", hosp.id, "active")}>Unfreeze</button>
                      )}
                      <button className="delete-btn" onClick={() => deleteAccount("hospitals", hosp.id)}>Delete</button>
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
            <h2>Application Details</h2>
            <div className="detail-grid">
              {selected.type === "doctor" ? <>
                <div><label>Name</label><p>{selected.first_name} {selected.last_name}</p></div>
                <div><label>Email</label><p>{selected.email}</p></div>
                <div><label>Phone</label><p>{selected.phone}</p></div>
                <div><label>ID Number</label><p>{selected.id_number}</p></div>
                <div><label>Qualification</label><p>{selected.qualification}</p></div>
                <div><label>Experience</label><p>{selected.experience} years</p></div>
              </> : <>
                <div><label>Hospital</label><p>{selected.hospital_name}</p></div>
                <div><label>Email</label><p>{selected.email}</p></div>
                <div><label>Phone</label><p>{selected.phone}</p></div>
                <div><label>Address</label><p>{selected.address}</p></div>
                <div><label>Reg. No.</label><p>{selected.registration_number}</p></div>
                <div><label>Contact Person</label><p>{selected.contact_person}</p></div>
              </>}
              <div><label>Status</label><p>{selected.status}</p></div>
              <div><label>Applied On</label><p>{new Date(selected.created_at).toLocaleDateString()}</p></div>
            </div>
            {selected.status === "pending" && (
              <div className="modal-actions">
                <button className="approve-btn" onClick={() => updateStatus(selected.type === "doctor" ? "doctors" : "hospitals", selected.id, "active")}>Approve</button>
                <button className="reject-btn" onClick={() => updateStatus(selected.type === "doctor" ? "doctors" : "hospitals", selected.id, "rejected")}>Reject</button>
              </div>
            )}
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
            <button className="close-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
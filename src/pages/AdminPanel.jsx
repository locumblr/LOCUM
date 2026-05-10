import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./AdminPanel.css";

function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("doctors");
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [billing, setBilling] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);

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
    const { data: nur } = await supabase.from("nurses").select("*").order("created_at", { ascending: false });
    setDoctors(doc || []);
    setHospitals(hosp || []);
    setNurses(nur || []);
    setLoading(false);
  };

  const fetchBilling = async () => {
    setBillingLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, email, phone), doctors(first_name, last_name)")
      .eq("booked", true)
      .order("date", { ascending: false });
    if (!error) setBilling(data || []);
    setBillingLoading(false);
  };

  const markAsPaid = async (dutyId) => {
    const { error } = await supabase
      .from("locum_duties")
      .update({ payment_status: "paid", payment_cleared_at: new Date().toISOString() })
      .eq("id", dutyId);
    if (error) { alert("Error: " + error.message); return; }
    fetchBilling();
  };

  const updateStatus = async (table, id, status) => {
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    if (table === "hospitals" && status === "active") {
      const hospital = hospitals.find(h => h.id === id);
      if (hospital) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: hospital.email,
            subject: "Your LOCUM Hospital Account Has Been Approved!",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;"><h1 style="color: #1e3a5f;">LOCUM</h1><h2>Congratulations, ${hospital.hospital_name}!</h2><p>Your hospital account has been verified and approved by our admin team.</p><p>You can now log in to the LOCUM platform and start posting locum duties.</p><a href="https://project-1qlxe.vercel.app/login" style="display: inline-block; padding: 14px 28px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Login Now</a><p style="margin-top: 30px; color: #888; font-size: 13px;">If you have any questions, please contact us at locum.blr@gmail.com</p></div>`,
          },
        });
      }
    }
    alert(`Account ${status === "active" ? "approved" : status === "frozen" ? "frozen" : status === "rejected" ? "rejected" : "updated"}!`);
    setSelected(null);
    fetchData();
  };

  const clearFlag = async (id, table = "doctors") => {
    await supabase.from(table).update({ flagged: false, flag_reason: null, flagged_by: null }).eq("id", id);
    fetchData();
  };

  const deleteAccount = async (table, id) => {
    const confirmed = window.confirm("Are you sure you want to permanently delete this account? This cannot be undone.");
    if (!confirmed) return;
    if (table === "hospitals") {
      await supabase.from("locum_duties").delete().eq("hospital_id", id).eq("completed", false);
    }
    if (table === "doctors" || table === "nurses") {
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
  const flaggedNurses = nurses.filter(n => n.flagged);
  const frozenHospitals = hospitals.filter(h => h.status === "frozen");
  const pendingHospitals = hospitals.filter(h => h.status === "pending");

  const totalOwed = billing.filter(d => d.payment_status !== "paid").reduce((sum, d) => sum + (d.platform_fee || 0), 0);
  const totalPaid = billing.filter(d => d.payment_status === "paid").reduce((sum, d) => sum + (d.platform_fee || 0), 0);

  const billingByHospital = billing.reduce((acc, duty) => {
    if (duty.payment_status === "paid") return acc;
    const hospitalName = duty.hospitals?.hospital_name || "Unknown";
    if (!acc[hospitalName]) {
      acc[hospitalName] = { hospital: duty.hospitals, duties: [], total: 0 };
    }
    acc[hospitalName].duties.push(duty);
    acc[hospitalName].total += duty.platform_fee || 0;
    return acc;
  }, {});

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
        <div className="stat-card" style={{ borderTop: "3px solid #6a0dad" }}><h3 style={{ color: "#6a0dad" }}>{nurses.filter(n => n.status === "active").length}</h3><p>Active Nurses</p></div>
        <div className="stat-card green"><h3>{hospitals.filter(h => h.status === "active").length}</h3><p>Active Hospitals</p></div>
        <div className="stat-card orange"><h3>{pendingHospitals.length}</h3><p>Pending Hospitals</p></div>
        <div className="stat-card red"><h3>{flaggedDoctors.length + flaggedNurses.length}</h3><p>Flagged</p></div>
      </div>

      <div className="tabs">
        <button className={activeTab === "doctors" ? "active" : ""} onClick={() => setActiveTab("doctors")}>Doctors</button>
        <button className={activeTab === "nurses" ? "active" : ""} onClick={() => setActiveTab("nurses")}>Nurses</button>
        <button className={activeTab === "hospitals" ? "active" : ""} onClick={() => setActiveTab("hospitals")}>
          Hospitals {pendingHospitals.length > 0 && <span className="badge">{pendingHospitals.length}</span>}
        </button>
        <button className={activeTab === "flagged" ? "active" : ""} onClick={() => setActiveTab("flagged")}>
          Flagged {(flaggedDoctors.length + flaggedNurses.length) > 0 && <span className="badge" style={{ background: "#e74c3c" }}>{flaggedDoctors.length + flaggedNurses.length}</span>}
        </button>
        <button className={activeTab === "billing" ? "active" : ""} onClick={() => { setActiveTab("billing"); fetchBilling(); }}>
          💰 Billing
        </button>
      </div>

      {loading && activeTab !== "billing" ? <p className="loading">Loading...</p> : (
        <div className="table-container">

          {activeTab === "doctors" && (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Qualification</th><th>Experience</th><th>Status</th><th>Actions</th></tr>
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

          {activeTab === "nurses" && (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Qualification</th><th>Experience</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {nurses.length === 0 ? (
                  <tr><td colSpan="7" className="empty">No nurses registered yet</td></tr>
                ) : nurses.map(nur => (
                  <tr key={nur.id}>
                    <td>{nur.first_name} {nur.last_name} {nur.flagged && <span style={{ color: "#e74c3c", fontSize: 11 }}>⚑ Flagged</span>}</td>
                    <td>{nur.email}</td>
                    <td>{nur.phone}</td>
                    <td>{nur.qualification}</td>
                    <td>{nur.experience} yrs</td>
                    <td><span className={`status-pill ${nur.status}`}>{nur.status}</span></td>
                    <td>
                      <button className="view-btn" onClick={() => setSelected({ ...nur, type: "nurse" })}>View</button>
                      {nur.status === "active" && <button className="freeze-btn" onClick={() => updateStatus("nurses", nur.id, "frozen")}>Freeze</button>}
                      {nur.status === "frozen" && <button className="unfreeze-btn" onClick={() => updateStatus("nurses", nur.id, "active")}>Unfreeze</button>}
                      <button className="delete-btn" onClick={() => deleteAccount("nurses", nur.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "hospitals" && (
            <table className="admin-table">
              <thead>
                <tr><th>Hospital</th><th>Email</th><th>Phone</th><th>Contact Person</th><th>Reg. No.</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {hospitals.length === 0 ? (
                  <tr><td colSpan="7" className="empty">No hospitals registered yet</td></tr>
                ) : hospitals.map(hosp => (
                  <tr key={hosp.id} style={{ background: hosp.status === "pending" ? "#fffbf0" : "white" }}>
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
            <>
              {flaggedDoctors.length > 0 && (
                <>
                  <h3 style={{ color: "#1e3a5f", margin: "0 0 12px" }}>Flagged Doctors</h3>
                  <table className="admin-table" style={{ marginBottom: 24 }}>
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Phone</th><th>Qualification</th><th>Flagged By</th><th>Reason</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {flaggedDoctors.map(doc => (
                        <tr key={doc.id} style={{ background: "#fff8f8" }}>
                          <td>{doc.first_name} {doc.last_name}</td>
                          <td>{doc.email}</td>
                          <td>{doc.phone}</td>
                          <td>{doc.qualification}</td>
                          <td>{doc.flagged_by || "—"}</td>
                          <td>{doc.flag_reason || "—"}</td>
                          <td>
                            <button className="view-btn" onClick={() => setSelected({ ...doc, type: "doctor" })}>View</button>
                            <button className="approve-btn" onClick={() => clearFlag(doc.id, "doctors")}>Clear Flag</button>
                            <button className="freeze-btn" onClick={() => updateStatus("doctors", doc.id, "frozen")}>Freeze</button>
                            <button className="delete-btn" onClick={() => deleteAccount("doctors", doc.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {flaggedNurses.length > 0 && (
                <>
                  <h3 style={{ color: "#6a0dad", margin: "0 0 12px" }}>Flagged Nurses</h3>
                  <table className="admin-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Phone</th><th>Qualification</th><th>Flagged By</th><th>Reason</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {flaggedNurses.map(nur => (
                        <tr key={nur.id} style={{ background: "#fff8f8" }}>
                          <td>{nur.first_name} {nur.last_name}</td>
                          <td>{nur.email}</td>
                          <td>{nur.phone}</td>
                          <td>{nur.qualification}</td>
                          <td>{nur.flagged_by || "—"}</td>
                          <td>{nur.flag_reason || "—"}</td>
                          <td>
                            <button className="view-btn" onClick={() => setSelected({ ...nur, type: "nurse" })}>View</button>
                            <button className="approve-btn" onClick={() => clearFlag(nur.id, "nurses")}>Clear Flag</button>
                            <button className="freeze-btn" onClick={() => updateStatus("nurses", nur.id, "frozen")}>Freeze</button>
                            <button className="delete-btn" onClick={() => deleteAccount("nurses", nur.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {flaggedDoctors.length === 0 && flaggedNurses.length === 0 && (
                <p className="empty">No flagged accounts</p>
              )}
            </>
          )}

          {activeTab === "billing" && (
            <div className="billing-section">
              <div className="billing-stats">
                <div className="billing-stat unpaid">
                  <h3>₹{totalOwed.toLocaleString()}</h3>
                  <p>Total Outstanding</p>
                </div>
                <div className="billing-stat paid">
                  <h3>₹{totalPaid.toLocaleString()}</h3>
                  <p>Total Collected</p>
                </div>
                <div className="billing-stat total">
                  <h3>{billing.filter(d => d.payment_status !== "paid").length}</h3>
                  <p>Unpaid Duties</p>
                </div>
              </div>

              {billingLoading ? <p className="loading">Loading billing data...</p> : (
                <>
                  <h3 style={{ color: "#1e3a5f", marginBottom: 16 }}>Outstanding Dues by Hospital</h3>
                  {Object.keys(billingByHospital).length === 0 ? (
                    <p className="empty">No outstanding dues!</p>
                  ) : (
                    Object.entries(billingByHospital).map(([hospitalName, data]) => (
                      <div key={hospitalName} className="hospital-billing-card">
                        <div className="hospital-billing-header">
                          <div>
                            <h4>{hospitalName}</h4>
                            <p>📞 {data.hospital?.phone} | ✉️ {data.hospital?.email}</p>
                          </div>
                          <div className="hospital-billing-total">
                            <span>Total Owed</span>
                            <strong>₹{data.total.toLocaleString()}</strong>
                          </div>
                        </div>
                        <table className="billing-table">
                          <thead>
                            <tr>
                              <th>Date</th><th>Type</th><th>Doctor/Nurse</th>
                              <th>Gross Pay</th><th>Doctor Pay (80%)</th>
                              <th>Our Fee (20%)</th><th>Status</th><th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.duties.map(duty => (
                              <tr key={duty.id}>
                                <td>{duty.date}</td>
                                <td><span style={{ background: duty.duty_type === "nurse" ? "#f3e5f5" : "#e3f2fd", color: duty.duty_type === "nurse" ? "#6a0dad" : "#1565c0", padding: "2px 8px", borderRadius: 20, fontSize: 12 }}>{duty.duty_type === "nurse" ? "Nurse" : "Doctor"}</span></td>
                                <td>{duty.doctors ? `Dr. ${duty.doctors.first_name} ${duty.doctors.last_name}` : "—"}</td>
                                <td>₹{(duty.gross_pay || duty.pay || 0).toLocaleString()}</td>
                                <td>₹{(duty.doctor_pay || 0).toLocaleString()}</td>
                                <td>₹{(duty.platform_fee || 0).toLocaleString()}</td>
                                <td>
                                  <span className={`payment-pill ${duty.payment_status === "paid" ? "paid" : "unpaid"}`}>
                                    {duty.payment_status === "paid" ? "✅ Paid" : "⏳ Unpaid"}
                                  </span>
                                </td>
                                <td>
                                  {duty.payment_status !== "paid" && (
                                    <button className="mark-paid-btn" onClick={() => markAsPaid(duty.id)}>Mark Paid</button>
                                  )}
                                  {duty.payment_status === "paid" && (
                                    <span style={{ fontSize: 12, color: "#888" }}>
                                      {duty.payment_cleared_at ? new Date(duty.payment_cleared_at).toLocaleDateString() : "Cleared"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}

                  {billing.filter(d => d.payment_status === "paid").length > 0 && (
                    <>
                      <h3 style={{ color: "#27ae60", marginBottom: 16, marginTop: 32 }}>✅ Cleared Dues</h3>
                      <table className="admin-table">
                        <thead>
                          <tr><th>Date</th><th>Hospital</th><th>Doctor/Nurse</th><th>Gross Pay</th><th>Our Fee</th><th>Cleared On</th></tr>
                        </thead>
                        <tbody>
                          {billing.filter(d => d.payment_status === "paid").map(duty => (
                            <tr key={duty.id}>
                              <td>{duty.date}</td>
                              <td>{duty.hospitals?.hospital_name}</td>
                              <td>{duty.doctors ? `Dr. ${duty.doctors.first_name} ${duty.doctors.last_name}` : "—"}</td>
                              <td>₹{(duty.gross_pay || duty.pay || 0).toLocaleString()}</td>
                              <td>₹{(duty.platform_fee || 0).toLocaleString()}</td>
                              <td>{duty.payment_cleared_at ? new Date(duty.payment_cleared_at).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Account Details</h2>
            <div className="detail-grid">
              {selected.type === "doctor" || selected.type === "nurse" ? <>
                <div><label>Name</label><p>{selected.type === "nurse" ? "" : "Dr."} {selected.first_name} {selected.last_name}</p></div>
                <div><label>Email</label><p>{selected.email}</p></div>
                <div><label>Phone</label><p>{selected.phone}</p></div>
                <div><label>Qualification</label><p>{selected.qualification}</p></div>
                <div><label>Experience</label><p>{selected.experience} years</p></div>
                <div><label>Status</label><p>{selected.status}</p></div>
                <div><label>Type</label><p style={{ textTransform: "capitalize" }}>{selected.type}</p></div>
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
            {selected.status === "pending" && selected.type === "hospital" && (
              <div className="modal-actions">
                <button className="approve-btn" onClick={() => updateStatus("hospitals", selected.id, "active")}>Approve</button>
                <button className="reject-btn" onClick={() => updateStatus("hospitals", selected.id, "rejected")}>Reject</button>
                <button className="delete-btn" onClick={() => deleteAccount("hospitals", selected.id)}>Delete</button>
              </div>
            )}
            {selected.status === "active" && (
              <div className="modal-actions">
                <button className="freeze-btn" onClick={() => updateStatus(selected.type === "doctor" ? "doctors" : selected.type === "nurse" ? "nurses" : "hospitals", selected.id, "frozen")}>Freeze Account</button>
                <button className="delete-btn" onClick={() => deleteAccount(selected.type === "doctor" ? "doctors" : selected.type === "nurse" ? "nurses" : "hospitals", selected.id)}>Delete Account</button>
              </div>
            )}
            {selected.status === "frozen" && (
              <div className="modal-actions">
                <button className="unfreeze-btn" onClick={() => updateStatus(selected.type === "doctor" ? "doctors" : selected.type === "nurse" ? "nurses" : "hospitals", selected.id, "active")}>Unfreeze Account</button>
                <button className="delete-btn" onClick={() => deleteAccount(selected.type === "doctor" ? "doctors" : selected.type === "nurse" ? "nurses" : "hospitals", selected.id)}>Delete Account</button>
              </div>
            )}
            {selected.flagged && (
              <div className="modal-actions">
                <button className="approve-btn" onClick={() => clearFlag(selected.id, selected.type === "nurse" ? "nurses" : "doctors")}>Clear Flag</button>
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
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  const [invoices, setInvoices] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

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
    const { data } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, email, phone), doctors(first_name, last_name), nurses(first_name, last_name)")
      .eq("booked", true)
      .order("date", { ascending: false });
    setBilling(data || []);
    const { data: inv } = await supabase
      .from("monthly_invoices")
      .select("*, hospitals(hospital_name, email, phone)")
      .order("created_at", { ascending: false });
    setInvoices(inv || []);
    setBillingLoading(false);
  };

  const getMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  const generateMonthlyInvoices = async () => {
    const confirmed = window.confirm("Generate invoices for all hospitals for the previous month? Hospitals will be notified automatically.");
    if (!confirmed) return;
    setGeneratingInvoice(true);
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const billingMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const dueDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const { data: freshDuties } = await supabase
      .from("locum_duties")
      .select("*, hospitals(hospital_name, email, phone)")
      .eq("completed", true)
      .neq("payment_status", "paid");
    if (!freshDuties || freshDuties.length === 0) {
      alert("No completed unpaid duties found to invoice.");
      setGeneratingInvoice(false);
      return;
    }
    const byHospital = freshDuties.reduce((acc, duty) => {
      const hid = duty.hospital_id;
      if (!hid) return acc;
      if (!acc[hid]) {
        acc[hid] = { hospital_id: hid, hospital: duty.hospitals, duties: [], total_gross: 0, total_platform_fee: 0 };
      }
      acc[hid].duties.push(duty);
      acc[hid].total_gross += duty.gross_pay || duty.pay || 0;
      acc[hid].total_platform_fee += duty.platform_fee || 0;
      return acc;
    }, {});
    let count = 0;
    for (const hid of Object.keys(byHospital)) {
      const h = byHospital[hid];
      if (h.duties.length === 0 || h.total_platform_fee === 0) continue;
      const { data: existing } = await supabase
        .from("monthly_invoices")
        .select("id")
        .eq("hospital_id", hid)
        .eq("billing_month", billingMonth)
        .single();
      if (!existing) {
        await supabase.from("monthly_invoices").insert({
          hospital_id: hid,
          billing_month: billingMonth,
          total_duties: h.duties.length,
          total_gross: h.total_gross,
          total_platform_fee: h.total_platform_fee,
          fine_amount: 0,
          total_due: h.total_platform_fee,
          status: "unpaid",
          due_date: dueDateStr,
          payment_requested: false,
          admin_verified: false,
          weeks_overdue: 0,
        });
        await supabase.from("notifications").insert({
          user_id: hid,
          title: `📋 Invoice for ${getMonthLabel(billingMonth)}`,
          message: `Your invoice for ${getMonthLabel(billingMonth)} has been generated. Total due: Rs.${h.total_platform_fee.toLocaleString()}. Payment due by ${dueDateStr}. Late payments attract a Rs.500/week fine and account suspension.`,
        });
        count++;
      }
    }
    alert(`${count} invoice(s) generated and hospitals notified!`);
    fetchBilling();
    setGeneratingInvoice(false);
  };

  const generateInvoicePDF = async (invoice) => {
    const { data: duties } = await supabase
      .from("locum_duties")
      .select("*")
      .eq("hospital_id", invoice.hospital_id)
      .eq("completed", true);
    const { data: doctorDetails } = await supabase
      .from("doctors")
      .select("id, first_name, last_name");
    const { data: nurseDetails } = await supabase
      .from("nurses")
      .select("id, first_name, last_name");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("LOCUM", 20, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Healthcare Technologies, Bangalore, India", 20, 32);
    doc.text("locum.blr@gmail.com", pageWidth - 20, 32, { align: "right" });

    doc.setTextColor(30, 58, 95);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", pageWidth - 20, 55, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const invoiceNumber = `INV-${invoice.billing_month}-${invoice.hospital_id?.slice(0, 6).toUpperCase()}`;
    doc.text(`Invoice No: ${invoiceNumber}`, pageWidth - 20, 63, { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, pageWidth - 20, 70, { align: "right" });
    doc.text(`Due Date: ${invoice.due_date}`, pageWidth - 20, 77, { align: "right" });

    doc.setTextColor(30, 58, 95);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 55);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.text(invoice.hospitals?.hospital_name || "Hospital", 20, 63);
    doc.text(invoice.hospitals?.email || "", 20, 70);
    doc.text(invoice.hospitals?.phone || "", 20, 77);

    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.line(20, 85, pageWidth - 20, 85);

    doc.setTextColor(30, 58, 95);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Billing Period: ${getMonthLabel(invoice.billing_month)}`, 20, 95);

    const dutyRows = (duties || []).map(duty => {
      let staffName = "—";
      if (duty.booked_by) {
        const doctor = (doctorDetails || []).find(d => d.id === duty.booked_by);
        const nurse = (nurseDetails || []).find(n => n.id === duty.booked_by);
        if (doctor) staffName = `Dr. ${doctor.first_name} ${doctor.last_name}`;
        else if (nurse) staffName = `${nurse.first_name} ${nurse.last_name}`;
      }
      return [
        duty.date || "—",
        `${duty.start_time || ""} - ${duty.end_time || ""}`,
        duty.qualification || "—",
        staffName,
        `Rs.${(duty.gross_pay || duty.pay || 0).toLocaleString("en-IN")}`,
        `Rs.${(duty.platform_fee || 0).toLocaleString("en-IN")}`,
      ];
    });

    autoTable(doc, {
      startY: 102,
      head: [["Date", "Time", "Qualification", "Staff", "Gross Pay", "Platform Fee"]],
      body: dutyRows,
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50], font: "helvetica" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 25 },
        2: { cellWidth: 55 },
        3: { cellWidth: 40 },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 25, halign: "right" },
      },
      margin: { left: 20, right: 20 },
      styles: { font: "helvetica", overflow: "linebreak" },
    });

    const summaryY = doc.lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: summaryY,
      body: [
        ["Total Gross Duty Value", `Rs.${(invoice.total_gross || 0).toLocaleString("en-IN")}`],
        ["Platform Fee (20%)", `Rs.${(invoice.total_platform_fee || 0).toLocaleString("en-IN")}`],
        ...(invoice.fine_amount > 0 ? [["Late Payment Fine", `Rs.${invoice.fine_amount.toLocaleString("en-IN")}`]] : []),
        ["TOTAL DUE", `Rs.${(invoice.total_due || 0).toLocaleString("en-IN")}`],
      ],
      bodyStyles: { fontSize: 10, font: "helvetica" },
      columnStyles: {
        0: { cellWidth: 140, textColor: [80, 80, 80] },
        1: { cellWidth: 30, halign: "right" },
      },
      didParseCell: (data) => {
        const lastRow = invoice.fine_amount > 0 ? 3 : 2;
        if (data.row.index === lastRow) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [30, 58, 95];
          data.cell.styles.fontSize = 11;
          data.cell.styles.fillColor = [240, 244, 248];
        }
      },
      margin: { left: 20, right: 20 },
      styles: { font: "helvetica" },
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFillColor(240, 244, 248);
    doc.rect(20, finalY, pageWidth - 40, 28, "F");
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Terms", 28, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Payment due by ${invoice.due_date}. Late payments attract a fine of Rs.500 per week.`, 28, finalY + 18);
    doc.text("Accounts frozen for non-payment beyond 14 days.", 28, finalY + 25);

    doc.setTextColor(30, 58, 95);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Details", 20, finalY + 44);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Please contact locum.blr@gmail.com for bank transfer details.", 20, finalY + 52);

    if (invoice.status === "paid") {
      doc.setTextColor(46, 125, 50);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("PAID", pageWidth - 20, finalY + 52, { align: "right" });
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(20, doc.internal.pageSize.getHeight() - 20, pageWidth - 20, doc.internal.pageSize.getHeight() - 20);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("LOCUM Healthcare Technologies | Bangalore, India | locum.blr@gmail.com", pageWidth / 2, doc.internal.pageSize.getHeight() - 12, { align: "center" });

    doc.save(`LOCUM-Invoice-${invoiceNumber}.pdf`);
  };

  const verifyPayment = async (invoiceId, hospitalId) => {
    const confirmed = window.confirm("Verify this payment and mark invoice as paid?");
    if (!confirmed) return;
    await supabase.from("monthly_invoices").update({
      status: "paid",
      admin_verified: true,
      paid_at: new Date().toISOString(),
    }).eq("id", invoiceId);
    const hospital = hospitals.find(h => h.id === hospitalId);
    if (hospital?.status === "frozen") {
      await supabase.from("hospitals").update({ status: "active" }).eq("id", hospitalId);
    }
    await supabase.from("locum_duties")
      .update({ payment_status: "paid", payment_cleared_at: new Date().toISOString() })
      .eq("hospital_id", hospitalId)
      .eq("completed", true)
      .eq("payment_status", "unpaid");
    await supabase.from("notifications").insert({
      user_id: hospitalId,
      title: "✅ Payment Verified — Account Cleared",
      message: "Your payment has been verified by LOCUM admin. Your account is now active and all dues have been cleared. Thank you!",
    });
    alert("Payment verified! Hospital account cleared.");
    fetchData();
    fetchBilling();
  };

  const addWeeklyFine = async (invoiceId, currentFine, hospitalId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    const newFine = (currentFine || 0) + 500;
    const newTotal = invoice.total_platform_fee + newFine;
    await supabase.from("monthly_invoices").update({
      fine_amount: newFine,
      total_due: newTotal,
      weeks_overdue: (invoice.weeks_overdue || 0) + 1,
    }).eq("id", invoiceId);
    await supabase.from("notifications").insert({
      user_id: hospitalId,
      title: "⚠️ Late Payment Fine Added",
      message: `A late payment fine of Rs.500 has been added. New total due: Rs.${newTotal.toLocaleString()}. Please clear dues immediately.`,
    });
    fetchBilling();
  };

  const freezeForNonPayment = async (hospitalId) => {
    const confirmed = window.confirm("Freeze this hospital's account for non-payment?");
    if (!confirmed) return;
    await supabase.from("hospitals").update({ status: "frozen" }).eq("id", hospitalId);
    await supabase.from("notifications").insert({
      user_id: hospitalId,
      title: "🔴 Account Frozen — Payment Overdue",
      message: "Your account has been frozen due to outstanding payment. Please make payment and mark as PAID on your dashboard. Admin will verify and unfreeze your account.",
    });
    alert("Hospital account frozen!");
    fetchData();
    fetchBilling();
  };

  const updateStatus = async (table, id, status) => {
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    if (table === "hospitals" && status === "active") {
      const hospital = hospitals.find(h => h.id === id);
      if (hospital) {
        // Auto-create default departments
        await supabase.rpc("create_default_departments", {
          hosp_id: hospital.id,
          hosp_name: hospital.hospital_name,
        });
        // Send approval email
        await supabase.functions.invoke("send-email", {
          body: {
            to: hospital.email,
            subject: "Your LOCUM Hospital Account Has Been Approved!",
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;"><h1 style="color: #1e3a5f;">LOCUM</h1><h2>Congratulations, ${hospital.hospital_name}!</h2><p>Your hospital account has been verified and approved.</p><p>Your department accounts have been automatically created. Log in to view your department codes and set fixed pay rates.</p><a href="https://bookmylocum.com/login" style="display: inline-block; padding: 14px 28px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">Login Now</a></div>`,
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
    const confirmed = window.confirm("Are you sure you want to permanently delete this account?");
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
  const pendingHospitals = hospitals.filter(h => h.status === "pending");
  const unpaidInvoices = invoices.filter(i => i.status !== "paid");
  const overdueInvoices = unpaidInvoices.filter(i => new Date(i.due_date) < new Date());
  const paymentRequestedInvoices = unpaidInvoices.filter(i => i.payment_requested && !i.admin_verified);

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
        <div className="stat-card red"><h3>{overdueInvoices.length}</h3><p>Overdue Invoices</p></div>
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
          {paymentRequestedInvoices.length > 0 && <span className="badge" style={{ background: "#27ae60" }}>{paymentRequestedInvoices.length}</span>}
          {overdueInvoices.length > 0 && <span className="badge" style={{ background: "#e74c3c", marginLeft: 4 }}>{overdueInvoices.length}</span>}
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
                  <h3>Rs.{unpaidInvoices.reduce((sum, i) => sum + (i.total_due || 0), 0).toLocaleString()}</h3>
                  <p>Total Outstanding</p>
                </div>
                <div className="billing-stat paid">
                  <h3>Rs.{invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.total_platform_fee || 0), 0).toLocaleString()}</h3>
                  <p>Total Collected</p>
                </div>
                <div className="billing-stat total">
                  <h3>{unpaidInvoices.length}</h3>
                  <p>Unpaid Invoices</p>
                </div>
                <div className="billing-stat" style={{ borderTop: "3px solid #27ae60" }}>
                  <h3 style={{ color: "#27ae60" }}>{paymentRequestedInvoices.length}</h3>
                  <p>Awaiting Verification</p>
                </div>
              </div>

              <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <button
                  onClick={generateMonthlyInvoices}
                  disabled={generatingInvoice || billingLoading}
                  style={{ padding: "12px 24px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600 }}
                >
                  {generatingInvoice ? "Generating..." : "📋 Generate Monthly Invoices"}
                </button>
                <p style={{ color: "#888", fontSize: 13 }}>
                  Generates invoices for previous month. Payment due by 15th. Fines and freezes applied automatically.
                </p>
              </div>

              {billingLoading ? <p className="loading">Loading billing data...</p> : (
                <>
                  {paymentRequestedInvoices.length > 0 && (
                    <>
                      <h3 style={{ color: "#27ae60", marginBottom: 16 }}>💰 Payments Awaiting Verification</h3>
                      {paymentRequestedInvoices.map(invoice => (
                        <div key={invoice.id} className="hospital-billing-card" style={{ borderLeft: "4px solid #27ae60", background: "#f9fff9" }}>
                          <div className="hospital-billing-header">
                            <div>
                              <h4>{invoice.hospitals?.hospital_name}</h4>
                              <p>📞 {invoice.hospitals?.phone} | ✉️ {invoice.hospitals?.email}</p>
                              <p style={{ fontSize: 13, color: "#888" }}>{getMonthLabel(invoice.billing_month)} | Due: {invoice.due_date}</p>
                              <p style={{ fontSize: 13, color: "#27ae60", fontWeight: 600 }}>✅ Hospital has marked as PAID</p>
                            </div>
                            <div className="hospital-billing-total">
                              <span>Total Due</span>
                              <strong>Rs.{(invoice.total_due || 0).toLocaleString()}</strong>
                              {invoice.fine_amount > 0 && <p style={{ color: "#e74c3c", fontSize: 13 }}>incl. Rs.{invoice.fine_amount} fine</p>}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                            <button onClick={() => verifyPayment(invoice.id, invoice.hospital_id)} style={{ padding: "10px 20px", background: "#27ae60", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                              ✅ Verify Payment
                            </button>
                            <button onClick={() => generateInvoicePDF(invoice)} style={{ padding: "10px 20px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                              📄 Download PDF
                            </button>
                          </div>
                          <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>{invoice.total_duties} duties | Gross: Rs.{(invoice.total_gross || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {unpaidInvoices.filter(i => !i.payment_requested).length > 0 && (
                    <>
                      <h3 style={{ color: "#1e3a5f", marginBottom: 16, marginTop: 24 }}>📋 Outstanding Invoices</h3>
                      {unpaidInvoices.filter(i => !i.payment_requested).map(invoice => {
                        const isOverdue = new Date(invoice.due_date) < new Date();
                        return (
                          <div key={invoice.id} className="hospital-billing-card" style={{ borderLeft: isOverdue ? "4px solid #e74c3c" : "4px solid #f39c12" }}>
                            <div className="hospital-billing-header">
                              <div>
                                <h4>{invoice.hospitals?.hospital_name}</h4>
                                <p>📞 {invoice.hospitals?.phone} | ✉️ {invoice.hospitals?.email}</p>
                                <p style={{ fontSize: 13, color: "#888" }}>
                                  {getMonthLabel(invoice.billing_month)} | Due: {invoice.due_date}
                                  {isOverdue && <span style={{ color: "#e74c3c", fontWeight: 600 }}> ⚠️ OVERDUE ({invoice.weeks_overdue || 0} weeks)</span>}
                                </p>
                              </div>
                              <div className="hospital-billing-total">
                                <span>Total Due</span>
                                <strong>Rs.{(invoice.total_due || 0).toLocaleString()}</strong>
                                {invoice.fine_amount > 0 && <p style={{ color: "#e74c3c", fontSize: 13 }}>incl. Rs.{invoice.fine_amount} fine</p>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                              <button onClick={() => generateInvoicePDF(invoice)} style={{ padding: "8px 16px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                                📄 Download PDF
                              </button>
                              {isOverdue && (
                                <>
                                  <button onClick={() => addWeeklyFine(invoice.id, invoice.fine_amount || 0, invoice.hospital_id)} style={{ padding: "8px 16px", background: "#fff3e0", color: "#e65100", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                                    ➕ Add Rs.500 Fine
                                  </button>
                                  <button onClick={() => freezeForNonPayment(invoice.hospital_id)} style={{ padding: "8px 16px", background: "#fce4ec", color: "#c62828", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                                    🔴 Freeze Account
                                  </button>
                                </>
                              )}
                            </div>
                            <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>{invoice.total_duties} duties | Gross: Rs.{(invoice.total_gross || 0).toLocaleString()}</p>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {invoices.filter(i => i.status === "paid").length > 0 && (
                    <>
                      <h3 style={{ color: "#27ae60", marginBottom: 16, marginTop: 32 }}>✅ Paid & Verified Invoices</h3>
                      <table className="admin-table">
                        <thead>
                          <tr><th>Hospital</th><th>Month</th><th>Duties</th><th>Platform Fee</th><th>Fine</th><th>Total Paid</th><th>Paid On</th><th>PDF</th></tr>
                        </thead>
                        <tbody>
                          {invoices.filter(i => i.status === "paid").map(invoice => (
                            <tr key={invoice.id}>
                              <td>{invoice.hospitals?.hospital_name}</td>
                              <td>{getMonthLabel(invoice.billing_month)}</td>
                              <td>{invoice.total_duties}</td>
                              <td>Rs.{(invoice.total_platform_fee || 0).toLocaleString()}</td>
                              <td>{invoice.fine_amount > 0 ? `Rs.${invoice.fine_amount}` : "—"}</td>
                              <td>Rs.{(invoice.total_due || 0).toLocaleString()}</td>
                              <td>{invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : "—"}</td>
                              <td>
                                <button onClick={() => generateInvoicePDF(invoice)} style={{ padding: "4px 10px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                                  📄 PDF
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {invoices.length === 0 && (
                    <p className="empty">No invoices generated yet. Click "Generate Monthly Invoices" to create invoices for the previous month.</p>
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
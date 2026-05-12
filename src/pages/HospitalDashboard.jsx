import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./HospitalDashboard.css";

const allQualifications = [
  "MBBS (Bachelor of Medicine and Bachelor of Surgery)",
  "MD - General Medicine",
  "MD - Paediatrics",
  "MD - Psychiatry",
  "MD - Dermatology",
  "MD - Anaesthesiology",
  "MD - Radiology",
  "MD - Radiology with PCPNDT Certification",
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
  "Diploma in Radiology (DMRD) with PCPNDT Certification",
  "PCPNDT Certified Sonologist",
  "Fellowship in Emergency Medicine (FCEM)",
  "Other",
];

const nursingQualifications = [
  "GNM (General Nursing & Midwifery)",
  "B.Sc Nursing",
  "Post Basic B.Sc Nursing",
  "M.Sc Nursing",
  "Critical Care Nursing",
  "Operation Theatre Nursing",
  "Emergency & Trauma Nursing",
  "Paediatric Nursing",
  "Oncology Nursing",
  "Dialysis Nursing",
  "ICU Nursing",
  "NICU Nursing",
  "PICU Nursing",
  "Midwifery",
  "Community Health Nursing",
  "Psychiatric Nursing",
  "Other",
];

const emptyForm = {
  date: "", start_time: "", end_time: "",
  qualifications: [], pay: "", notes: "",
};

const isRadiology = (qualifications) =>
  qualifications.some(q =>
    q.toLowerCase().includes("radio") ||
    q.toLowerCase().includes("pcpndt") ||
    q.toLowerCase().includes("sonolog")
  );

function HospitalDashboard() {
  const navigate = useNavigate();
  const [duties, setDuties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalId, setHospitalId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showQualDropdown, setShowQualDropdown] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [paidInvoices, setPaidInvoices] = useState([]);

  useEffect(() => {
    fetchHospitalData();
  }, []);

  const fetchHospitalData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setHospitalId(user.id);
    const { data } = await supabase.from("hospitals").select("hospital_name").eq("id", user.id).single();
    if (data) setHospitalName(data.hospital_name);
    fetchDuties(user.id);
    fetchNotifications(user.id);
    fetchPendingInvoice(user.id);
    fetchPaidInvoices(user.id);
  };

  const fetchDuties = async (uid) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("locum_duties")
      .select("*")
      .eq("hospital_id", uid)
      .eq("completed", false)
      .order("created_at", { ascending: false });
    if (!error) setDuties(data || []);
    setLoading(false);
  };

  const fetchNotifications = async (uid) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setNotifications(data || []);
    setUnreadCount((data || []).filter(n => !n.read).length);
  };

  const fetchPendingInvoice = async (uid) => {
    const { data } = await supabase
      .from("monthly_invoices")
      .select("*")
      .eq("hospital_id", uid)
      .neq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      setPendingInvoice(data);
      const dueDate = new Date(data.due_date);
      const today = new Date();
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 2) setShowPaymentReminder(true);
    }
  };

  const fetchPaidInvoices = async (uid) => {
    const { data } = await supabase
      .from("monthly_invoices")
      .select("*")
      .eq("hospital_id", uid)
      .eq("status", "paid")
      .order("paid_at", { ascending: false });
    setPaidInvoices(data || []);
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", hospitalId);
    fetchNotifications(hospitalId);
  };

  const markAsPaid = async () => {
    if (!pendingInvoice) return;
    setMarkingPaid(true);
    await supabase.from("monthly_invoices").update({
      payment_requested: true,
      payment_requested_at: new Date().toISOString(),
      status: "payment_requested",
    }).eq("id", pendingInvoice.id);

    const { data: admins } = await supabase.from("admins").select("id");
    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        user_id: admin.id,
        title: "💰 Payment Received — Verification Required",
        message: `${hospitalName} has marked their invoice as paid. Total: ₹${pendingInvoice.total_due?.toLocaleString()}. Please verify and mark as cleared.`,
      });
    }

    alert("Payment marked! Admin has been notified and will verify shortly.");
    fetchPendingInvoice(hospitalId);
    setShowPaymentReminder(false);
    setMarkingPaid(false);
  };

 const generateInvoicePDF = async (invoice) => {
    // Fetch individual duties
    const { data: duties } = await supabase
      .from("locum_duties")
      .select("*, doctors(first_name, last_name), nurses(first_name, last_name)")
      .eq("hospital_id", invoice.hospital_id)
      .eq("completed", true)
      .neq("payment_status", "paid");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
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

    // Invoice title
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", pageWidth - 20, 55, { align: "right" });

    // Invoice details
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const invoiceNumber = `INV-${invoice.billing_month}-${invoice.hospital_id?.slice(0, 6).toUpperCase()}`;
    doc.text(`Invoice No: ${invoiceNumber}`, pageWidth - 20, 63, { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, pageWidth - 20, 70, { align: "right" });
    doc.text(`Due Date: ${invoice.due_date}`, pageWidth - 20, 77, { align: "right" });

    // Bill To
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 55);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.text(hospitalName, 20, 63);

    // Divider
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.line(20, 85, pageWidth - 20, 85);

    // Billing period
    const [year, month] = invoice.billing_month.split("-");
    const monthLabel = new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Billing Period: ${monthLabel}`, 20, 95);

    // Individual duties table
    const dutyRows = (duties || []).map(duty => {
      const staffName = duty.duty_type === "nurse"
        ? `${duty.nurses?.first_name || ""} ${duty.nurses?.last_name || ""}`
        : `Dr. ${duty.doctors?.first_name || ""} ${duty.doctors?.last_name || ""}`;
      return [
        duty.date,
        `${duty.start_time} - ${duty.end_time}`,
        duty.qualification || "—",
        staffName.trim() || "—",
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

    // Summary table
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
        0: { cellWidth: 140, fontStyle: "normal", textColor: [80, 80, 80] },
        1: { cellWidth: 30, halign: "right" },
      },
      didParseCell: (data) => {
        if (data.row.index === (invoice.fine_amount > 0 ? 3 : 2)) {
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

    // Payment terms
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

    // Payment details
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Details", 20, finalY + 44);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Please contact locum.blr@gmail.com for bank transfer details.", 20, finalY + 52);

    // Paid stamp
    if (invoice.status === "paid") {
      doc.setTextColor(46, 125, 50);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("PAID", pageWidth - 20, finalY + 52, { align: "right" });
    }

    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(20, doc.internal.pageSize.getHeight() - 20, pageWidth - 20, doc.internal.pageSize.getHeight() - 20);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("LOCUM Healthcare Technologies | Bangalore, India | locum.blr@gmail.com", pageWidth / 2, doc.internal.pageSize.getHeight() - 12, { align: "center" });

    doc.save(`LOCUM-Invoice-${invoiceNumber}.pdf`);
  }; 
  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleQualification = (q) => {
    const current = form.qualifications;
    if (current.includes(q)) {
      setForm({ ...form, qualifications: current.filter(x => x !== q) });
    } else {
      setForm({ ...form, qualifications: [...current, q] });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.qualifications.length === 0) { alert("Please select at least one qualification."); return; }
    setSubmitting(true);
    const grossPay = parseFloat(form.pay);
    const doctorPay = Math.round(grossPay * 0.8);
    const platformFee = Math.round(grossPay * 0.2);
    const { error } = await supabase.from("locum_duties").insert({
      hospital_id: hospitalId,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      qualification: form.qualifications[0],
      qualifications: form.qualifications,
      pay: grossPay,
      gross_pay: grossPay,
      doctor_pay: doctorPay,
      platform_fee: platformFee,
      notes: form.notes,
      booked: false,
      completed: false,
      booking_status: "open",
      payment_status: "unpaid",
      duty_type: showForm,
    });
    if (error) {
      alert("Error posting duty: " + error.message);
    } else {
      for (const q of form.qualifications) {
        await supabase.functions.invoke("send-push", {
          body: {
            qualification: q,
            title: "New Locum Duty Available!",
            body: `A new duty is available on ${form.date}. ₹${doctorPay.toLocaleString()}`,
            url: showForm === "nurse" ? "/nurse/dashboard" : "/doctor/dashboard",
          },
        });
      }
      alert("Locum duty posted successfully!");
      setForm(emptyForm);
      setShowForm(null);
      setShowQualDropdown(false);
      fetchDuties(hospitalId);
    }
    setSubmitting(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getStatusLabel = (duty) => {
    if (duty.booking_status === "confirmed") return <span className="status-badge status-confirmed">✅ Confirmed</span>;
    if (duty.booking_status === "reopened") return <span className="status-badge status-reopened">🔄 Re-opened</span>;
    if (duty.booking_status === "pending_verification") return <span className="status-badge status-pending">⏳ Pending Verification</span>;
    return <span className="status-badge status-open">Open</span>;
  };

  const getMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  return (
    <div className="dashboard-container">

      {showPaymentReminder && pendingInvoice && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
          background: pendingInvoice.weeks_overdue > 0 ? "#c62828" : "#e65100",
          color: "white", padding: "16px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
                {pendingInvoice.weeks_overdue > 0 ? "🔴 Account at risk — Payment Overdue!" : "⚠️ Payment Due Soon"}
              </p>
              <p style={{ fontSize: 13, margin: "4px 0 0", opacity: 0.9 }}>
                Invoice for {getMonthLabel(pendingInvoice.billing_month)} — ₹{pendingInvoice.total_due?.toLocaleString()} due by {pendingInvoice.due_date}
                {pendingInvoice.fine_amount > 0 && ` (includes ₹${pendingInvoice.fine_amount} fine)`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!pendingInvoice.payment_requested ? (
                <button onClick={markAsPaid} disabled={markingPaid} style={{ padding: "10px 20px", background: "white", color: "#1e3a5f", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  {markingPaid ? "Processing..." : "✅ Mark as PAID"}
                </button>
              ) : (
                <span style={{ background: "rgba(255,255,255,0.2)", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                  ⏳ Payment Verification Pending
                </span>
              )}
              <button onClick={() => setShowPaymentReminder(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.5)", color: "white", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-header" style={{ marginTop: showPaymentReminder ? 80 : 0 }}>
        <div>
          <h1>Hospital Dashboard</h1>
          {hospitalName && <p style={{ color: "#888", fontSize: 14 }}>{hospitalName}</p>}
        </div>
        <div className="header-buttons">
          <button className="notif-btn" onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
            🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button onClick={() => navigate("/hospital/locums")}>My Locums</button>
          <button onClick={() => navigate("/hospital/profile")}>Profile</button>
          <button onClick={() => navigate("/help")}>Help</button>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </div>

      {showNotifications && (
        <div className="notifications-panel">
          <h3>🔔 Notifications</h3>
          {notifications.length === 0 ? (
            <p className="no-notif">No notifications yet</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
                <p className="notif-title">{n.title}</p>
                <p className="notif-message">{n.message}</p>
                <p className="notif-time">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {pendingInvoice && (
        <div style={{
          background: pendingInvoice.weeks_overdue > 0 ? "#fce4ec" : "#fff8e1",
          border: `1px solid ${pendingInvoice.weeks_overdue > 0 ? "#e74c3c" : "#ff9800"}`,
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ color: pendingInvoice.weeks_overdue > 0 ? "#c62828" : "#e65100", marginBottom: 6 }}>
                {pendingInvoice.weeks_overdue > 0 ? "🔴 Overdue Invoice" : "📋 Invoice Pending"}
              </h3>
              <p style={{ color: "#555", fontSize: 14 }}>{getMonthLabel(pendingInvoice.billing_month)} — {pendingInvoice.total_duties} duties</p>
              <p style={{ color: "#555", fontSize: 14 }}>Due by: {pendingInvoice.due_date}</p>
              {pendingInvoice.fine_amount > 0 && (
                <p style={{ color: "#e74c3c", fontSize: 14, fontWeight: 600 }}>⚠️ Includes ₹{pendingInvoice.fine_amount} late fine</p>
              )}
              {pendingInvoice.payment_requested && (
                <p style={{ color: "#27ae60", fontSize: 14, fontWeight: 600 }}>⏳ Payment submitted — awaiting admin verification</p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#1e3a5f" }}>₹{pendingInvoice.total_due?.toLocaleString()}</p>
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!pendingInvoice.payment_requested && (
                  <button onClick={markAsPaid} disabled={markingPaid} style={{ padding: "10px 24px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                    {markingPaid ? "Processing..." : "✅ Mark as PAID"}
                  </button>
                )}
                <button onClick={() => generateInvoicePDF(pendingInvoice)} style={{ padding: "10px 24px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                  📄 Download Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paidInvoices.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <h3 style={{ color: "#1e3a5f", marginBottom: 16 }}>✅ Payment History</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f7fa" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#555" }}>Month</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#555" }}>Duties</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#555" }}>Amount Paid</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#555" }}>Paid On</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#555" }}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {paidInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 12px", fontSize: 14 }}>{getMonthLabel(inv.billing_month)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 14 }}>{inv.total_duties}</td>
                  <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600, color: "#2e7d32" }}>₹{(inv.total_due || 0).toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", fontSize: 14 }}>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button onClick={() => generateInvoicePDF(inv)} style={{ padding: "4px 12px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      📄 PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="post-section">
        <button className="post-btn" onClick={() => { setShowForm(showForm === "doctor" ? null : "doctor"); setForm(emptyForm); }}>
          {showForm === "doctor" ? "Cancel" : "+ Post Doctor Locum"}
        </button>
        <button className="post-btn nurse-btn" onClick={() => { setShowForm(showForm === "nurse" ? null : "nurse"); setForm(emptyForm); }}>
          {showForm === "nurse" ? "Cancel" : "+ Post Nurse Locum"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="duty-form" style={{ overflow: "hidden" }}>
          <h2>Post a {showForm === "nurse" ? "Nurse" : "Doctor"} Locum Duty</h2>
          {showForm === "nurse" && (
            <div style={{ background: "#f3e5f5", border: "1px solid #6a0dad", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#4a0080" }}>
              💜 You are posting a <strong>Nurse Locum</strong> duty
            </div>
          )}
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
            <label>Required Qualifications {form.qualifications.length > 0 && <span style={{ color: "#27ae60", fontSize: 13 }}>({form.qualifications.length} selected)</span>}</label>
            {isRadiology(form.qualifications) && (
              <div style={{ background: "#fff8e1", border: "1px solid #ffcc02", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#795500", marginBottom: 8, lineHeight: 1.5 }}>
                ⚠️ <strong>PCPNDT Notice:</strong> Radiologists performing USG/Ultrasound procedures must hold a valid <strong>PCPNDT registration</strong>. Please select <strong>"with PCPNDT Certification"</strong> if this duty involves ultrasound examinations.
              </div>
            )}
            <div className="qual-dropdown-container">
              <div className="qual-dropdown-trigger" onClick={() => setShowQualDropdown(!showQualDropdown)}>
                {form.qualifications.length === 0 ? "Select qualifications..." :
                  form.qualifications.length === 1 ? form.qualifications[0] :
                  `${form.qualifications.length} qualifications selected`}
                <span style={{ float: "right" }}>{showQualDropdown ? "▲" : "▼"}</span>
              </div>
              {showQualDropdown && (
                <div className="qual-dropdown-list">
                  {(showForm === "nurse" ? nursingQualifications : allQualifications).map((q) => (
                    <label key={q} className={`qual-option ${form.qualifications.includes(q) ? "selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={form.qualifications.includes(q)}
                        onChange={() => toggleQualification(q)}
                      />
                      <span>{q}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {form.qualifications.length > 0 && (
              <div className="selected-quals">
                {form.qualifications.map(q => (
                  <span key={q} className="qual-tag">
                    {q}<button type="button" onClick={() => toggleQualification(q)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Total Pay (₹)</label>
            <input name="pay" placeholder="e.g. 10000" type="number" required onChange={handle} value={form.pay} />
            {form.pay && parseFloat(form.pay) > 0 && (
              <div className="pay-split">
                <div className="split-item doctor">
                  <span>👨‍⚕️ {showForm === "nurse" ? "Nurse" : "Doctor"} receives</span>
                  <span>₹{Math.round(parseFloat(form.pay) * 0.8).toLocaleString()}</span>
                </div>
                <div className="split-item platform">
                  <span>🏢 Platform fee (20%)</span>
                  <span>₹{Math.round(parseFloat(form.pay) * 0.2).toLocaleString()}</span>
                </div>
              </div>
            )}
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
        <p className="empty-msg">No duties posted yet.</p>
      ) : (
        <div className="duties-grid">
          {duties.map((duty) => (
            <div key={duty.id} className={`duty-card ${duty.booking_status === "confirmed" ? "booked" : duty.booking_status === "reopened" ? "reopened-card" : duty.booked ? "booked" : ""}`}>
              <div className="duty-header">
                <h3>{duty.qualifications && duty.qualifications.length > 1 ? `${duty.qualifications.length} Qualifications` : duty.qualification}</h3>
                <span className="pay">₹{duty.gross_pay || duty.pay}</span>
              </div>
              <div className="duty-details">
                <p>📅 {duty.date}</p>
                <p>🕐 {duty.start_time} - {duty.end_time}</p>
                {duty.duty_type === "nurse" && (
                  <span style={{ background: "#f3e5f5", color: "#6a0dad", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Nurse Duty</span>
                )}
                {duty.qualifications && duty.qualifications.length > 1 && (
                  <div style={{ marginTop: 6 }}>
                    {duty.qualifications.map(q => (
                      <span key={q} style={{ display: "inline-block", background: "#e3f2fd", color: "#1565c0", borderRadius: 20, padding: "2px 10px", fontSize: 12, marginRight: 4, marginBottom: 4 }}>{q}</span>
                    ))}
                  </div>
                )}
                {duty.notes && <p>📝 {duty.notes}</p>}
              </div>
              {getStatusLabel(duty)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HospitalDashboard;
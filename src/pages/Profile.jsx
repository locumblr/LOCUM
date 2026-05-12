import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal");
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dutyHistory, setDutyHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [paidInvoices, setPaidInvoices] = useState([]);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [hospitalName, setHospitalName] = useState("");
  const [userId, setUserId] = useState(null);

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
    setUserId(user.id);
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
        setHospitalName(data.hospital_name || "");
        setPersonal({
          hospitalName: data.hospital_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          registrationNumber: data.registration_number || "",
          contactPerson: data.contact_person || "",
        });
      }
      fetchInvoices(user.id);
    }
    setLoading(false);
  };

  const fetchInvoices = async (uid) => {
    try {
      const { data: pending } = await supabase
        .from("monthly_invoices")
        .select("*")
        .eq("hospital_id", uid)
        .neq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setPendingInvoice(pending || null);
    } catch (e) {
      setPendingInvoice(null);
    }

    const { data: paid } = await supabase
      .from("monthly_invoices")
      .select("*")
      .eq("hospital_id", uid)
      .eq("status", "paid")
      .order("paid_at", { ascending: false });
    setPaidInvoices(paid || []);
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
        message: `${hospitalName} has marked their invoice as paid. Total: Rs.${pendingInvoice.total_due?.toLocaleString()}. Please verify and mark as cleared.`,
      });
    }
    alert("Payment marked! Admin has been notified and will verify shortly.");
    fetchInvoices(userId);
    setMarkingPaid(false);
  };

  const getMonthLabel = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  const generateInvoicePDF = async (invoice) => {
    const { data: duties } = await supabase
      .from("locum_duties")
      .select("*")
      .eq("hospital_id", invoice.hospital_id)
      .eq("completed", true);
    const { data: doctorDetails } = await supabase.from("doctors").select("id, first_name, last_name");
    const { data: nurseDetails } = await supabase.from("nurses").select("id, first_name, last_name");

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
    doc.text(hospitalName || personal.hospitalName, 20, 63);

    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.5);
    doc.line(20, 85, pageWidth - 20, 85);

    const [year, month] = invoice.billing_month.split("-");
    const monthLabel = new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Billing Period: ${monthLabel}`, 20, 95);

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
        0: { cellWidth: 22 }, 1: { cellWidth: 25 }, 2: { cellWidth: 55 },
        3: { cellWidth: 40 }, 4: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 25, halign: "right" },
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
          {pendingInvoice && role === "hospital" && (
            <span style={{ background: pendingInvoice.weeks_overdue > 0 ? "#fce4ec" : "#fff3e0", color: pendingInvoice.weeks_overdue > 0 ? "#c62828" : "#e65100", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
              {pendingInvoice.weeks_overdue > 0 ? "🔴 Payment Overdue" : "⚠️ Payment Pending"}
            </span>
          )}
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
        {role === "hospital" && (
          <button className={activeTab === "payments" ? "active" : ""} onClick={() => setActiveTab("payments")}
            style={pendingInvoice ? { position: "relative" } : {}}>
            💳 Payments
            {pendingInvoice && !pendingInvoice.payment_requested && (
              <span style={{ background: "#e74c3c", color: "white", borderRadius: "50%", width: 8, height: 8, display: "inline-block", marginLeft: 6 }} />
            )}
          </button>
        )}
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

      {activeTab === "payments" && role === "hospital" && (
        <div className="history-section">
          {pendingInvoice ? (
            <div style={{
              background: pendingInvoice.weeks_overdue > 0 ? "#fce4ec" : "#fff8e1",
              border: `2px solid ${pendingInvoice.weeks_overdue > 0 ? "#e74c3c" : "#ff9800"}`,
              borderRadius: 12, padding: 24, marginBottom: 24,
            }}>
              <h3 style={{ color: pendingInvoice.weeks_overdue > 0 ? "#c62828" : "#e65100", marginBottom: 8 }}>
                {pendingInvoice.weeks_overdue > 0 ? "🔴 Overdue Invoice" : "📋 Invoice Due"}
              </h3>
              <p style={{ color: "#555", fontSize: 15, marginBottom: 4 }}>
                <strong>Billing Period:</strong> {getMonthLabel(pendingInvoice.billing_month)}
              </p>
              <p style={{ color: "#555", fontSize: 15, marginBottom: 4 }}>
                <strong>Duties:</strong> {pendingInvoice.total_duties}
              </p>
              <p style={{ color: "#555", fontSize: 15, marginBottom: 4 }}>
                <strong>Due Date:</strong> {pendingInvoice.due_date}
              </p>
              {pendingInvoice.fine_amount > 0 && (
                <p style={{ color: "#e74c3c", fontSize: 15, marginBottom: 4 }}>
                  <strong>Late Fine:</strong> Rs.{pendingInvoice.fine_amount.toLocaleString()}
                </p>
              )}
              <p style={{ fontSize: 28, fontWeight: 700, color: "#1e3a5f", margin: "16px 0" }}>
                Total Due: Rs.{pendingInvoice.total_due?.toLocaleString()}
              </p>

              {pendingInvoice.payment_requested ? (
                <div style={{ background: "#e8f5e9", padding: 14, borderRadius: 8, marginBottom: 12 }}>
                  <p style={{ color: "#2e7d32", fontWeight: 600, margin: 0 }}>⏳ Payment submitted — awaiting admin verification</p>
                  <p style={{ color: "#555", fontSize: 13, margin: "4px 0 0" }}>Our team will verify your payment shortly.</p>
                </div>
              ) : (
                <div style={{ background: "#f5f7fa", padding: 14, borderRadius: 8, marginBottom: 16 }}>
                  <p style={{ color: "#555", fontSize: 14, margin: "0 0 8px" }}>
                    Please transfer Rs.{pendingInvoice.total_due?.toLocaleString()} to our bank account and click <strong>Mark as PAID</strong> below.
                  </p>
                  <p style={{ color: "#888", fontSize: 13, margin: 0 }}>Contact locum.blr@gmail.com for bank transfer details.</p>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {!pendingInvoice.payment_requested && (
                  <button
                    onClick={markAsPaid}
                    disabled={markingPaid}
                    style={{ padding: "12px 24px", background: "#1e3a5f", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 15 }}
                  >
                    {markingPaid ? "Processing..." : "✅ Mark as PAID"}
                  </button>
                )}
                <button
                  onClick={() => generateInvoicePDF(pendingInvoice)}
                  style={{ padding: "12px 24px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 15 }}
                >
                  📄 Download Invoice
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: "#e8f5e9", borderRadius: 12, padding: 24, marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "#2e7d32", fontSize: 16, fontWeight: 600 }}>✅ No outstanding invoices!</p>
              <p style={{ color: "#555", fontSize: 14, marginTop: 4 }}>All payments are up to date.</p>
            </div>
          )}

          {paidInvoices.length > 0 && (
            <>
              <h3 style={{ color: "#1e3a5f", marginBottom: 16 }}>✅ Payment History</h3>
              {paidInvoices.map(inv => (
                <div key={inv.id} style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12, borderLeft: "4px solid #27ae60" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <p style={{ fontWeight: 600, color: "#1e3a5f", fontSize: 15, margin: 0 }}>{getMonthLabel(inv.billing_month)}</p>
                      <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>{inv.total_duties} duties | Paid on {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <p style={{ fontWeight: 700, color: "#2e7d32", fontSize: 18, margin: 0 }}>Rs.{(inv.total_due || 0).toLocaleString()}</p>
                      <button
                        onClick={() => generateInvoicePDF(inv)}
                        style={{ padding: "6px 14px", background: "#e3f2fd", color: "#1565c0", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                      >
                        📄 PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
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
                <div className="history-stat"><h3>{completedDuties.length}</h3><p>Completed</p></div>
                <div className="history-stat"><h3>{upcomingDuties.length}</h3><p>Upcoming</p></div>
                <div className="history-stat"><h3>{pendingDuties.length}</h3><p>Pending</p></div>
                {(role === "doctor" || role === "nurse") && (
                  <div className="history-stat green">
                    <h3>Rs.{completedDuties.reduce((sum, d) => sum + (d.doctor_pay || Math.round((d.pay || 0) * 0.8)), 0).toLocaleString()}</h3>
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
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.hospital_name : getStaffName(duty)}
                          </p>
                          <p className="history-card-sub">
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.address : duty.qualification}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p className="history-card-pay">Rs.{(role === "doctor" || role === "nurse" ? (duty.doctor_pay || Math.round(duty.pay * 0.8)) : (duty.gross_pay || duty.pay)).toLocaleString()}</p>
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
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.hospital_name : getStaffName(duty)}
                          </p>
                          <p className="history-card-sub">
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.address : duty.qualification}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p className="history-card-pay">Rs.{(role === "doctor" || role === "nurse" ? (duty.doctor_pay || Math.round(duty.pay * 0.8)) : (duty.gross_pay || duty.pay)).toLocaleString()}</p>
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
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.hospital_name : getStaffName(duty)}
                          </p>
                          <p className="history-card-sub">
                            {role === "doctor" || role === "nurse" ? duty.hospitals?.address : duty.qualification}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p className="history-card-pay">Rs.{(role === "doctor" || role === "nurse" ? (duty.doctor_pay || Math.round(duty.pay * 0.8)) : (duty.gross_pay || duty.pay)).toLocaleString()}</p>
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
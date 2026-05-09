import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Legal.css";
import "./Support.css";
import logo from "../assets/logo.png";

function Support() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("https://formsubmit.co/ajax/locum.blr@gmail.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
          _subject: `LOCUM Support: ${form.subject}`,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      alert("Error sending message. Please email us directly at locum.blr@gmail.com");
    }
    setLoading(false);
  };

  return (
    <div className="legal-container">
      <div className="legal-header">
        <img src={logo} alt="LOCUM" className="legal-logo" onClick={() => navigate("/")} />
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <div className="support-content">
        <h1>Support & Contact Us</h1>
        <p className="support-subtitle">We're here to help. Reach out and we'll get back to you within 24 hours.</p>
        <div className="contact-cards">
          <div className="contact-card"><span className="contact-icon">✉️</span><h3>Email Us</h3><p>locum.blr@gmail.com</p></div>
          <div className="contact-card"><span className="contact-icon">📍</span><h3>Location</h3><p>Bangalore, Karnataka, India</p></div>
          <div className="contact-card"><span className="contact-icon">🕐</span><h3>Response Time</h3><p>Within 24 hours</p></div>
        </div>
        {submitted ? (
          <div className="success-box">
            <h2>✅ Message Sent!</h2>
            <p>Thank you! We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
            <button onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>Send Another Message</button>
          </div>
        ) : (
          <form onSubmit={submit} className="support-form">
            <h2>Send us a Message</h2>
            <div className="support-form-row">
              <div className="support-form-group"><label>Your Name</label><input name="name" placeholder="Full name" required onChange={handle} value={form.name} /></div>
              <div className="support-form-group"><label>Your Email</label><input name="email" type="email" placeholder="Email address" required onChange={handle} value={form.email} /></div>
            </div>
            <div className="support-form-group">
              <label>Subject</label>
              <select name="subject" required onChange={handle} value={form.subject} defaultValue="">
                <option value="" disabled>Select a subject</option>
                <option value="Account Issue">Account Issue</option>
                <option value="Booking Problem">Booking Problem</option>
                <option value="Payment & Billing">Payment & Billing</option>
                <option value="Doctor Complaint">Doctor Complaint</option>
                <option value="Hospital Complaint">Hospital Complaint</option>
                <option value="Technical Issue">Technical Issue</option>
                <option value="Document Verification">Document Verification</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="support-form-group"><label>Message</label><textarea name="message" placeholder="Please describe your issue..." required onChange={handle} value={form.message} rows={6} /></div>
            <button type="submit" className="support-submit-btn" disabled={loading}>{loading ? "Sending..." : "Send Message"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Support;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Help.css";
import logo from "../assets/logo.png";

function Help() {
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
          _subject: `LOCUM Help: ${form.subject}`,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      alert("Error sending message. Please email us directly at locum.blr@gmail.com");
    }
    setLoading(false);
  };

  return (
    <div className="help-container">
      <div className="help-header">
        <img src={logo} alt="LOCUM" className="help-logo" onClick={() => navigate(-1)} />
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <h1>Help & Support</h1>
      <p className="help-subtitle">Having an issue? Get in touch and we'll respond within 24 hours.</p>

      <div className="help-contact-cards">
        <div className="help-contact-card">
          <span>✉️</span>
          <p>locum.blr@gmail.com</p>
        </div>
        <div className="help-contact-card">
          <span>🕐</span>
          <p>Response within 24 hours</p>
        </div>
      </div>

      {submitted ? (
        <div className="help-success">
          <h2>✅ Message Sent!</h2>
          <p>We'll get back to you at <strong>{form.email}</strong> within 24 hours.</p>
          <button onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="help-form">
          <div className="help-form-row">
            <div className="help-form-group">
              <label>Your Name</label>
              <input name="name" placeholder="Full name" required onChange={handle} value={form.name} />
            </div>
            <div className="help-form-group">
              <label>Your Email</label>
              <input name="email" type="email" placeholder="Email address" required onChange={handle} value={form.email} />
            </div>
          </div>

          <div className="help-form-group">
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
              <option value="Cover Request Issue">Cover Request Issue</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="help-form-group">
            <label>Message</label>
            <textarea
              name="message"
              placeholder="Please describe your issue in detail..."
              required
              onChange={handle}
              value={form.message}
              rows={5}
            />
          </div>

          <button type="submit" className="help-submit-btn" disabled={loading}>
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}

export default Help;
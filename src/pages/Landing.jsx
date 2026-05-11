import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./Landing.css";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">

      {/* Navigation */}
      <nav className="landing-nav">
        <img src={logo} alt="LOCUM" className="nav-logo" />
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#for-doctors">Doctors</a>
          <a href="#for-nurses">Nurses</a>
          <a href="#for-hospitals">Hospitals</a>
          <button className="nav-login-btn" onClick={() => navigate("/login")}>Login</button>
          <button className="nav-cta-btn" onClick={() => navigate("/register")}>Let's Get Started</button>
        </div>
        <button className="nav-hamburger" onClick={() => document.getElementById('mobile-menu').classList.toggle('open')}>☰</button>
      </nav>

      {/* Mobile Menu */}
      <div id="mobile-menu" className="mobile-menu">
        <a href="#how-it-works" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>How it works</a>
        <a href="#for-doctors" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Doctors</a>
        <a href="#for-nurses" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Nurses</a>
        <a href="#for-hospitals" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Hospitals</a>
        <a href="#pricing" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Pricing</a>
        <button onClick={() => navigate("/login")}>Login</button>
        <button onClick={() => navigate("/register")}>Let's Get Started</button>
      </div>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Now live in Bangalore 🏥</div>
          <h1>Locum duties,<br />simplified.</h1>
          <p>LOCUM connects hospitals and clinics with verified doctors and nurses for temporary medical duties — instantly, reliably, and professionally.</p>
          <div className="hero-buttons">
            <button className="hero-cta" onClick={() => navigate("/register")}>Let's Get Started</button>
            <button className="hero-secondary" onClick={() => navigate("/login")}>Login →</button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <h3>Instant</h3>
              <p>Doctor activation</p>
            </div>
            <div className="hero-stat">
              <h3>Verified</h3>
              <p>Credentials checked</p>
            </div>
            <div className="hero-stat">
              <h3>Covered</h3>
              <p>Cover request system</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="how-it-works">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2>Three steps to your next locum</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>Register</h3>
              <p>Create your account as a doctor, nurse, or hospital. Verification is instant for medical professionals.</p>
            </div>
            <div className="step-card">
              <div className="step-number">02</div>
              <h3>Connect</h3>
              <p>Hospitals post available duties. Doctors and nurses browse and book duties matching their qualifications.</p>
            </div>
            <div className="step-card">
              <div className="step-number">03</div>
              <h3>Work</h3>
              <p>Hospital verifies credentials, confirms the booking, and the duty is covered. Simple as that.</p>
            </div>
          </div>
        </div>
      </section>

      {/* For Doctors */}
      <section className="section alt" id="for-doctors">
        <div className="section-inner split">
          <div className="split-text">
            <div className="section-label">For Doctors</div>
            <h2>Your time, your terms.</h2>
            <p>Browse available locum duties that match your qualification. Book instantly, get verified, and show up. No middlemen, no phone calls.</p>
            <ul className="feature-list">
              <li>✅ Instant registration and activation</li>
              <li>✅ Duties matched to your qualification</li>
              <li>✅ See your pay upfront before booking</li>
              <li>✅ Request cover if you can't make it</li>
              <li>✅ Full duty history on your profile</li>
            </ul>
            <button className="section-cta" onClick={() => navigate("/register")}>Register as a Doctor</button>
          </div>
          <div className="split-visual doctor-visual">
            <div className="visual-card">
              <p className="visual-label">Available Duty</p>
              <h4>Apollo Hospital, Bangalore</h4>
              <p>📅 Tomorrow, 9:00 AM - 5:00 PM</p>
              <p>🎓 MD - General Medicine</p>
              <p className="visual-pay">₹8,000</p>
              <div className="visual-btn">Book Duty</div>
            </div>
          </div>
        </div>
      </section>

      {/* For Nurses */}
      <section className="section" id="for-nurses">
        <div className="section-inner split reverse">
          <div className="split-visual nurse-visual">
            <div className="visual-card purple">
              <p className="visual-label">Nurse Locum</p>
              <h4>Manipal Hospital, Bangalore</h4>
              <p>📅 This weekend</p>
              <p>🎓 Critical Care Nursing</p>
              <p className="visual-pay">₹4,000</p>
              <div className="visual-btn purple-btn">Book Duty</div>
            </div>
          </div>
          <div className="split-text">
            <div className="section-label">For Nurses</div>
            <h2>Nursing locums, made easy.</h2>
            <p>LOCUM now supports nursing locum duties across Bangalore. Find shifts that fit your schedule and get paid for your expertise.</p>
            <ul className="feature-list">
              <li>✅ All nursing qualifications supported</li>
              <li>✅ ICU, OT, Paediatric and more</li>
              <li>✅ Same instant booking as doctors</li>
              <li>✅ Cover request system included</li>
              <li>✅ Verified by hospital before duty</li>
            </ul>
            <button className="section-cta purple-cta" onClick={() => navigate("/register")}>Register as a Nurse</button>
          </div>
        </div>
      </section>

      {/* For Hospitals */}
      <section className="section alt" id="for-hospitals">
        <div className="section-inner split">
          <div className="split-text">
            <div className="section-label">For Hospitals</div>
            <h2>Never be short-staffed again.</h2>
            <p>Post a locum duty in under 2 minutes. Verified doctors and nurses in Bangalore will see it instantly and book. You verify, confirm, and you're covered.</p>
            <ul className="feature-list">
              <li>✅ Post doctor and nurse locums separately</li>
              <li>✅ Multi-qualification posting</li>
              <li>✅ View certificates before confirming</li>
              <li>✅ Automatic cover if a doctor can't make it</li>
              <li>✅ Duty review and performance tracking</li>
              <li>✅ Billing and payment records built in</li>
            </ul>
            <button className="section-cta" onClick={() => navigate("/register")}>Register your Hospital</button>
          </div>
          <div className="split-visual hospital-visual">
            <div className="visual-card">
              <p className="visual-label">Post a Duty</p>
              <h4>MD - General Medicine</h4>
              <p>📅 15 May 2026</p>
              <p>🕐 9:00 AM - 5:00 PM</p>
              <p className="visual-pay">₹10,000 total</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, background: "#e8f5e9", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>Doctor: ₹8,000</div>
                <div style={{ flex: 1, background: "#e3f2fd", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#1565c0", fontWeight: 600 }}>Fee: ₹2,000</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="section-inner center">
          <h2>Ready to simplify your locums?</h2>
          <p>Join hospitals, doctors and nurses already using LOCUM in Bangalore.</p>
          <button className="hero-cta" onClick={() => navigate("/register")}>Let's Get Started</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={logo} alt="LOCUM" style={{ width: 100 }} />
            <p>Locum duties, simplified.</p>
            <p style={{ fontSize: 12, color: "#aaa" }}>Currently serving Bangalore, India</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#for-doctors">For Doctors</a>
              <a href="#for-nurses">For Nurses</a>
              <a href="#for-hospitals">For Hospitals</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="#how-it-works">How it works</a>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/support")}>Contact Us</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/terms")}>Terms of Service</span>
              <span style={{ cursor: "pointer" }} onClick={() => navigate("/privacy")}>Privacy Policy</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 LOCUM Healthcare Technologies. All rights reserved. Bangalore, India.</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
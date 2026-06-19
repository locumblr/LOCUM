import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./Landing.css";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">

      <nav className="landing-nav">
        <img src={logo} alt="LOCUM" className="nav-logo" />
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#for-doctors">Doctors</a>
          <a href="#for-nurses">Nurses</a>
          <a href="#for-technicians">Technicians</a>
          <a href="#for-hospitals">Hospitals</a>
          <button className="nav-login-btn" onClick={() => navigate("/login")}>Login</button>
          <button className="nav-cta-btn" onClick={() => navigate("/register")}>Get Started</button>
        </div>
        <button className="nav-hamburger" onClick={() => document.getElementById('mobile-menu').classList.toggle('open')}>&#9776;</button>
      </nav>

      <div id="mobile-menu" className="mobile-menu">
        <a href="#how-it-works" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>How it works</a>
        <a href="#for-doctors" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Doctors</a>
        <a href="#for-nurses" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Nurses</a>
        <a href="#for-technicians" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Technicians</a>
        <a href="#for-hospitals" onClick={() => document.getElementById('mobile-menu').classList.remove('open')}>Hospitals</a>
        <button onClick={() => navigate("/login")}>Login</button>
        <button onClick={() => navigate("/register")}>Get Started</button>
      </div>

      <section className="hero">
        <div className="hero-content">
          <img src={logo} alt="LOCUM" className="hero-logo" />
          <h1>LOCUM DUTIES,<br />SIMPLIFIED.</h1>
          <p>Connecting hospitals with verified doctors, nurses, technicians, and specialists — for locum duties and in-patient consultations, transparently and on your terms.</p>
          <div className="hero-buttons">
            <button className="hero-cta" onClick={() => navigate("/register")}>Get Started</button>
            <button className="hero-secondary" onClick={() => navigate("/login")}>Login →</button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <h3>Transparent</h3>
              <p>Pay shown upfront</p>
            </div>
            <div className="hero-stat">
              <h3>Trusted</h3>
              <p>All credentials verified</p>
            </div>
            <div className="hero-stat">
              <h3>Flexible</h3>
              <p>Book on your terms</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2>Three steps to your next locum</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>Register</h3>
              <p>Create your account as a doctor, nurse, technician, or hospital. Credentials are verified before you go live.</p>
            </div>
            <div className="step-card">
              <div className="step-number">02</div>
              <h3>Connect</h3>
              <p>Hospitals post duties and consultations. Professionals browse and accept duties matched to their qualification.</p>
            </div>
            <div className="step-card">
              <div className="step-number">03</div>
              <h3>Work</h3>
              <p>Hospital confirms the booking, payment is processed, and the duty is covered. Simple as that.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt" id="for-doctors">
        <div className="section-inner">
          <div className="section-label">For Doctors</div>
          <h2>Your time, your terms.</h2>
          <p>Browse locum duties and specialist consultation slots that match your qualification. Book instantly, get verified, and show up. No middlemen, no phone calls.</p>
          <ul className="feature-list">
            <li>✅ Instant registration and activation</li>
            <li>✅ Duties matched to your qualification</li>
            <li>✅ See your pay upfront before booking</li>
            <li>✅ In-patient consultation bookings available</li>
            <li>✅ Full duty history on your profile</li>
          </ul>
          <button className="section-cta" onClick={() => navigate("/register")}>Register as a Doctor</button>
        </div>
      </section>

      <section className="section" id="for-nurses">
        <div className="section-inner">
          <div className="section-label">For Nurses</div>
          <h2>Nursing locums, made easy.</h2>
          <p>Find shifts across Ward, OT, ICU, Dialysis, and ER — matched to your schedule. Get paid for your expertise without the agency overhead.</p>
          <ul className="feature-list">
            <li>✅ All nursing qualifications supported</li>
            <li>✅ Ward, OT (General, Ortho, Neuro, OBG), ICU, Dialysis, ER</li>
            <li>✅ Same instant booking as doctors</li>
            <li>✅ Cover request system included</li>
            <li>✅ Verified by hospital before duty</li>
          </ul>
          <button className="section-cta purple-cta" onClick={() => navigate("/register")}>Register as a Nurse</button>
        </div>
      </section>

      <section className="section alt" id="for-technicians">
        <div className="section-inner">
          <div className="section-label">For Technicians</div>
          <h2>Your specialty, on demand.</h2>
          <p>Whether you're a Blood Bank technician, MRI operator, OT/C-arm specialist, or Lab technician — LOCUM connects you with hospitals that need your exact skills.</p>
          <ul className="feature-list">
            <li>✅ 7 specialties: Blood Bank, OT/C-arm, MRI, Radiology, Dialysis, Anaesthesia, Lab</li>
            <li>✅ Duties matched to your specialty only</li>
            <li>✅ Pay and location visible before accepting</li>
            <li>✅ Verified credentials, no middlemen</li>
            <li>✅ Full duty history on your profile</li>
          </ul>
          <button className="section-cta teal-cta" onClick={() => navigate("/register")}>Register as a Technician</button>
        </div>
      </section>

      <section className="section" id="for-hospitals">
        <div className="section-inner">
          <div className="section-label">For Hospitals</div>
          <h2>Never be short-staffed again.</h2>
          <p>Post a locum duty in under 2 minutes. Verified doctors, nurses, and technicians will see it instantly and book. Post specialist consultation slots for in-patient opinions. You verify, confirm, and you're covered.</p>
          <ul className="feature-list">
            <li>✅ Post doctor, nurse, and technician locums separately</li>
            <li>✅ Specialist in-patient consultations (min 3 sessions)</li>
            <li>✅ View certificates before confirming</li>
            <li>✅ Automatic cover if a professional can't make it</li>
            <li>✅ Billing and payment records built in</li>
            <li>✅ Tax invoices generated automatically</li>
          </ul>
          <button className="section-cta" onClick={() => navigate("/register")}>Register your Hospital</button>
        </div>
      </section>

      <section className="cta-banner">
        <div className="section-inner center">
          <h2>Ready to simplify your locums?</h2>
          <p>Join hospitals, doctors, nurses, and technicians already using LOCUM.</p>
          <button className="hero-cta" onClick={() => navigate("/register")}>Get Started</button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-centered">
          <img src={logo} alt="LOCUM" className="footer-logo" />
          <p className="footer-tagline">LOCUM DUTIES, SIMPLIFIED.</p>
          <div className="footer-links-row">
            <a href="#for-doctors">Doctors</a>
            <a href="#for-nurses">Nurses</a>
            <a href="#for-technicians">Technicians</a>
            <a href="#for-hospitals">Hospitals</a>
            <a href="#how-it-works">How it works</a>
            <span onClick={() => navigate("/support")}>Contact</span>
            <span onClick={() => navigate("/terms")}>Terms</span>
            <span onClick={() => navigate("/privacy")}>Privacy</span>
            <span onClick={() => navigate("/department/login")}>Department Login</span>
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

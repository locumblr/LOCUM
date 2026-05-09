import { useNavigate } from "react-router-dom";
import "./Legal.css";
import logo from "../assets/logo.png";

function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="legal-container">
      <div className="legal-header">
        <img src={logo} alt="LOCUM" className="legal-logo" onClick={() => navigate("/")} />
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: May 2026</p>

        <section>
          <h2>1. Introduction</h2>
          <p>LOCUM Healthcare Technologies ("LOCUM", "we", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and share your personal information when you use the LOCUM platform.</p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p><strong>For Doctors:</strong></p>
          <ul>
            <li>Full name, email address, and phone number</li>
            <li>Medical qualifications and years of experience</li>
            <li>Professional certificates and registration documents</li>
            <li>Profile photo (if uploaded)</li>
            <li>Booking history and duty records</li>
            <li>Reviews and ratings received from Hospitals</li>
          </ul>
          <p><strong>For Hospitals:</strong></p>
          <ul>
            <li>Hospital name, email address, and phone number</li>
            <li>Physical address and registration number</li>
            <li>Contact person details</li>
            <li>Registration certificates</li>
            <li>Duty posting history and billing records</li>
          </ul>
          <p><strong>Automatically collected:</strong></p>
          <ul>
            <li>Device type and browser information</li>
            <li>IP address and location data</li>
            <li>Usage data and app activity logs</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>To create and manage your account</li>
            <li>To facilitate connections between Doctors and Hospitals</li>
            <li>To send notifications about bookings, duty changes, and platform updates</li>
            <li>To verify account authenticity and prevent fraud</li>
            <li>To maintain billing and payment records</li>
            <li>To improve our platform and services</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>4. Sharing of Information</h2>
          <p>We share your information only in the following circumstances:</p>
          <ul>
            <li><strong>Between Doctors and Hospitals:</strong> When a duty is booked, the Hospital will see the Doctor's name, qualifications, contact details, and uploaded certificate for verification purposes</li>
            <li><strong>With administrators:</strong> LOCUM administrators can access all account information for the purpose of platform management, billing, and fraud prevention</li>
            <li><strong>Legal requirements:</strong> We may disclose information if required by law or legal proceedings</li>
            <li><strong>We do not sell your data</strong> to any third party for marketing or commercial purposes</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Storage and Security</h2>
          <p>Your data is stored securely on Supabase servers with industry-standard encryption. We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction.</p>
          <p>However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>
        </section>

        <section>
          <h2>6. Document Storage</h2>
          <p>Professional certificates and registration documents uploaded to the Platform are stored securely and are only accessible to:</p>
          <ul>
            <li>The account holder who uploaded them</li>
            <li>Hospitals that have a confirmed booking with the Doctor</li>
            <li>LOCUM administrators</li>
          </ul>
        </section>

        <section>
          <h2>7. Billing Data</h2>
          <p>LOCUM maintains records of all locum duties, platform fees, and payment status for billing and audit purposes. This data includes duty dates, pay amounts, and payment clearance records. Billing data is retained for a minimum of 7 years for legal and financial compliance purposes.</p>
        </section>

        <section>
          <h2>8. Data Retention</h2>
          <p>We retain your personal data for as long as your account is active. If you request account deletion, we will delete your personal data within 30 days, except where we are required to retain it for legal purposes. Completed duty records and billing data may be retained for audit and legal compliance purposes.</p>
        </section>

        <section>
          <h2>9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and personal data</li>
            <li>Withdraw consent for data processing where applicable</li>
            <li>Lodge a complaint with the relevant data protection authority</li>
          </ul>
          <p>To exercise these rights, contact us at <strong>privacy@locumblr.in</strong></p>
        </section>

        <section>
          <h2>10. Cookies</h2>
          <p>We use essential cookies and local storage to maintain your login session and app preferences. We do not use tracking or advertising cookies.</p>
        </section>

        <section>
          <h2>11. Children's Privacy</h2>
          <p>The Platform is intended for medical professionals and healthcare facilities only. We do not knowingly collect data from anyone under the age of 18.</p>
        </section>

        <section>
          <h2>12. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the Platform or by email.</p>
        </section>

        <section>
          <h2>13. Contact</h2>
          <p>For privacy-related questions or requests, contact us at: <strong>privacy@locumblr.in</strong></p>
        </section>
      </div>
    </div>
  );
}

export default Privacy;
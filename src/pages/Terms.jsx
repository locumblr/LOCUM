import { useNavigate } from "react-router-dom";
import "./Legal.css";
import logo from "../assets/logo.png";

function Terms() {
  const navigate = useNavigate();

  return (
    <div className="legal-container">
      <div className="legal-header">
        <img src={logo} alt="LOCUM" className="legal-logo" onClick={() => navigate("/")} />
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="legal-content">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last updated: May 2026</p>

        <section>
          <h2>1. About LOCUM</h2>
          <p>LOCUM ("the Platform", "we", "us") is an online marketplace that connects independent medical professionals ("Doctors") with healthcare facilities ("Hospitals") for temporary and locum medical duties. LOCUM is operated by LOCUM Healthcare Technologies, Bangalore, India.</p>
          <p>By registering on or using the Platform, you agree to be bound by these Terms of Service. If you do not agree, you must not use the Platform.</p>
        </section>

        <section>
          <h2>2. Nature of the Platform</h2>
          <p>LOCUM is a technology platform and marketplace only. We do not:</p>
          <ul>
            <li>Employ, contract, or engage any Doctor listed on the Platform</li>
            <li>Act as a staffing agency, recruitment agency, or medical institution</li>
            <li>Verify, certify, or guarantee the qualifications, credentials, or conduct of any Doctor</li>
            <li>Supervise, direct, or control the medical services provided by any Doctor</li>
            <li>Act as a principal, employer, or agent of any Hospital or Doctor</li>
          </ul>
          <p>All engagements between Doctors and Hospitals are independent arrangements. LOCUM merely facilitates the connection between parties.</p>
        </section>

        <section>
          <h2>3. Doctor Responsibilities</h2>
          <p>By registering as a Doctor on LOCUM, you confirm and agree that:</p>
          <ul>
            <li>You hold a valid and current medical registration with the relevant State Medical Council or the National Medical Commission (NMC) of India</li>
            <li>All qualifications, certifications, and documents you submit are genuine, accurate, and up to date</li>
            <li>You are solely responsible for maintaining your professional registration and compliance with all applicable medical laws and regulations</li>
            <li>You will conduct yourself professionally and ethically during all locum duties</li>
            <li>You are solely and personally responsible for any medical decisions, actions, omissions, errors, negligence, or misconduct during the course of any locum duty</li>
            <li>You hold or will obtain adequate professional indemnity insurance before undertaking any locum duty</li>
            <li>Once a duty is confirmed, you are committed to attending and fulfilling the duty</li>
            <li>You will not misrepresent your identity, qualifications, or experience</li>
          </ul>
        </section>

        <section>
          <h2>4. Hospital Responsibilities</h2>
          <p>By registering as a Hospital on LOCUM, you confirm and agree that:</p>
          <ul>
            <li>You are a duly registered and licensed healthcare facility under applicable Indian law</li>
            <li>You are solely responsible for independently verifying the credentials, qualifications, registration, and fitness of any Doctor before allowing them to perform duties at your facility</li>
            <li>You are solely responsible for ensuring adequate supervision, induction, and orientation of any locum Doctor at your facility</li>
            <li>You are solely responsible for any patient care outcomes arising from duties performed at your facility</li>
            <li>You will comply with all applicable healthcare regulations, labour laws, and patient safety standards</li>
            <li>You will ensure adequate professional indemnity and public liability insurance coverage at your facility</li>
            <li>You will pay agreed remuneration to Doctors directly and in a timely manner</li>
          </ul>
        </section>

        <section>
          <h2>5. Limitation of Liability — IMPORTANT</h2>
          <p><strong>To the maximum extent permitted by applicable law, LOCUM, its directors, employees, agents, partners, and affiliates shall not be held responsible or liable for:</strong></p>
          <ul>
            <li>Any medical negligence, malpractice, errors, or omissions by any Doctor during the course of a locum duty</li>
            <li>Any patient harm, injury, death, or adverse medical outcome arising from any locum duty facilitated through the Platform</li>
            <li>Any untoward incident, accident, dispute, or harm occurring during or arising from any locum duty</li>
            <li>Any failure by a Doctor to attend a confirmed duty</li>
            <li>Any failure by a Hospital to provide safe working conditions or appropriate remuneration</li>
            <li>Any disputes arising between Doctors and Hospitals regarding payment, conduct, or duty performance</li>
            <li>Any fraudulent misrepresentation of credentials by any user of the Platform</li>
            <li>Any loss of income, professional reputation, or consequential damages suffered by any party</li>
          </ul>
          <p><strong>Each Doctor and Hospital is individually, fully, and solely responsible for their own actions, conduct, and professional obligations. LOCUM's role is limited to providing the technology platform that facilitates introductions between parties.</strong></p>
        </section>

        <section>
          <h2>6. Indemnification</h2>
          <p>You agree to indemnify, defend, and hold harmless LOCUM and its directors, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including legal fees) arising from:</p>
          <ul>
            <li>Your use of the Platform</li>
            <li>Your breach of these Terms</li>
            <li>Any medical services you provide or fail to provide</li>
            <li>Any third-party claims arising from your actions or omissions during any locum duty</li>
          </ul>
        </section>

        <section>
          <h2>7. Account Suspension and Termination</h2>
          <p>LOCUM reserves the right to suspend, freeze, or permanently delete any account at any time, with or without notice, if:</p>
          <ul>
            <li>A user violates these Terms of Service</li>
            <li>A Doctor receives repeated negative reviews or is flagged for misconduct</li>
            <li>A Hospital engages in unfair or abusive practices toward Doctors</li>
            <li>LOCUM has reasonable grounds to believe fraudulent or illegal activity is occurring</li>
            <li>A user's credentials are found to be false or misleading</li>
            <li>A Hospital fails to settle outstanding platform fees</li>
          </ul>
        </section>

        <section>
          <h2>8. Cover and Duty Changes</h2>
          <p>Doctors who are unable to attend a confirmed duty may request cover through the Platform. However:</p>
          <ul>
            <li>The original Doctor remains fully responsible for the duty until another Doctor accepts the cover and is verified by the Hospital</li>
            <li>LOCUM does not guarantee that cover will be found</li>
            <li>Repeated requests for cover may result in account suspension</li>
          </ul>
        </section>

        <section>
          <h2>9. Payments</h2>
          <p>LOCUM does not currently process payments electronically between Doctors and Hospitals. All financial transactions are made directly and offline between the parties. LOCUM is not responsible for any payment disputes between Doctors and Hospitals.</p>
        </section>

        <section>
          <h2>9A. Platform Fee & Billing</h2>
          <p>LOCUM charges a <strong>platform service fee of 20%</strong> on every confirmed locum duty facilitated through the Platform. This fee is calculated as follows:</p>
          <ul>
            <li>The Hospital posts a duty with a total pay amount</li>
            <li>80% of the total pay is the Doctor's remuneration</li>
            <li>20% of the total pay is LOCUM's platform service fee, payable by the Hospital</li>
            <li>The Doctor is shown only their 80% remuneration on the Platform</li>
          </ul>
          <p>By posting a locum duty on the Platform, the Hospital agrees to pay LOCUM the platform service fee of 20% of the total duty pay upon completion of the duty.</p>
          <p>LOCUM will maintain a billing record of all completed duties and platform fees owed. Hospitals are responsible for settling outstanding dues with LOCUM directly. Failure to settle dues may result in account suspension.</p>
          <p>LOCUM reserves the right to modify the platform fee structure at any time with reasonable notice to users.</p>
        </section>

        <section>
          <h2>10. Intellectual Property</h2>
          <p>All content, design, code, trademarks, and intellectual property on the Platform belong to LOCUM. You may not copy, reproduce, or use any part of the Platform without written permission.</p>
        </section>

        <section>
          <h2>11. Governing Law</h2>
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Bangalore, Karnataka.</p>
        </section>

        <section>
          <h2>12. Changes to Terms</h2>
          <p>LOCUM reserves the right to update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new Terms.</p>
        </section>

        <section>
          <h2>13. Contact</h2>
          <p>For any questions regarding these Terms, please contact us at: <strong>locum.blr@gmail.com</strong></p>
        </section>
      </div>
    </div>
  );
}

export default Terms;
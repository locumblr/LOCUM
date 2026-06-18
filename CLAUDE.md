# LOCUM — Claude Code Project Brief
**bookmylocum.com** | Locum duty booking platform for hospitals, doctors, and nurses

---

## Stack
- **Frontend:** React + Vite (JSX, no TypeScript)
- **Backend:** Supabase (auth, Postgres, storage, edge functions)
- **Hosting:** Vercel
- **Email:** Resend API → `noreply@bookmylocum.com`, reply-to `locum.blr@gmail.com`
- **Domain:** GoDaddy (bookmylocum.com) — www CNAME still has invalid config in Vercel
- **GitHub:** locumblr/LOCUM (private)
- **Supabase project ID:** xdadenailnapeskzacyt

---

## Business Model
- Hospitals post duties **free** — only hospital area (not name) shown to doctors initially
- Doctor accepts → duty **locks** → hospital has **4 hours** to pay platform fee
- Platform fee: **20% of gross pay**, GST-inclusive (~16.95% revenue + 3.05% GST)
- If hospital doesn't pay in 4 hours → duty auto-expires, both parties notified
- Hospital name + full details revealed to doctor **only after payment confirmed**
- Neither party can cancel after doctor accepts
- Payment method: bank transfer or UPI (no Razorpay yet — deferred pending GST)

---

## Database Tables
`doctors`, `nurses`, `hospitals`, `locum_duties`, `hospital_departments`, `admins`, `notifications`, `push_subscriptions`, `cover_requests`, `monthly_invoices`

**Key statuses:**
- `booking_status` on `locum_duties`: `open`, `locked`, `confirmed`, `expired`, `completed`
- Doctors/nurses: `status = pending` on signup → admin manually approves → `approved`
- Hospitals: same pending → approved flow

**RLS:** Disabled on `locum_duties`, `doctors`, `nurses`, `hospitals` (was causing silent query failures)

**Supabase grant (run for any new table):**
```sql
grant all on [table_name] to anon, authenticated;
```

---

## Key Pages & Files
```
src/pages/
  Landing.jsx / Landing.css
  Login.jsx                  (unified email + department code login)
  Register.jsx
  Profile.jsx                (+ Additional Qualifications tab with certificate upload)
  HospitalDashboard.jsx / .css
  HospitalLocums.jsx / .css  (Open / Completed sub-tabs)
  DoctorDashboard.jsx / .css
  NurseDashboard.jsx
  NurseLocums.jsx
  AdminPanel.jsx / .css      (approve/reject doctors, nurses, hospitals; NMC verify link)
  DepartmentLogin.jsx
  DepartmentDashboard.jsx
  DepartmentProfile.jsx
```

---

## Auth & Login
- Unified login page: email login OR department code login from same form
- Password reset: built into Login.jsx using `verifyOtp` with `token_hash` from URL params
- Supabase site URL: `bookmylocum.com`
- Redirect URL allowlist includes: `www.bookmylocum.com/login`

---

## Email (Resend)
- From: `noreply@bookmylocum.com` (plain format, no display name)
- Reply-to: `locum.blr@gmail.com`
- Triggers: registration confirmation, admin approval, duty lock/expiry notifications

---

## Working Preferences
- Give terminal commands, not manual VS Code edits
- Full file rewrites preferred over partial diffs
- When VS Code fails to save: use `cat > filename << 'EOF'` in terminal
- CSS additions: paste at bottom of existing file
- New tables always need explicit Supabase grant

---

## Pending Items
- [ ] GST registration (before first hospital goes live)
- [ ] Bank details + UPI QR to add to invoices once current account opened
- [ ] www CNAME still showing invalid in Vercel (GoDaddy conflict)
- [ ] Razorpay integration (deferred to post-GST)
- [ ] Play Store / App Store via Capacitor (future)
- [ ] Trademark registration (future)

---

## People & Contacts
- Founder/developer: Akhil (orthopaedic surgeon, Bangalore)
- Support email: locum.blr@gmail.com
- Business structure: Sole proprietorship, single GSTIN covering LOCUM + Dishcovery + SURGEON

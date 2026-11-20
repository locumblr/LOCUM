import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { payPlatformFee } from "./payments";

// Shown on each duty card for hospitals and departments. Applicants stay
// anonymous until the platform fee is paid; contact details appear only for the
// professional the hospital selects.

const box = { marginTop: 12, borderRadius: 8, padding: "12px 14px", fontSize: 13 };
const btn = { padding: "9px 16px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 };
const primaryBtn = { ...btn, background: "#1e3a5f", color: "white" };
const softBtn = { ...btn, background: "#e3f2fd", color: "#1565c0" };

const formatDeadline = (ts) =>
  ts ? new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

const viewDocument = async (path) => {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (error) { alert("Could not open the certificate: " + error.message); return; }
  window.open(data.signedUrl, "_blank");
};

function ApplicantRow({ a, actionLabel, onAction, busy }) {
  const unlocked = a.first_name != null;
  const extra = (a.qualifications || []).filter(q => q !== a.qualification);
  return (
    <div style={{ background: "white", border: "1px solid #e3e8ef", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ color: "#1e3a5f" }}>
          {unlocked
            ? `${a.provider_type === "doctor" ? "Dr. " : ""}${a.first_name} ${a.last_name}`
            : `Applicant · ${a.provider_type}`}
        </strong>
        {a.status === "selected" && <span style={{ color: "#2e7d32", fontWeight: 700 }}>✅ Selected</span>}
      </div>
      <span>🎓 {a.qualification}{extra.length > 0 ? ` (+ ${extra.join(", ")})` : ""}</span>
      <span style={{ color: "#555" }}>
        {a.experience ?? 0} yrs experience · {a.duties_completed} LOCUM {a.duties_completed === 1 ? "duty" : "duties"}
        {a.duties_completed > 0 ? ` (${a.satisfactory_reviews} rated satisfactory)` : ""}
      </span>
      {a.worked_with_you_before && <span style={{ color: "#1565c0" }}>★ Has worked at your hospital before</span>}
      {a.flagged && <span style={{ color: "#c62828" }}>⚠️ Has a flag from a previous duty</span>}
      {unlocked && <>
        <span>🪪 Reg. no. {a.registration_number || "—"}{a.registration_council ? `, ${a.registration_council}` : ""}</span>
        {a.phone && <span>📞 {a.phone}  ✉️ {a.email}</span>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {(a.certificate_paths || []).map((path, i) => (
            <button key={path} style={softBtn} onClick={() => viewDocument(path)}>📄 Certificate {i + 1}</button>
          ))}
          {a.provider_type === "doctor" && (
            <a href="https://www.nmc.org.in/information-desk/indian-medical-register/" target="_blank" rel="noreferrer"
              style={{ ...softBtn, textDecoration: "none" }}>Check NMC register ↗</a>
          )}
          {onAction && a.status === "applied" && (
            <button style={primaryBtn} disabled={busy} onClick={() => onAction(a)}>{busy ? "…" : actionLabel}</button>
          )}
        </div>
      </>}
    </div>
  );
}

function DutyApplicants({ duty, overview, cover, payer, onChange }) {
  const [applicants, setApplicants] = useState(null);
  const [coverApplicants, setCoverApplicants] = useState(null);
  const [booked, setBooked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const count = overview?.applicants || 0;
  const paid = !!overview?.paid;
  const isOpen = duty.booking_status === "open";
  const isConfirmed = duty.booking_status === "confirmed";

  useEffect(() => {
    if (isConfirmed) {
      supabase.rpc("get_booked_professional", { p_duty_id: duty.id }).then(({ data }) => setBooked(data?.[0] || null));
    }
  }, [duty.id, isConfirmed]);

  useEffect(() => {
    if (!open) return;
    supabase.rpc("get_duty_applicants", { p_duty_id: duty.id }).then(({ data, error }) => {
      if (error) alert(error.message);
      setApplicants(data || []);
    });
    if (cover) {
      supabase.rpc("get_cover_applicants", { p_cover_request_id: cover.cover_request_id }).then(({ data, error }) => {
        if (error) alert(error.message);
        setCoverApplicants(data || []);
      });
    }
  }, [open, duty.id, paid, cover, overview]);

  const pay = async () => {
    setBusy(true);
    const ok = await payPlatformFee(duty.id, payer);
    setBusy(false);
    if (ok) { setOpen(true); onChange(); }
  };

  const select = async (a) => {
    const who = `${a.provider_type === "doctor" ? "Dr. " : ""}${a.first_name} ${a.last_name}`;
    if (!window.confirm(`Select ${who} for this duty?\n\nThe duty is confirmed and locked, ${who} receives your hospital's details, and you receive their contact details. Neither side can cancel after this.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("select_applicant", { p_application_id: a.application_id });
    setBusy(false);
    if (error) { alert(error.message); return; }
    onChange();
  };

  const confirmCover = async (a) => {
    const who = `${a.provider_type === "doctor" ? "Dr. " : ""}${a.first_name} ${a.last_name}`;
    if (!window.confirm(`Confirm ${who} as the replacement?\n\nThe original professional is released and ${who} becomes responsible for this duty.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("confirm_cover", { p_cover_application_id: a.application_id });
    setBusy(false);
    if (error) { alert(error.message); return; }
    onChange();
  };

  if (duty.booking_status === "expired") {
    return <div style={{ ...box, background: "#f5f5f5", color: "#888" }}>Closed without a selection.</div>;
  }

  if (isConfirmed) {
    return <>
      {booked && (
        <div style={{ ...box, background: "#e8f5e9" }}>
          <p style={{ fontWeight: 700, color: "#2e7d32", margin: "0 0 6px" }}>✅ Confirmed {booked.provider_type}</p>
          <p style={{ margin: "2px 0" }}>👤 {booked.provider_type === "doctor" ? "Dr. " : ""}{booked.first_name} {booked.last_name}</p>
          <p style={{ margin: "2px 0" }}>🎓 {booked.qualification} · Reg. no. {booked.registration_number || "—"}</p>
          <p style={{ margin: "2px 0" }}>📞 {booked.phone}  ✉️ {booked.email}</p>
        </div>
      )}
      {cover && (
        <div style={{ ...box, background: "#fff8e1" }}>
          <p style={{ fontWeight: 700, color: "#795500", margin: "0 0 4px" }}>🔁 Cover requested{cover.reason ? `: "${cover.reason}"` : ""}</p>
          <p style={{ margin: "0 0 8px", color: "#795500" }}>
            The professional above remains responsible until you confirm a replacement. {cover.applicants} {cover.applicants === 1 ? "applicant" : "applicants"} so far.
          </p>
          {cover.applicants > 0 && !open && <button style={primaryBtn} onClick={() => setOpen(true)}>Review cover applicants</button>}
          {open && coverApplicants && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {coverApplicants.map(a => (
                <ApplicantRow key={a.application_id} a={a} actionLabel="Confirm replacement" onAction={confirmCover} busy={busy} />
              ))}
            </div>
          )}
        </div>
      )}
    </>;
  }

  if (!isOpen) return null;

  if (count === 0 && !paid) {
    return <div style={{ ...box, background: "#f5f7fa", color: "#666" }}>No applicants yet. We'll notify you when a matching professional applies.</div>;
  }

  if (!paid) {
    return (
      <div style={{ ...box, background: "#f5f7fa" }}>
        <p style={{ fontWeight: 700, color: "#1e3a5f", margin: "0 0 6px" }}>
          {count} {count === 1 ? "professional has" : "professionals have"} applied
        </p>
        {!open && <button style={{ ...softBtn, marginBottom: 8 }} onClick={() => setOpen(true)}>See anonymous summary</button>}
        {open && applicants && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {applicants.map(a => <ApplicantRow key={a.application_id} a={a} />)}
          </div>
        )}
        <p style={{ color: "#555", margin: "0 0 10px", lineHeight: 1.5 }}>
          Pay the platform fee to see names, registration numbers and certificates. You then have 24 hours (or until the duty starts) to select one.
          If none is suitable you can ask for a review; the fee is refunded only if our team finds a valid reason.
        </p>
        <button style={primaryBtn} disabled={busy} onClick={pay}>
          {busy ? "Opening payment..." : `💳 Pay Rs.${(duty.platform_fee || 0).toLocaleString()} (incl. GST) to view applicants`}
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...box, background: "#f5f7fa" }}>
      <p style={{ fontWeight: 700, color: "#1e3a5f", margin: "0 0 4px" }}>✅ Fee paid — select an applicant</p>
      {overview?.decision_deadline && (
        <p style={{ color: "#c62828", margin: "0 0 8px" }}>Select by {formatDeadline(overview.decision_deadline)}, or the duty closes and the fee is non-refundable.</p>
      )}
      {!open && <button style={primaryBtn} onClick={() => setOpen(true)}>Review {count} {count === 1 ? "applicant" : "applicants"}</button>}
      {open && applicants && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {applicants.length === 0 && <p style={{ color: "#888", margin: 0 }}>All applicants have withdrawn. New applicants will appear here.</p>}
          {applicants.map(a => <ApplicantRow key={a.application_id} a={a} actionLabel="Select" onAction={select} busy={busy} />)}
        </div>
      )}
    </div>
  );
}

export default DutyApplicants;

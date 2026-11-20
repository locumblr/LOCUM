import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

// Admin review of hospitals' refund claims: the hospital's reason next to each
// rejected applicant's credentials, then refund / credit / uphold the forfeit.

const viewDocument = async (path) => {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (error) { alert("Could not open the certificate: " + error.message); return; }
  window.open(data.signedUrl, "_blank");
};

function AdminRefundReviews() {
  const [status, setStatus] = useState("open");
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => { fetchClaims(status); }, [status]);

  const fetchClaims = async (s) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_refund_claims", { p_status: s });
    if (error) alert(error.message);
    setClaims(data || []);
    setLoading(false);
  };

  const resolve = async (claim, approve, resolution) => {
    const note = (notes[claim.claim_id] || "").trim();
    if (!note) { alert("Add a note explaining the decision. The hospital will see it."); return; }
    const action = !approve ? "Uphold the forfeit (no refund)"
      : resolution === "credit" ? "Approve as credit for the next booking" : "Approve a cash refund";
    if (!window.confirm(`${action}?`)) return;
    setBusy(claim.claim_id);
    const { error } = await supabase.rpc("resolve_refund_claim", {
      p_claim_id: claim.claim_id, p_approve: approve, p_resolution: resolution, p_note: note,
    });
    setBusy(null);
    if (error) { alert(error.message); return; }
    if (approve && resolution === "refund") {
      alert(`Recorded. Now issue the refund of Rs.${(claim.amount_paise / 100).toLocaleString()} in the Razorpay dashboard (Payments → find the payment → Refund).`);
    }
    fetchClaims(status);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["open", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #ccd", background: status === s ? "#1e3a5f" : "white", color: status === s ? "white" : "#555", cursor: "pointer", textTransform: "capitalize" }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: "#888" }}>Loading...</p> :
        claims.length === 0 ? <p style={{ color: "#888" }}>No {status} refund reviews.</p> : claims.map(c => {
          const reasonFor = Object.fromEntries((c.reasons || []).map(r => [r.application_id, r.reason]));
          return (
            <div key={c.claim_id} style={{ background: "white", borderRadius: 10, padding: 18, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: c.applicant_count > 1 ? "4px solid #e74c3c" : "4px solid #f39c12" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, color: "#1e3a5f" }}>{c.hospital_name}</h3>
                <strong>Rs.{(c.amount_paise / 100).toLocaleString()}</strong>
              </div>
              <p style={{ color: "#555", margin: "6px 0" }}>
                {c.qualification} duty on {c.duty_date} · {c.applicant_count} {c.applicant_count === 1 ? "applicant" : "applicants"} rejected
                {c.applicant_count > 1 && <span style={{ color: "#c62828", fontWeight: 600 }}> — rejected every one of several applicants</span>}
              </p>

              {(c.applicants || []).map(a => (
                <div key={a.application_id} style={{ border: "1px solid #e3e8ef", borderRadius: 8, padding: 12, margin: "10px 0" }}>
                  <strong>{a.provider_type === "doctor" ? "Dr. " : ""}{a.name}</strong>
                  {a.flagged && <span style={{ color: "#c62828", marginLeft: 8 }}>⚠️ previously flagged</span>}
                  <p style={{ margin: "4px 0", fontSize: 13 }}>🎓 {(a.qualifications || []).join(", ")} · {a.experience ?? 0} yrs</p>
                  <p style={{ margin: "4px 0", fontSize: 13 }}>🪪 {a.registration_number || "—"}{a.registration_council ? `, ${a.registration_council}` : ""}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                    {(a.certificates || []).map((path, i) => (
                      <button key={path} onClick={() => viewDocument(path)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#e3f2fd", color: "#1565c0", cursor: "pointer", fontSize: 12 }}>📄 Certificate {i + 1}</button>
                    ))}
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, background: "#fff8e1", padding: "6px 10px", borderRadius: 6 }}>
                    <strong>Hospital's reason:</strong> {reasonFor[a.application_id] || "—"}
                  </p>
                </div>
              ))}

              {c.status === "open" ? <>
                <textarea rows={2} placeholder="Decision note (shown to the hospital)"
                  value={notes[c.claim_id] || ""} onChange={e => setNotes({ ...notes, [c.claim_id]: e.target.value })}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccd", fontFamily: "inherit", marginTop: 6 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="approve-btn" disabled={busy === c.claim_id} onClick={() => resolve(c, true, "credit")}>Approve as credit</button>
                  <button className="approve-btn" disabled={busy === c.claim_id} onClick={() => resolve(c, true, "refund")}>Approve cash refund</button>
                  <button className="reject-btn" disabled={busy === c.claim_id} onClick={() => resolve(c, false, null)}>Reject — fee forfeited</button>
                </div>
              </> : (
                <p style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>{c.status === "approved" ? `Approved (${c.resolution})` : "Rejected"}:</strong> {c.admin_note}
                </p>
              )}
            </div>
          );
        })}
    </div>
  );
}

export default AdminRefundReviews;

import { useState } from "react";

// Apply / Applied ✓ (withdraw) button for a duty or cover request card.
export default function ApplyButton({ status, label = "Apply", confirmText, onApply, onWithdraw, onDone }) {
  const [busy, setBusy] = useState(false);

  const act = async (fn, question) => {
    if (question && !window.confirm(question)) return;
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) onDone();
  };

  if (status === "applied") {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <span style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "#e8f5e9", color: "#2e7d32", fontWeight: 600, fontSize: 14, textAlign: "center" }}>
          ✓ Applied — waiting for the hospital
        </span>
        <button className="clear-btn" disabled={busy}
          onClick={() => act(onWithdraw, "Withdraw your application? You can apply again while the duty is open.")}>
          {busy ? "…" : "Withdraw"}
        </button>
      </div>
    );
  }
  if (status === "not_selected") {
    return <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>The hospital chose another applicant.</p>;
  }
  return (
    <button className="book-btn" disabled={busy} onClick={() => act(onApply, confirmText)}>
      {busy ? "Applying..." : label}
    </button>
  );
}

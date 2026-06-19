import { useState, useEffect } from "react";
import logo from "./assets/logo.png";

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState("in"); // "in" → "hold" → "out"

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("out"), 5000);
    const doneTimer = setTimeout(() => onDone(), 6000);
    return () => { clearTimeout(holdTimer); clearTimeout(doneTimer); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#1e3a5f",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: phase === "out" ? 0 : 1,
      transition: phase === "out" ? "opacity 1s ease" : "none",
    }}>
      <img
        src={logo}
        alt="LOCUM"
        style={{
          width: 140,
          transform: phase === "in" ? "scale(0.7)" : "scale(1)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 1s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.9s ease",
        }}
      />
    </div>
  );
}

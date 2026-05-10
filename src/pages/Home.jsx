import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import logo from "../assets/logo.png";

function Home() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    // Auto reload on new service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Android install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidBanner(true);
    });

    // iOS detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode = window.navigator.standalone;
    if (isIos && !isInStandaloneMode) {
      setShowIosBanner(true);
    }
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowAndroidBanner(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="container">
      {showAndroidBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0,
          background: "#1e3a5f", color: "white",
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 1000, boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logo} alt="LOCUM" style={{ width: 36, height: 36, borderRadius: 8, background: "white", padding: 2 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Install LOCUM</p>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Add to your home screen</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={installApp} style={{ padding: "8px 16px", background: "white", color: "#1e3a5f", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              Install
            </button>
            <button onClick={() => setShowAndroidBanner(false)} style={{ padding: "8px 12px", background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {showIosBanner && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#1e3a5f", color: "white",
          padding: "16px 20px 24px",
          zIndex: 1000, boxShadow: "0 -2px 8px rgba(0,0,0,0.2)",
          borderRadius: "16px 16px 0 0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Install LOCUM on your iPhone</p>
            <button onClick={() => setShowIosBanner(false)} style={{ background: "transparent", border: "none", color: "white", fontSize: 18, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.1)", padding: "10px 14px", borderRadius: 10 }}>
              <span style={{ fontSize: 22 }}>1️⃣</span>
              <p style={{ margin: 0, fontSize: 14 }}>Tap the <strong>Share</strong> button ⬆️ at the bottom of Safari</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.1)", padding: "10px 14px", borderRadius: 10 }}>
              <span style={{ fontSize: 22 }}>2️⃣</span>
              <p style={{ margin: 0, fontSize: 14 }}>Scroll down and tap <strong>"Add to Home Screen"</strong></p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.1)", padding: "10px 14px", borderRadius: 10 }}>
              <span style={{ fontSize: 22 }}>3️⃣</span>
              <p style={{ margin: 0, fontSize: 14 }}>Tap <strong>"Add"</strong> in the top right corner</p>
            </div>
          </div>
        </div>
      )}

      <img src={logo} alt="LOCUM" style={{ width: 200, marginBottom: 20 }} />
      <div className="button-group">
        <button onClick={() => navigate("/login")}>Login</button>
        <button onClick={() => navigate("/register")}>Register</button>
      </div>
      <div style={{ marginTop: 40, display: "flex", gap: 20, fontSize: 13, color: "#888", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ cursor: "pointer" }} onClick={() => navigate("/terms")}>Terms of Service</span>
        <span style={{ cursor: "pointer" }} onClick={() => navigate("/privacy")}>Privacy Policy</span>
        <span style={{ cursor: "pointer" }} onClick={() => navigate("/support")}>Contact Us</span>
      </div>
    </div>
  );
}

export default Home;
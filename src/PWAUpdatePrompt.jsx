import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1e3a5f', color: 'white',
      padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, boxShadow: '0 -2px 12px rgba(0,0,0,0.2)',
    }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
        A new version of LOCUM is available.
      </p>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '8px 18px', background: 'white', color: '#1e3a5f',
          border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        Update Now
      </button>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';

const RescueApp = dynamic(() => import('./RescueApp'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh', width: '100vw', background: '#050010',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#ff6600',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, marginBottom: 12, opacity: 0.5 }}>⬡ SKYSENTINEL</div>
        <div style={{ fontSize: 14 }}>Initializing Rescue System…</div>
      </div>
    </div>
  ),
});

export default function RescuePage() {
  return <RescueApp />;
}

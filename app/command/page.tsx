'use client';

import dynamic from 'next/dynamic';

const CommandCenter = dynamic(() => import('./CommandCenter'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh', width: '100vw', background: '#050010',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#00ffc8',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, marginBottom: 12, opacity: 0.5 }}>⬡ SKYSENTINEL</div>
        <div style={{ fontSize: 14 }}>Initializing Command Center…</div>
      </div>
    </div>
  ),
});

export default function CommandPage() {
  return <CommandCenter />;
}

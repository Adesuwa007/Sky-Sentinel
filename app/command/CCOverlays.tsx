'use client';
import { useState, useEffect } from 'react';

const HOTKEYS = [
  { section: 'FLIGHT', keys: [
    { key: 'W/A/S/D', desc: 'Move drone (horizontal)' },
    { key: 'Q/E', desc: 'Altitude down / up (FPV)' },
    { key: '↑ / ↓', desc: 'Altitude up / down' },
    { key: 'PgUp / PgDn', desc: 'Altitude up / down' },
    { key: 'Shift', desc: 'Boost speed' }, { key: 'Esc', desc: 'Exit FPV' },
  ]},
  { section: 'CAMERA', keys: [
    { key: 'Left drag', desc: 'Orbit rotate (360°)' }, { key: 'Right drag', desc: 'Pan camera' },
    { key: 'Scroll', desc: 'Zoom in / out' },
  ]},
  { section: 'MISSION', keys: [
    { key: 'T', desc: 'Toggle thermal' }, { key: 'F', desc: 'Toggle fullscreen 3D view' },
    { key: 'M', desc: 'Toggle mute' }, { key: '?', desc: 'Toggle hotkeys' },
  ]},
];

export function HotkeyOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === '?') setOpen(v => !v); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button className="cc-hotkey-toggle" onClick={() => setOpen(v => !v)}>?</button>
      {open && (
        <div className="cc-hotkey-panel">
          {HOTKEYS.map(section => (
            <div key={section.section} className="cc-hotkey-section">
              <div className="cc-hotkey-section-title">{section.section}</div>
              {section.keys.map(k => (
                <div key={k.key} className="cc-hotkey-row">
                  <span className="cc-hotkey-key">{k.key}</span>
                  <span className="cc-hotkey-desc">{k.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ViewportHUD({ alt, spd, gps, battery, signal, scanProgress, survivorCount, aiAdvice }: {
  alt: number; spd: number; gps: string; battery: number; signal: number;
  scanProgress: number; survivorCount: number; aiAdvice: string;
}) {
  const [displayedAdvice, setDisplayedAdvice] = useState('');
  const [adviceIdx, setAdviceIdx] = useState(0);

  useEffect(() => {
    setAdviceIdx(0);
    setDisplayedAdvice('');
  }, [aiAdvice]);

  useEffect(() => {
    if (adviceIdx >= aiAdvice.length) return;
    const t = setTimeout(() => {
      setDisplayedAdvice(aiAdvice.slice(0, adviceIdx + 1));
      setAdviceIdx(i => i + 1);
    }, 12);
    return () => clearTimeout(t);
  }, [adviceIdx, aiAdvice]);

  return (
    <>
      {/* Top left HUD */}
      <div className="cc-hud-topleft">
        <div>ALT <span style={{ color: '#00ffc8' }}>{alt.toFixed(1)}m</span></div>
        <div>SPD <span style={{ color: '#00ffc8' }}>{spd.toFixed(1)}km/h</span></div>
        <div>GPS <span style={{ color: '#00ffc8' }}>{gps}</span></div>
        <div>BAT <span style={{ color: battery < 25 ? '#ef4444' : '#00ffc8' }}>{Math.round(battery)}%</span></div>
      </div>

      {/* Top right HUD */}
      <div className="cc-hud-topright">
        <div>SIGNAL <span style={{ color: signal < 40 ? '#eab308' : '#00ffc8' }}>{signal}%</span></div>
        <div>SCAN <span style={{ color: '#00ffc8' }}>{Math.round(scanProgress)}%</span></div>
        <div>SURVIVORS <span style={{ color: survivorCount > 0 ? '#44ff90' : 'rgba(200,200,255,0.3)' }}>{survivorCount}</span></div>
      </div>

      {/* AI Advisor pill */}
      <div className="cc-hud-ai">
        <span style={{ color: 'rgba(0,255,200,0.4)', marginRight: 6, fontSize: 10 }}>◈ AI</span>
        {displayedAdvice}
        <span style={{ opacity: adviceIdx < aiAdvice.length ? 1 : 0, animation: 'blink 0.6s step-end infinite' }}>▌</span>
      </div>

      {/* Scan progress bar */}
      {scanProgress > 0 && scanProgress < 100 && (
        <div className="cc-scan-bar">
          <div className="cc-scan-bar-fill" style={{ width: `${scanProgress}%` }} />
        </div>
      )}
    </>
  );
}

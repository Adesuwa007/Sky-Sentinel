'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** R3F + Canvas only run in the browser — avoids SSR/prerender `useMemo` null dispatcher errors. */
const DisasterDroneSimulator = dynamic(() => import('./DisasterDroneSimulator'), {
  ssr: false,
  loading: () => <CinematicLoader />,
});

/* ═══════════════════════════════════════════════════════════════════
   CINEMATIC LOADING SCREEN — Sky Sentinel boot-up sequence
   ═══════════════════════════════════════════════════════════════════ */

const bootLines = [
  'Initializing Sky Sentinel v1.0…',
  'Loading 3D terrain engine…',
  'Calibrating LiDAR simulation…',
  'Thermal imaging module ready…',
  'A* pathfinding engine loaded…',
  'Multi-drone swarm controller online…',
  'WebXR AR subsystem initialized…',
  'Connecting to mission control…',
  'All systems nominal.',
];

function CinematicLoader() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const lineTimer = setInterval(() => {
      setVisibleLines((v) => {
        if (v >= bootLines.length) {
          clearInterval(lineTimer);
          return v;
        }
        return v + 1;
      });
    }, 320);
    const progTimer = setInterval(() => {
      setProgress((v) => Math.min(100, v + 1.2));
    }, 30);
    return () => {
      clearInterval(lineTimer);
      clearInterval(progTimer);
    };
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at 30% 40%, #040e1a 0%, #000810 60%, #000005 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Animated grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0,180,220,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,220,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'gridScroll 8s linear infinite',
        }}
      />

      {/* Hexagon icon */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <svg width="80" height="92" viewBox="0 0 80 92" fill="none" style={{ filter: 'drop-shadow(0 0 20px rgba(0,200,255,0.3))' }}>
          <path
            d="M40 2 L74 24 L74 68 L40 90 L6 68 L6 24 Z"
            stroke="url(#hexGrad)"
            strokeWidth="2"
            fill="rgba(0,180,220,0.06)"
          >
            <animateTransform attributeName="transform" type="rotate" from="0 40 46" to="360 40 46" dur="12s" repeatCount="indefinite" />
          </path>
          <defs>
            <linearGradient id="hexGrad" x1="0" y1="0" x2="80" y2="92">
              <stop offset="0%" stopColor="#00ddff" />
              <stop offset="100%" stopColor="#0066aa" />
            </linearGradient>
          </defs>
        </svg>
        {/* Pulsing ring */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: '1px solid rgba(0,200,255,0.15)',
            animation: 'pulseRing 2s ease-out infinite',
          }}
        />
      </div>

      {/* Title */}
      <div style={{ fontSize: 28, fontWeight: 700, color: '#e0f4ff', letterSpacing: 6, marginBottom: 4 }}>
        SKY SENTINEL
      </div>
      <div style={{ fontSize: 10, color: '#3a6a7a', letterSpacing: 3, marginBottom: 28 }}>
        AI DISASTER RESPONSE SYSTEM
      </div>

      {/* Progress bar */}
      <div style={{ width: 320, marginBottom: 24 }}>
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #005577, #00ccff, #00ffcc)',
              borderRadius: 2,
              transition: 'width 0.05s linear',
              boxShadow: '0 0 12px rgba(0,200,255,0.4)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#2a5060',
            marginTop: 4,
          }}
        >
          <span>LOADING MODULES</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Boot log */}
      <div
        style={{
          width: 380,
          height: 180,
          background: 'rgba(0,10,20,0.6)',
          border: '1px solid rgba(0,180,220,0.1)',
          borderRadius: 8,
          padding: '12px 16px',
          overflow: 'hidden',
          fontSize: 11,
          lineHeight: '1.9',
        }}
      >
        {bootLines.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            style={{
              color: i === visibleLines - 1 ? '#00ddff' : '#2a5a6a',
              transition: 'color 0.5s ease',
            }}
          >
            <span style={{ color: '#1a3540', marginRight: 8 }}>{'>'}</span>
            {line}
            {i === bootLines.length - 1 && i < visibleLines && (
              <span style={{ color: '#44ff88', marginLeft: 6 }}>✓</span>
            )}
          </div>
        ))}
        {visibleLines < bootLines.length && (
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 14,
              background: '#00ccff',
              animation: 'blink 0.6s step-end infinite',
              verticalAlign: 'middle',
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes gridScroll {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        @keyframes pulseRing {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function SimulatorClientGate() {
  return (
    <>
      <Link
        href="/"
        style={{
          position: 'fixed',
          top: 12,
          left: 16,
          zIndex: 9999,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          color: 'rgba(0,255,200,0.5)',
          textDecoration: 'none',
          letterSpacing: '0.1em',
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '6px',
          border: '1px solid rgba(0,255,200,0.15)',
          backdropFilter: 'blur(8px)',
          transition: 'all 300ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#00ffc8';
          e.currentTarget.style.borderColor = 'rgba(0,255,200,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(0,255,200,0.5)';
          e.currentTarget.style.borderColor = 'rgba(0,255,200,0.15)';
        }}
      >
        ← BACK TO HOME
      </Link>
      <DisasterDroneSimulator />
    </>
  );
}

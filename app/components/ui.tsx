'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MissionState, SwarmDrone, Vec2 } from '../lib/types';
import { survivorsData, dangerZones, evacuationZone, helipadZone, ambulancePickupZone, pColor, blockedRoadCells } from '../lib/data';
import { worldToMap, pathToSvg } from '../lib/helpers';

/* ────────────────────────────────────────────────────────
   MISSION LOG
   ──────────────────────────────────────────────────────── */

export type LogEntry = {
  time: string;
  text: string;
  type: 'info' | 'warn' | 'success' | 'critical' | 'system';
};

const LOG_ICONS: Record<LogEntry['type'], string> = {
  info: '◆',
  warn: '⚠',
  success: '✓',
  critical: '⬤',
  system: '◈',
};

const LOG_COLORS: Record<LogEntry['type'], string> = {
  info: '#5a9ab8',
  warn: '#ffd84f',
  success: '#44ff90',
  critical: '#ff4444',
  system: '#33ddf5',
};

export function MissionLog({ entries, thermalVision }: { entries: LogEntry[]; thermalVision: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div style={{ margin: '6px 14px 0' }}>
      <div style={{ fontSize: 9, color: thermalVision ? '#aa6633' : '#4a8fa8', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 4 }}>◈ MISSION LOG</div>
      <div
        ref={scrollRef}
        className={thermalVision ? 'glass-panel-warm' : 'glass-panel'}
        style={{
          padding: '6px 8px',
          maxHeight: 100,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {entries.length === 0 && (
          <div style={{ fontSize: 9, color: '#334455', fontFamily: 'monospace' }}>Awaiting mission data…</div>
        )}
        {entries.slice(-20).map((entry, i) => (
          <div key={i} className="mission-log-entry">
            <span className="log-time">{entry.time}</span>
            <span className="log-icon" style={{ color: LOG_COLORS[entry.type] }}>{LOG_ICONS[entry.type]}</span>
            <span style={{ color: i === entries.slice(-20).length - 1 ? LOG_COLORS[entry.type] : undefined }}>{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   PROGRESS BAR
   ──────────────────────────────────────────────────────── */

export function ProgressBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7a9aa8', marginBottom: 2, fontFamily: 'monospace', letterSpacing: 0.5 }}>
        <span>{label}</span>
        <span style={{ color: value < 25 ? '#ff5555' : '#8aeab8' }}>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 3,
          transition: 'width 0.4s ease',
          boxShadow: `0 0 6px ${color}44`,
        }} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   SIDE BUTTON
   ──────────────────────────────────────────────────────── */

export function SideBtn({ onClick, color, label, disabled, active }: { onClick: () => void; color: string; label: string; disabled?: boolean; active?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', padding: '6px 10px', borderRadius: 5, border: `1px solid ${active ? color : color + '33'}`,
        background: active ? `${color}28` : hover ? `${color}18` : `${color}0a`, color: active ? '#fff' : hover ? '#dde8f0' : '#8899aa',
        fontFamily: 'monospace', fontSize: 10, fontWeight: 600, letterSpacing: 1,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1,
        transition: 'all 0.2s ease', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7,
        boxShadow: active ? `0 0 12px ${color}22` : 'none',
      }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: active ? color : `${color}88`,
        boxShadow: active ? `0 0 8px ${color}` : `0 0 3px ${color}44`,
        flexShrink: 0,
      }} />
      {label}
    </button>
  );
}

/* ────────────────────────────────────────────────────────
   FPV OVERLAY
   ──────────────────────────────────────────────────────── */

export function FPVOverlay({ dronePos, speed, battery, signal, signalGlitch, survivorsDetected, scanProgress, missionState, thermalVision, timeText }: {
  dronePos: THREE.Vector3; speed: number; battery: number; signal: number;
  signalGlitch?: boolean;
  survivorsDetected: number; scanProgress: number; missionState: MissionState; thermalVision: boolean; timeText: string;
}) {
  const hudColor = thermalVision ? '#44ff88' : '#a3e8ff';
  const hudBorder = thermalVision ? 'rgba(68,255,136,0.25)' : 'rgba(0,220,255,0.2)';
  return (
    <>
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: thermalVision
        ? 'radial-gradient(circle, transparent 40%, rgba(0,0,30,0.7) 100%)'
        : 'radial-gradient(circle, transparent 56%, rgba(0,0,0,0.5) 100%)' }} />
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(255,255,255,${Math.min(0.18, speed / 420)}) 0%, transparent 35%, transparent 65%, rgba(255,255,255,${Math.min(0.18, speed / 420)}) 100%)` }} />
      {thermalVision && <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg,rgba(0,255,100,0.02) 0px,transparent 2px,transparent 4px)', mixBlendMode: 'overlay' }} />}
      {thermalVision && <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />}
      {signalGlitch && <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.15) 0px, transparent 1px, transparent 3px)', mixBlendMode: 'multiply', animation: 'none' }} />}
      <div className={thermalVision ? 'glass-panel-warm' : 'glass-panel'} style={{ pointerEvents: 'none', position: 'absolute', top: 16, left: 16, padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: hudColor, lineHeight: '1.7' }}>
        <div style={{ color: thermalVision ? '#66ffaa' : '#33ddf5', fontWeight: 700, letterSpacing: 2, marginBottom: 4, fontSize: 10 }}>
          {thermalVision ? '🌡 THERMAL CAM' : '▶ DRONE FPV'}
        </div>
        <div>ALT {dronePos.y.toFixed(1)} m</div>
        <div>SPD {speed.toFixed(1)} km/h</div>
        <div style={{ color: battery < 25 ? '#ff5555' : hudColor }}>BAT {Math.round(battery)}%</div>
        <div style={{ color: signalGlitch ? '#ff6666' : hudColor }}>SIG {signal}% {signalGlitch ? '⚠' : ''}</div>
        <div>SURV {survivorsDetected}</div>
        <div>SCAN {Math.round(scanProgress)}%</div>
        <div>TIME {timeText}</div>
        {thermalVision && <div style={{ marginTop: 4, color: '#ff8844', fontSize: 9 }}>■ HEAT SIGNATURES ACTIVE</div>}
        <div style={{ marginTop: 6, fontSize: 8, color: '#445566' }}>ESC to exit · WASD/QE fly</div>
      </div>
      <div style={{ pointerEvents: 'none', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 30, height: 30 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: `${hudColor}aa`, transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: `${hudColor}aa`, transform: 'translateX(-50%)' }} />
        {thermalVision && <div style={{ position: 'absolute', inset: -4, border: `1px solid ${hudColor}55`, borderRadius: '50%' }} />}
      </div>
      <div className={thermalVision ? 'glass-panel-warm' : 'glass-panel'} style={{ pointerEvents: 'none', position: 'absolute', top: 16, right: 16, padding: '4px 10px', fontSize: 10, color: thermalVision ? '#66ffaa' : '#33ddf5', fontFamily: 'monospace', letterSpacing: 2, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#ff4d4d' }} className="status-pulse">● REC</span>
        <span>{missionState}</span>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────
   SWARM STATUS
   ──────────────────────────────────────────────────────── */

export function SwarmStatus({ drones, thermalVision }: { drones: SwarmDrone[]; thermalVision?: boolean }) {
  return (
    <div className={thermalVision ? 'glass-panel-warm' : 'glass-panel'} style={{ margin: '6px 0', padding: '8px 10px' }}>
      <div style={{ fontSize: 9, color: '#4a8fa8', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 6 }}>◈ DRONE SWARM</div>
      {drones.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 9, fontFamily: 'monospace' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, boxShadow: `0 0 6px ${d.color}`, flexShrink: 0 }} />
          <span style={{ color: d.color, width: 50 }}>{d.name}</span>
          <span style={{ color: '#445566', flex: 1 }}>{d.role.toUpperCase()}</span>
          <span style={{ color: d.status === 'Standby' ? '#445566' : '#44ff90', fontSize: 8 }}>{d.status} {Math.round(d.progress)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   MINIMAP
   ──────────────────────────────────────────────────────── */

export function Minimap({ dronePos, routeSafest, routeFastest, routeBalanced, swarmDrones, thermalVision, autoSearchPath, autoSearchIdx, scanRadius, scanReveal01, fullIntel }: {
  dronePos: THREE.Vector3; routeSafest: Vec2[]; routeFastest: Vec2[]; routeBalanced: Vec2[];
  swarmDrones: SwarmDrone[]; thermalVision: boolean; autoSearchPath: Vec2[]; autoSearchIdx: number; scanRadius: number;
  scanReveal01: number; fullIntel: boolean;
}) {
  const dp = worldToMap({ x: dronePos.x, z: dronePos.z });
  const hasRoutes = routeSafest.length > 1 || routeFastest.length > 1 || routeBalanced.length > 1;
  // Clear fog when intel is full OR when routes are actively generated
  const fogOpacity = fullIntel || hasRoutes ? 0 : Math.max(0.45, 0.92 - scanReveal01 * 0.85);
  const showMapFeatures = fullIntel || scanReveal01 > 0.2 || hasRoutes;
  const showSafeDanger = fullIntel || scanReveal01 > 0.35 || hasRoutes;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, color: thermalVision ? '#aa6633' : '#4a8fa8', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 4 }}>◈ COMMAND MAP</div>
      <div className={thermalVision ? 'glass-panel-warm' : 'glass-panel'} style={{ overflow: 'hidden', position: 'relative' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', display: 'block' }}>
          {[20,40,60,80].map(v => <line key={`h${v}`} x1={0} y1={v} x2={100} y2={v} stroke={thermalVision ? '#1a0808' : '#0d2337'} strokeWidth={0.3} />)}
          {[20,40,60,80].map(v => <line key={`v${v}`} x1={v} y1={0} x2={v} y2={100} stroke={thermalVision ? '#1a0808' : '#0d2337'} strokeWidth={0.3} />)}
          {scanRadius > 0 && showMapFeatures && <circle cx={dp.x} cy={dp.y} r={scanRadius} fill="rgba(0,220,255,0.06)" stroke="rgba(0,220,255,0.15)" strokeWidth={0.4} />}

          {/* Blocked roads */}
          {showSafeDanger && blockedRoadCells.map((b, i) => {
            const p = worldToMap(b);
            return <rect key={`bl-${i}`} x={p.x - 1.5} y={p.y - 1.5} width={3} height={3} fill="rgba(255,180,0,0.2)" stroke="#ff8800" strokeWidth={0.3} rx={0.5} />;
          })}

          {showSafeDanger && dangerZones.map((d, i) => { const p = worldToMap(d); return <circle key={i} cx={p.x} cy={p.y} r={6.5} fill="rgba(255,35,55,0.18)" stroke="#ff263b" strokeWidth={0.4} />; })}
          {showSafeDanger && (
            <>
              <circle cx={worldToMap(evacuationZone).x} cy={worldToMap(evacuationZone).y} r={6} fill="rgba(36,255,132,0.2)" stroke="#22ff88" strokeWidth={0.5} />
              <circle cx={worldToMap(helipadZone).x} cy={worldToMap(helipadZone).y} r={2.5} fill="rgba(100,255,180,0.25)" stroke="#66ff99" strokeWidth={0.25} />
              <circle cx={worldToMap(ambulancePickupZone).x} cy={worldToMap(ambulancePickupZone).y} r={2.2} fill="rgba(120,255,200,0.2)" stroke="#88ffcc" strokeWidth={0.25} />
            </>
          )}
          {survivorsData.map((s) => {
            if (!fullIntel && !s.foundByLidar && !s.foundByThermal) return null;
            if (s.hidden && !s.foundByLidar && !s.foundByThermal) return null;
            const p = worldToMap(s.base);
            const heatR = Math.max(3.2, (100 - s.health) * 0.06);
            return <circle key={`heat-${s.id}`} cx={p.x} cy={p.y} r={heatR} fill={thermalVision ? 'rgba(255,90,40,0.16)' : 'rgba(255,200,70,0.08)'} />;
          })}
          {survivorsData.map((s) => {
            const p = worldToMap(s.base);
            const visible = fullIntel || s.foundByLidar || s.foundByThermal;
            if (!visible) return null;
            if (s.hidden && !s.foundByLidar && !s.foundByThermal) return null;
            return <circle key={s.id} cx={p.x} cy={p.y} r={2} fill={thermalVision ? '#ff6633' : pColor[s.priority]} />;
          })}
          {thermalVision && survivorsData.filter(s => fullIntel || s.foundByThermal).map(s => {
            const p = worldToMap(s.base);
            return <circle key={`th-${s.id}`} cx={p.x} cy={p.y} r={4} fill="rgba(255,100,50,0.2)" />;
          })}
          {routeSafest.length > 1 && <path d={pathToSvg(routeSafest)} stroke="#2d86ff" strokeWidth={0.8} fill="none" strokeDasharray="2 1" />}
          {routeFastest.length > 1 && <path d={pathToSvg(routeFastest)} stroke="#ffd84f" strokeWidth={0.7} fill="none" />}
          {routeBalanced.length > 1 && <path d={pathToSvg(routeBalanced)} stroke="#44cc88" strokeWidth={0.65} fill="none" strokeDasharray="1.5 1" />}
          {autoSearchPath.length > 1 && <path d={pathToSvg(autoSearchPath.slice(0, autoSearchIdx + 1))} stroke="#44ffaa" strokeWidth={0.5} fill="none" opacity={0.5} />}
          {swarmDrones.map(d => {
            const p = worldToMap(d.pos);
            return <circle key={d.id} cx={p.x} cy={p.y} r={2.5} fill={d.color} stroke={d.color} strokeWidth={0.4} />;
          })}
          <circle cx={dp.x} cy={dp.y} r={3} fill="none" stroke="#33ddf5" strokeWidth={0.4} opacity={0.4} />
          <circle cx={dp.x} cy={dp.y} r={1.8} fill="#33ddf5" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,${thermalVision ? 5 : 8},${thermalVision ? 8 : 16},${fogOpacity})`, pointerEvents: 'none' }} />
        <div style={{ padding: '3px 8px 5px', fontSize: 7, color: '#3a5a6a', fontFamily: 'monospace', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>🔵Safe</span><span>🟡Fast</span><span>🟢Bal</span><span>🔴Danger</span><span>🟩Evac</span><span>🟧Block</span>
        </div>
      </div>
    </div>
  );
}

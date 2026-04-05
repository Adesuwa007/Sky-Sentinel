'use client';
import { useState } from 'react';
import type { MissionState, DisasterType, DroneState, Survivor } from '../lib/types';

interface RescueTeam {
  callsign: string;
  status: 'EN ROUTE' | 'ON SITE' | 'EXTRACTED';
  assignedSurvivor: string | null;
  lastSeen: number;
}

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'warn' | 'success' | 'critical' | 'system';
}

export interface CCLeftPanelProps {
  missionState: MissionState;
  disaster: DisasterType;
  onSetDisaster: (d: DisasterType) => void;
  droneState: DroneState;
  scanProgress: number;
  survivorsDetected: number;
  thermalVision: boolean;
  swarmActive: boolean;
  battery: number;
  routesReady: boolean;
  missionSeed: number;
  onAction: (action: string) => void;
  rescueTeams: RescueTeam[];
  survivors: Survivor[];
  missionLog: LogEntry[];
  fullIntel: boolean;
  pdfLoading: boolean;
  firstPerson: boolean;
}

const LOG_ICONS: Record<string, string> = { info: '◆', warn: '⚠', success: '✓', critical: '⬤', system: '◈' };
const LOG_COLORS: Record<string, string> = { info: '#5a9ab8', warn: '#ffd84f', success: '#44ff90', critical: '#ff4444', system: '#33ddf5' };
const P_COLORS: Record<string, string> = { High: '#ff3b3b', Medium: '#ffd84f', Low: '#44ff90' };

export default function CCLeftPanel({
  missionState, disaster, onSetDisaster, droneState, scanProgress, survivorsDetected,
  thermalVision, swarmActive, battery, routesReady, missionSeed, onAction,
  rescueTeams, survivors, missionLog, fullIntel, pdfLoading, firstPerson,
}: CCLeftPanelProps) {
  const [seedInput, setSeedInput] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const missionStarted = missionState !== 'IDLE';
  const droneReady = droneState === 'ready' || droneState === 'scanning' || droneState === 'mission';

  const copySeed = () => {
    navigator.clipboard.writeText(String(missionSeed));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  const disasters: { type: DisasterType; icon: string; label: string }[] = [
    { type: 'earthquake', icon: '🏚', label: 'QUAKE' },
    { type: 'fire', icon: '🔥', label: 'FIRE' },
  ];

  const scanDone = scanProgress >= 100;
  const isPointCloud = missionState === 'POINT_CLOUD';

  const btns: { action: string; icon: string; label: string; color: string; solid?: string; disabled?: boolean; active?: boolean }[] = [
    { action: 'START_MISSION', icon: '▶', label: 'START MISSION', color: '', solid: 'cyan', disabled: missionState === 'MISSION' || missionStarted },
    { action: 'DEPLOY_DRONE', icon: '✈', label: droneState === 'deploying' ? 'DEPLOYING…' : droneReady ? 'DRONE READY ✓' : 'DEPLOY DRONE', color: '#3b82f6', disabled: droneState === 'deploying' || droneReady || !missionStarted },
    { action: 'FPV_MODE', icon: '👁', label: firstPerson ? 'EXIT FPV' : 'FPV MODE', color: '#a855f7', active: firstPerson, disabled: !droneReady },
    { action: 'LIDAR_SCAN', icon: '◎', label: 'LIDAR SCAN', color: '#00ffc8', disabled: !droneReady },
    { action: 'VIEW_POINT_CLOUD', icon: '⬢', label: 'VIEW POINT CLOUD', color: '#00eeff', disabled: !scanDone, active: isPointCloud },
    { action: 'RECONSTRUCT_MAP', icon: '◧', label: 'RECONSTRUCT MAP', color: '#33ffcc', disabled: !isPointCloud, active: missionState === 'RECONSTRUCT' },
    { action: 'THERMAL', icon: '🌡', label: thermalVision ? 'THERMAL: ON' : 'THERMAL VISION', color: '#ff6600', active: thermalVision, disabled: !droneReady },
    { action: 'AUTO_SEARCH', icon: '⊞', label: 'AUTO SEARCH', color: 'rgba(255,255,255,0.4)', disabled: !droneReady },
    { action: 'DEPLOY_SWARM', icon: '⬡', label: 'DEPLOY SWARM', color: '#cc00ff', active: swarmActive, disabled: !droneReady },
    { action: 'AI_PLANNING', icon: '◈', label: 'AI PLANNING', color: '#3b82f6', disabled: survivorsDetected === 0 || !droneReady },
    { action: 'GENERATE_ROUTES', icon: '⟡', label: 'GENERATE ROUTES', color: '#00ffc8', disabled: survivorsDetected === 0, active: routesReady },
    { action: 'RESCUE_SIM', icon: '⚑', label: 'RESCUE SIM', color: '#ff6600', disabled: !routesReady },
    { action: 'OPEN_RESCUE', icon: '⬡', label: 'OPEN RESCUE APP', color: '', solid: 'cyan' },
    { action: 'MISSION_COMPLETE', icon: '✓', label: 'MISSION COMPLETE', color: '', solid: 'green' },
  ];

  return (
    <div className="cc-left">
      {/* Disaster Selector */}
      <div className="cc-section">
        <div className="cc-section-label">DISASTER TYPE</div>
        <div className="cc-disaster-group">
          {disasters.map(d => (
            <button key={d.type}
              className={`cc-disaster-btn ${disaster === d.type ? 'cc-disaster-btn--active' : 'cc-disaster-btn--default'}`}
              onClick={() => onSetDisaster(d.type)}
              disabled={missionStarted}
            >{d.icon} {d.label}</button>
          ))}
        </div>
      </div>

      {/* Mission Controls */}
      <div className="cc-section">
        <div className="cc-section-label">MISSION CONTROLS</div>
        <div className="cc-controls">
          {btns.map(b => (
            <button key={b.action}
              className={`cc-cmd-btn ${b.solid ? `cc-cmd-btn--solid-${b.solid}` : 'cc-cmd-btn--outline'} ${b.active ? 'cc-cmd-btn--active' : ''}`}
              style={!b.solid ? { '--btn-color': b.color } as React.CSSProperties : undefined}
              disabled={b.disabled}
              onClick={() => onAction(b.action)}
            >
              <span className="cc-cmd-icon">{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mission Seed */}
      <div className="cc-section">
        <div className="cc-section-label">MISSION SEED</div>
        <div className="cc-seed-display">
          <span style={{ flex: 1 }}>{missionSeed}</span>
          <button className="cc-seed-copy" onClick={copySeed}>{copyFeedback ? '✓' : '⧉'}</button>
        </div>
        <div className="cc-seed-input">
          <input placeholder="Enter seed…" value={seedInput} onChange={e => setSeedInput(e.target.value)} />
          <button onClick={() => { if (seedInput) { onAction(`LOAD_SEED:${seedInput}`); setSeedInput(''); } }}>LOAD</button>
        </div>
      </div>

      {/* Rescue Teams */}
      <div className="cc-section">
        <div className="cc-section-label">RESCUE TEAMS ONLINE</div>
        {rescueTeams.length === 0 ? (
          <div className="cc-empty-state">No rescue teams connected</div>
        ) : (
          rescueTeams.map(t => (
            <div key={t.callsign} className="cc-rescue-row">
              <span className="cc-rescue-callsign">{t.callsign}</span>
              <span className={`cc-rescue-status cc-rescue-status--${t.status.toLowerCase().replace(' ', '')}`}>{t.status}</span>
              <span style={{ color: 'rgba(200,200,255,0.3)', fontSize: 10, flex: 1, textAlign: 'right' }}>
                {t.assignedSurvivor || '—'}
              </span>
              <span style={{ color: 'rgba(200,200,255,0.2)', fontSize: 9 }}>
                {Math.round((Date.now() - t.lastSeen) / 1000)}s
              </span>
            </div>
          ))
        )}
      </div>

      {/* Survivor Intel */}
      <div className="cc-section">
        <div className="cc-section-label">SURVIVOR INTEL {!fullIntel && '🔒'}</div>
        {!fullIntel ? (
          <div className="cc-locked-overlay">
            <span className="lock-icon">🔒</span>
            <span>Scan to unlock intel</span>
          </div>
        ) : (
          survivors.filter(s => s.foundByLidar || s.foundByThermal).map(s => (
            <div key={s.id} className="cc-survivor-card" style={{ opacity: s.health <= 0 ? 0.4 : 1 }}>
              <span className="cc-survivor-id" style={{ color: P_COLORS[s.priority] }}>S{s.id}</span>
              <div className="cc-health-bar-wrap">
                <div className="cc-health-bar-fill" style={{
                  width: `${Math.max(0, s.health)}%`,
                  background: s.health < 30 ? '#ef4444' : s.health < 60 ? '#eab308' : '#22c55e',
                }} />
              </div>
              <span className="cc-priority-pill" style={{
                background: `${P_COLORS[s.priority]}15`, color: P_COLORS[s.priority],
                border: `1px solid ${P_COLORS[s.priority]}33`,
              }}>{s.priority.toUpperCase()}</span>
              <span style={{ fontSize: 10, opacity: 0.4 }}>
                {s.foundByThermal ? '🌡' : '◎'}
              </span>
              {s.health <= 0 && <span style={{
                fontSize: 8, padding: '1px 5px', borderRadius: 4,
                background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
              }}>EXPIRED</span>}
            </div>
          ))
        )}
      </div>

      {/* Mission Log */}
      <div className="cc-section" style={{ borderBottom: 'none' }}>
        <div className="cc-section-label">MISSION LOG</div>
        <div style={{ maxHeight: 180, overflowY: 'auto', overflowX: 'hidden' }} className="cc-log-scroll">
          {missionLog.length === 0 && <div className="cc-empty-state">Awaiting mission data…</div>}
          {missionLog.slice(-30).map((entry, i) => (
            <div key={i} style={{
              display: 'flex', gap: 6, padding: '2px 0', fontSize: 10,
              fontFamily: 'var(--font-jetbrains), monospace',
              borderBottom: '1px solid rgba(0,255,200,0.03)',
            }}>
              <span style={{ color: 'rgba(200,200,255,0.2)', minWidth: 36 }}>{entry.time}</span>
              <span style={{ color: LOG_COLORS[entry.type], width: 12 }}>{LOG_ICONS[entry.type]}</span>
              <span style={{ color: 'rgba(200,200,255,0.5)', flex: 1 }}>{entry.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

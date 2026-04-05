'use client';
import type { MissionState } from '../lib/types';

type Phase = 'STANDBY' | 'ARMED' | 'SCANNING' | 'PLANNING' | 'RESCUE' | 'COMPLETE';

const PHASE_MAP: Record<string, Phase> = {
  IDLE: 'STANDBY', MISSION: 'ARMED', DRONE_DEPLOY: 'ARMED', DRONE: 'ARMED',
  SCANNING: 'SCANNING', AUTO_SEARCH: 'SCANNING', POINT_CLOUD: 'SCANNING', RECONSTRUCT: 'SCANNING',
  SURVIVORS_DETECTED: 'PLANNING', PLANNING: 'PLANNING', ROUTE: 'PLANNING', ROUTE_GENERATED: 'PLANNING',
  RESCUE_SIM: 'RESCUE', SWARM: 'RESCUE', THERMAL: 'RESCUE',
  COMPLETE: 'COMPLETE', REPLAY: 'COMPLETE', AR: 'RESCUE',
};

function getPhase(ms: MissionState): Phase { return PHASE_MAP[ms] || 'STANDBY'; }

export interface CCTopNavProps {
  missionState: MissionState;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  elapsed: string;
  battery: number;
  signal: number;
  rescueTeamCount: number;
  dataFresh: boolean;
}

export default function CCTopNav({
  missionState, muted, onToggleMute, onBack, elapsed, battery, signal, rescueTeamCount, dataFresh,
}: CCTopNavProps) {
  const phase = getPhase(missionState);
  const batColor = battery > 60 ? '#22c55e' : battery > 25 ? '#f97316' : '#ef4444';
  const sigBars = Math.ceil((signal / 100) * 4);

  return (
    <div className="cc-topnav">
      <div className="cc-topnav-left">
        <button className="cc-back-btn" onClick={onBack} title="Back to home">←</button>
        <span className="cc-brand">⬡ SKYSENTINEL · COMMAND CENTER</span>
      </div>

      <div className="cc-topnav-center">
        <div className={`cc-phase-badge cc-phase--${phase.toLowerCase()}`}>
          <span className="cc-phase-dot" />
          {phase}
        </div>
        <div className="cc-live-indicator" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: dataFresh ? '#22c55e' : '#eab308',
            animation: dataFresh ? 'phasePulse 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'var(--font-jetbrains), monospace', fontSize: 9,
            color: dataFresh ? '#22c55e' : '#eab308', letterSpacing: '0.08em',
          }}>
            {dataFresh ? 'LIVE' : 'DELAYED'}
          </span>
        </div>
      </div>

      <div className="cc-topnav-right">
        <button className="cc-mute-btn" onClick={onToggleMute}>{muted ? '🔇' : '🔊'}</button>
        <span className="cc-timer">{elapsed}</span>
        <div className="cc-battery-wrap">
          <div className="cc-battery-bar">
            <div className="cc-battery-fill" style={{ width: `${battery}%`, background: batColor }} />
          </div>
          <span className="cc-battery-pct" style={{ color: batColor }}>{Math.round(battery)}%</span>
        </div>
        <div className="cc-signal-bars">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="cc-signal-bar" style={{
              height: `${i * 4}px`, width: 3, borderRadius: 1,
              background: i <= sigBars ? '#00ffc8' : 'rgba(255,255,255,0.1)',
              opacity: i <= sigBars ? 1 : 0.3,
            }} />
          ))}
        </div>
        <div className="cc-rescue-pill">
          RESCUE TEAMS: <strong>{rescueTeamCount}</strong>
        </div>
      </div>
    </div>
  );
}

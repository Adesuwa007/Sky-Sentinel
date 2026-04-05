'use client';
import { useState } from 'react';
import type { SwarmDrone, Vec2 } from '../lib/types';

interface RouteInfo {
  path: Vec2[];
  label: string;
  color: string;
  distance: number;
  dangerExposure: string;
  eta: string;
  recommended?: boolean;
}

export interface CCRightPanelProps {
  swarmDrones: SwarmDrone[];
  swarmActive: boolean;
  battery: number;
  timeRemaining: number;
  riskLevel: string;
  riskFactors: string[];
  routeSafest: Vec2[];
  routeFastest: Vec2[];
  routeBalanced: Vec2[];
  aiRecommendations: string[];
  onBroadcast: (msg: string) => void;
  missionReport: Record<string, unknown> | null;
}

function routeDistance(path: Vec2[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return Math.round(d);
}

export default function CCRightPanel({
  swarmDrones, swarmActive, battery, timeRemaining, riskLevel,
  riskFactors, routeSafest, routeFastest, routeBalanced,
  aiRecommendations, onBroadcast, missionReport,
}: CCRightPanelProps) {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const timerText = `${Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:${(timeRemaining % 60).toString().padStart(2, '0')}`;
  const batColor = battery > 60 ? '#22c55e' : battery > 25 ? '#f97316' : '#ef4444';
  const threatClass = riskLevel.toLowerCase();

  const routes: RouteInfo[] = [];
  if (routeSafest.length > 1) routes.push({ path: routeSafest, label: 'SAFEST', color: '#2d86ff', distance: routeDistance(routeSafest), dangerExposure: 'Minimal', eta: `${Math.round(routeDistance(routeSafest) * 0.15)}s`, recommended: true });
  if (routeBalanced.length > 1) routes.push({ path: routeBalanced, label: 'BALANCED', color: '#44cc88', distance: routeDistance(routeBalanced), dangerExposure: 'Moderate', eta: `${Math.round(routeDistance(routeBalanced) * 0.12)}s` });
  if (routeFastest.length > 1) routes.push({ path: routeFastest, label: 'FASTEST', color: '#ffd84f', distance: routeDistance(routeFastest), dangerExposure: 'High', eta: `${Math.round(routeDistance(routeFastest) * 0.1)}s` });

  const sendBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    onBroadcast(broadcastMsg.trim());
    setBroadcastMsg('');
  };

  return (
    <div className="cc-right">
      {/* Swarm Status */}
      {swarmActive && (
        <div className="cc-section">
          <div className="cc-section-label">SWARM STATUS</div>
          {swarmDrones.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, fontFamily: 'var(--font-jetbrains), monospace' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, boxShadow: `0 0 6px ${d.color}`, flexShrink: 0 }} />
              <span style={{ color: d.color, minWidth: 55, fontWeight: 600 }}>{d.name}</span>
              <span style={{ color: 'rgba(200,200,255,0.4)', flex: 1, fontSize: 9 }}>{d.role.toUpperCase()}</span>
              <span style={{ color: d.progress >= 100 ? '#22c55e' : 'rgba(200,200,255,0.4)', fontSize: 9, minWidth: 35, textAlign: 'right' }}>{d.status}</span>
              <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.progress}%`, background: d.color, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Threat Assessment */}
      <div className="cc-section">
        <div className="cc-section-label">THREAT ASSESSMENT</div>
        <div className={`cc-threat-pill cc-threat--${threatClass}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {riskLevel}
        </div>
        <ul className="cc-threat-factors">
          {riskFactors.length === 0 && <li>No active threats detected</li>}
          {riskFactors.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </div>

      {/* Resources */}
      <div className="cc-section">
        <div className="cc-section-label">RESOURCES</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(200,200,255,0.4)', marginBottom: 3, fontFamily: 'var(--font-jetbrains), monospace' }}>
            <span>BATTERY</span><span style={{ color: batColor }}>{Math.round(battery)}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${battery}%`, background: batColor, borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(200,200,255,0.4)', fontFamily: 'var(--font-jetbrains), monospace' }}>
          <span>MISSION TIMER</span><span style={{ color: timeRemaining < 120 ? '#ef4444' : '#00ffc8' }}>{timerText}</span>
        </div>
      </div>

      {/* Route Analysis */}
      {routes.length > 0 && (
        <div className="cc-section">
          <div className="cc-section-label">ROUTE ANALYSIS</div>
          {routes.map(r => (
            <div key={r.label} className="cc-route-card" style={{ borderColor: `${r.color}22` }}>
              <div className="cc-route-card-header">
                <span className="cc-route-name" style={{ color: r.color }}>{r.label}</span>
                {r.recommended && <span className="cc-recommended-badge">RECOMMENDED</span>}
              </div>
              <div className="cc-route-stats">
                <span>{r.distance}m</span>
                <span>Danger: {r.dangerExposure}</span>
                <span>ETA: {r.eta}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast */}
      <div className="cc-section">
        <div className="cc-section-label">BROADCAST</div>
        <div className="cc-broadcast-input">
          <input placeholder="Send message to all rescue teams…" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendBroadcast()} />
          <button className="cc-broadcast-send" onClick={sendBroadcast}>SEND</button>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="cc-section" style={{ borderBottom: 'none' }}>
        <div className="cc-section-label">AI RECOMMENDATIONS</div>
        {aiRecommendations.length === 0 ? (
          <div className="cc-empty-state">Complete mission for AI analysis</div>
        ) : (
          aiRecommendations.map((rec, i) => (
            <div key={i} className="cc-ai-rec">
              <span className="cc-ai-rec-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="cc-ai-rec-text">{rec}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

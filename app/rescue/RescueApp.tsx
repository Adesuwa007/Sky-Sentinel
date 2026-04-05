'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RescueMap from './RescueMap';
import type { MapSurvivor, MapDanger, MapRoute } from './RescueMap';
import {
  type Vector3D, type Alert, type TurnInstruction, type StatusReport,
  bearing, dirLabel, dirFull, healthColor, calculateDistance,
  generateTurnByTurn, estimateSurvivalMinutes, survivalColor,
  triggerVibration, playAlertSound, resumeAudioContext,
  EVAC_ZONE, TURN_ICONS, SUGGESTED_CALLSIGNS, getMedicalGuidance,
} from './rescueHelpers';
import './rescue.css';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface MState {
  phase: string; disasterType: string; battery: number; signal: number;
  timeRemaining: number; scanProgress: number; survivorsDetected: number;
  totalSurvivors: number; droneState: string; thermalActive: boolean;
  swarmActive: boolean; missionSeed: number; routesGenerated: boolean;
  aiAdvice: string; lastUpdated: number;
  survivors: {
    id: number; health: number; priority: string;
    foundByLidar: boolean; foundByThermal: boolean;
    behavior: string; hidden: boolean; rescued?: boolean;
    base: { x: number; z: number }; assignedTo?: string;
  }[];
  dangerZones: { x: number; z: number; type: string; radius: number }[];
  routes: { safest: Vector3D[]; fastest: Vector3D[]; balanced: Vector3D[] };
  dronePos?: { x: number; z: number };
}

interface Broadcast { message: string; timestamp: number; from: string; id?: string; }
interface RescueTeam { callsign: string; status: string; assignedSurvivor: string | null; lastSeen: number; }
type Tab = 'target' | 'map' | 'survivor' | 'status';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'target', icon: '🎯', label: 'TARGET' },
  { id: 'map', icon: '🗺', label: 'MAP' },
  { id: 'survivor', icon: '👤', label: 'SURVIVOR' },
  { id: 'status', icon: '📡', label: 'STATUS' },
];

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function RescueApp() {
  const router = useRouter();

  // ── Core State ──
  const [callsign, setCallsign] = useState<string | null>(null);
  const [inputCs, setInputCs] = useState('');
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>('target');
  const [mission, setMission] = useState<MState | null>(null);
  const [lastSync, setLastSync] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [rescueTeams, setRescueTeams] = useState<RescueTeam[]>([]);
  const [targetIdx, setTargetIdx] = useState(0);
  const [myStatus, setMyStatus] = useState<string>('EN ROUTE');
  const [healthHistory, setHealthHistory] = useState<number[]>([]);
  const [droneViewOpen, setDroneViewOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // ── Onboarding State ──
  const [onboardStep, setOnboardStep] = useState<0 | 1 | 2 | 3>(0); // 0=check,1=welcome,2=brief,3=callsign
  const [onboarded, setOnboarded] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showEquipCheck, setShowEquipCheck] = useState(false);
  const [joining, setJoining] = useState(false);

  // ── Alert State ──
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [emergencyAlert, setEmergencyAlert] = useState<Alert | null>(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Status Reporting ──
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [backupRequested, setBackupRequested] = useState(false);
  const [reportSituation, setReportSituation] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportEta, setReportEta] = useState('');
  const [reportFlags, setReportFlags] = useState<string[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusReport[]>([]);

  // ── Theme ──
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // ── Refs ──
  const lastBroadcastTs = useRef(0);
  const droneCanvasRef = useRef<HTMLCanvasElement>(null);
  const droneFrameRef = useRef(0);
  const prevMissionRef = useRef<MState | null>(null);
  const audioResumed = useRef(false);

  // ── Resume audio on first interaction ──
  useEffect(() => {
    const handler = () => {
      if (!audioResumed.current) { resumeAudioContext(); audioResumed.current = true; }
    };
    document.addEventListener('touchstart', handler, { once: true });
    document.addEventListener('click', handler, { once: true });
    return () => { document.removeEventListener('touchstart', handler); document.removeEventListener('click', handler); };
  }, []);

  // ── Theme init ──
  useEffect(() => {
    const saved = (localStorage.getItem('skysentinel_theme') || 'dark') as 'dark' | 'light';
    setTheme(saved);
    document.documentElement.className = document.documentElement.className.replace(/\b(dark|light)\b/g, '');
    document.documentElement.classList.add(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('skysentinel_theme', next);
    document.documentElement.className = document.documentElement.className.replace(/\b(dark|light)\b/g, '');
    document.documentElement.classList.add(next);
  };

  // ── Onboarding check ──
  useEffect(() => {
    const ob = localStorage.getItem('skysentinel_onboarded');
    const cs = localStorage.getItem('skysentinel_callsign');
    if (ob && cs) {
      setOnboarded(true); setCallsign(cs); setShowWelcomeBack(true);
    } else if (ob && !cs) {
      setOnboarded(true); setOnboardStep(3);
    } else {
      setOnboardStep(1);
    }
  }, []);

  // ── Join mission ──
  const joinMission = async (cs: string) => {
    setJoining(true);
    const upper = cs.trim().toUpperCase();
    setCallsign(upper);
    localStorage.setItem('skysentinel_callsign', upper);
    localStorage.setItem('skysentinel_onboarded', 'true');
    try {
      await fetch('/api/rescue-teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign: upper }),
      });
    } catch { /* offline tolerance */ }
    await new Promise(r => setTimeout(r, 800));
    setJoining(false); setOnboarded(true); setShowWelcomeBack(false);
    setOnboardStep(0); setEntered(true); setShowEquipCheck(true);
    setTimeout(() => setShowEquipCheck(false), 4500);
  };

  // ── Alert management ──
  const addAlert = useCallback((a: Omit<Alert, 'id' | 'timestamp'>) => {
    const newAlert: Alert = { ...a, id: crypto.randomUUID(), timestamp: Date.now() };
    if (a.level === 4) { setEmergencyAlert(newAlert); }
    if (a.level === 3) { setScreenFlash(true); setTimeout(() => setScreenFlash(false), 200); }
    setAlerts(prev => [newAlert, ...prev].slice(0, 5));
    triggerVibration(a.level);
    playAlertSound(a.level);
    if (a.autoDismiss) { setTimeout(() => dismissAlert(newAlert.id), a.autoDismiss); }
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Poll mission state ──
  useEffect(() => {
    if (!entered || !callsign) return;
    const fetchAll = async () => {
      try {
        const [msRes, bcRes, tmRes] = await Promise.all([
          fetch('/api/mission-state'), fetch('/api/broadcast'), fetch('/api/rescue-teams'),
        ]);
        const ms: MState = await msRes.json();
        const bc = await bcRes.json();
        const tm = await tmRes.json();
        prevMissionRef.current = mission;
        setMission(ms); setLastSync(Date.now()); setIsOffline(false);
        localStorage.setItem('skysentinel_last_state', JSON.stringify(ms));
        setBroadcasts(bc.history || []);
        setRescueTeams(tm.teams || []);
        if (bc.latest && bc.latest.timestamp > lastBroadcastTs.current) {
          lastBroadcastTs.current = bc.latest.timestamp;
          addAlert({ level: 2, message: `Command: ${bc.latest.message}`, source: 'command', autoDismiss: 8000 });
        }
      } catch {
        setIsOffline(true);
        const cached = localStorage.getItem('skysentinel_last_state');
        if (cached && !mission) setMission(JSON.parse(cached));
      }
    };
    fetchAll();
    const poll = setInterval(fetchAll, 1000);
    return () => clearInterval(poll);
  }, [entered, callsign]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Also poll during onboarding so data is ready ──
  useEffect(() => {
    if (entered) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/mission-state');
        const ms = await res.json();
        setMission(ms);
        localStorage.setItem('skysentinel_last_state', JSON.stringify(ms));
      } catch { /* ok */ }
    }, 1000);
    return () => clearInterval(poll);
  }, [entered]);

  // ── Heartbeat ──
  useEffect(() => {
    if (!entered || !callsign) return;
    const hb = setInterval(async () => {
      try {
        await fetch('/api/rescue-teams', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign, status: myStatus }),
        });
      } catch { /* ok */ }
    }, 10000);
    return () => clearInterval(hb);
  }, [entered, callsign, myStatus]);

  // ── Health history ──
  useEffect(() => {
    if (!mission?.survivors?.length) return;
    const s = sortedSurvivors;
    if (s.length > targetIdx) {
      setHealthHistory(prev => [...prev.slice(-12), s[targetIdx].health]);
    }
  }, [mission]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Alert triggers from state changes ──
  useEffect(() => {
    if (!mission || !prevMissionRef.current) return;
    const prev = prevMissionRef.current;
    const target = sortedSurvivors[targetIdx];
    if (!target) return;
    const prevTarget = prev.survivors.find(s => s.id === target.id);
    if (prevTarget) {
      if (target.health < 35 && prevTarget.health >= 35) {
        addAlert({ level: 3, message: `CRITICAL: Survivor ${target.id} health below 35%`, source: 'survivor', survivorId: String(target.id), requiresAction: true });
      }
      if (target.health < 20 && prevTarget.health >= 20) {
        addAlert({ level: 4, message: `EMERGENCY: Survivor ${target.id} has minutes remaining`, source: 'survivor', survivorId: String(target.id), requiresAction: true });
      }
    }
  }, [mission]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──
  const allSurvivors = (mission?.survivors || []).filter(s => (s.foundByLidar || s.foundByThermal) && !s.rescued);
  const sortedSurvivors = [...allSurvivors].sort((a, b) => a.health - b.health);
  const target = sortedSurvivors[targetIdx] || null;
  const myPos = { x: 25, z: -25 };
  const dronePos = mission?.dronePos || { x: 0, z: 16 };
  const route: MapRoute[] = mission?.routes?.balanced || [];

  const dist = target ? Math.round(Math.hypot(myPos.x - target.base.x, myPos.z - target.base.z)) : 0;
  const eta = target ? `~${Math.max(1, Math.round(dist * 0.06))} min` : '—';
  const bearingDeg = target ? bearing(myPos.x, myPos.z, target.base.x, target.base.z) : 0;
  const dir = dirLabel(bearingDeg);

  const syncAge = Math.round((Date.now() - lastSync) / 1000);
  const syncStatus = lastSync === 0 ? 'offline' : syncAge < 15 ? 'live' : syncAge < 30 ? 'delayed' : 'offline';

  // ── Turn-by-turn ──
  const turnInstructions = route.length > 1 ? generateTurnByTurn(route, myPos) : [];
  const currentStepIdx = turnInstructions.length > 0
    ? Math.max(0, turnInstructions.findIndex(wp => calculateDistance(myPos, wp.position) < 8) || 0)
    : 0;
  const currentStep = turnInstructions[currentStepIdx] || null;
  const totalRouteDist = turnInstructions.reduce((s, t) => s + t.distance, 0);
  const traveledDist = turnInstructions.slice(0, currentStepIdx).reduce((s, t) => s + t.distance, 0);

  const timeStr = mission
    ? `${Math.floor(mission.timeRemaining / 60).toString().padStart(2, '0')}:${(mission.timeRemaining % 60).toString().padStart(2, '0')}`
    : '--:--';

  // ── Health chart SVG ──
  const chartPath = healthHistory.length > 1
    ? healthHistory.map((h, i) => `${i === 0 ? 'M' : 'L'} ${(i / (healthHistory.length - 1)) * 280} ${80 - h * 0.7}`).join(' ')
    : '';

  // ── Map data ──
  const mapSurvivors: MapSurvivor[] = allSurvivors.map(s => ({
    id: s.id, x: s.base.x, z: s.base.z, priority: s.priority, found: true,
  }));
  const mapDangers: MapDanger[] = (mission?.dangerZones || []).map(d => ({ x: d.x, z: d.z, radius: d.radius }));

  // ── Action handlers ──
  const postAction = useCallback(async (action: string) => {
    if (!callsign || !target) return;
    try {
      await fetch('/api/rescue-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callsign, survivorId: target.id, action }),
      });
      await fetch('/api/rescue-teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign,
          status: action === 'ARRIVED' ? 'ON SITE' : action === 'EXTRACTED' ? 'EXTRACTED' : myStatus,
          assignedSurvivor: `S${target.id}`,
        }),
      });
    } catch { /* offline tolerance */ }
  }, [callsign, target, myStatus]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const handleQuickAction = (action: string) => {
    triggerVibration(1);
    if (action === 'ARRIVED') { setMyStatus('ON SITE'); postAction('ARRIVED'); showToast('✓ ARRIVED confirmed'); }
    else if (action === 'EXTRACTED') { setMyStatus('EXTRACTED'); postAction('EXTRACTED'); nextTarget(); showToast('✓ EXTRACTED confirmed'); }
    else if (action === 'NEED_BACKUP') { setShowBackupConfirm(true); }
    else if (action === 'NEXT_TARGET') { nextTarget(); showToast('⏭ Next target assigned'); }
    else if (action === 'UPDATE_STATUS') { setShowStatusSheet(true); }
    else { showToast(`📍 ${action} confirmed`); }
    setStatusHistory(prev => [{ action, note: '', eta: '', flags: [], timestamp: Date.now() }, ...prev]);
  };

  const confirmBackup = () => {
    postAction('NEED_BACKUP');
    triggerVibration(4);
    setShowBackupConfirm(false);
    setBackupRequested(true);
    showToast('✓ BACKUP REQUESTED');
    addAlert({ level: 3, message: `BACKUP REQUEST sent for Survivor ${target?.id}`, source: 'team', requiresAction: true });
    setTimeout(() => setBackupRequested(false), 60000);
  };

  const submitStatusReport = () => {
    const report: StatusReport = {
      action: reportSituation || myStatus,
      note: reportNote, eta: reportEta, flags: reportFlags,
      timestamp: Date.now(),
    };
    setStatusHistory(prev => [report, ...prev]);
    if (reportSituation) setMyStatus(reportSituation);
    postAction(reportSituation || 'STATUS_UPDATE');
    setShowStatusSheet(false);
    setReportSituation(''); setReportNote(''); setReportEta(''); setReportFlags([]);
    showToast('✓ Report submitted');
  };

  const nextTarget = () => {
    setTargetIdx(i => (i + 1) % Math.max(1, sortedSurvivors.length));
    setMyStatus('EN ROUTE'); setHealthHistory([]);
  };

  const changeCallsign = () => {
    localStorage.removeItem('skysentinel_callsign');
    setCallsign(null); setEntered(false);
    setOnboardStep(3);
  };

  // ── Drone overhead canvas ──
  const drawDroneView = useCallback(() => {
    const canvas = droneCanvasRef.current;
    if (!canvas || !droneViewOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width; const h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#030008'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,255,200,0.04)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    for (let i = 0; i < h; i += 30) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
    const cx = w / 2; const cy = h / 2; const t = Date.now() * 0.001;
    const scanRadius = ((t * 30) % 120);
    ctx.beginPath(); ctx.arc(cx, cy, scanRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,200,${0.3 - scanRadius / 400})`; ctx.lineWidth = 1; ctx.stroke();
    allSurvivors.forEach(s => {
      const sx = cx + (s.base.x - (dronePos?.x || 0)) * 3;
      const sy = cy + (s.base.z - (dronePos?.z || 0)) * 3;
      if (sx > 0 && sx < w && sy > 0 && sy < h) {
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = s.priority === 'High' ? '#ff3b3b' : s.priority === 'Medium' ? '#ffd84f' : '#44ff90';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '8px monospace';
        ctx.fillText(`S${s.id}`, sx + 6, sy + 3);
      }
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 6, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 15, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + 15); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    droneFrameRef.current = requestAnimationFrame(drawDroneView);
  }, [droneViewOpen, allSurvivors, dronePos]);

  useEffect(() => {
    if (droneViewOpen) droneFrameRef.current = requestAnimationFrame(drawDroneView);
    return () => cancelAnimationFrame(droneFrameRef.current);
  }, [droneViewOpen, drawDroneView]);

  // ═══════════════════════════════════════════════════
  // RENDER — ONBOARDING
  // ═══════════════════════════════════════════════════
  if (!entered && !showWelcomeBack && onboardStep === 1) {
    return (
      <div className="onboard-screen">
        <svg className="onboard-hex" viewBox="0 0 80 80" fill="none"><polygon points="40,4 72,22 72,58 40,76 8,58 8,22" stroke="#ff6600" strokeWidth="2" fill="none" /></svg>
        <div className="onboard-title">SKYSENTINEL</div>
        <div className="onboard-subtitle">RESCUE TEAM SYSTEM</div>
        <div className="onboard-desc">This system provides real-time navigation, survivor intelligence, and direct coordination with the command center during active missions.</div>
        <button className="btn-primary" onClick={() => setOnboardStep(2)}>GET STARTED →</button>
        <div className="onboard-dots"><div className="onboard-dot onboard-dot--active" /><div className="onboard-dot" /><div className="onboard-dot" /></div>
      </div>
    );
  }

  if (!entered && !showWelcomeBack && onboardStep === 2) {
    return (
      <div className="onboard-screen" style={{ justifyContent: 'flex-start', paddingTop: 60 }}>
        <button className="onboard-back" onClick={() => setOnboardStep(1)}>← BACK</button>
        <div className="onboard-header">BEFORE YOU DEPLOY</div>
        <div className="onboard-cards">
          {[
            { icon: '⊕', title: 'Your Primary Target', body: 'You will be assigned the highest priority survivor. Their health is declining — every second matters.' },
            { icon: '◎', title: 'Turn-by-Turn Guidance', body: 'Follow the compass and step-by-step directions to reach your target. Avoid red danger zones at all costs.' },
            { icon: '🔔', title: 'Stay Alert', body: 'Critical health changes trigger immediate alerts. Your phone will vibrate. Respond without delay.' },
            { icon: '📡', title: 'Command is Watching', body: 'The command center sees your status in real time. Use NEED BACKUP immediately if you require assistance.' },
          ].map((c, i) => (
            <div key={i} className="onboard-card">
              <div className="onboard-card-icon" style={{ fontSize: 24 }}>{c.icon}</div>
              <div className="onboard-card-content">
                <div className="onboard-card-title">{c.title}</div>
                <div className="onboard-card-body">{c.body}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setOnboardStep(3)} style={{ marginTop: 20 }}>NEXT →</button>
        <div className="onboard-dots" style={{ marginTop: 16 }}><div className="onboard-dot" /><div className="onboard-dot onboard-dot--active" /><div className="onboard-dot" /></div>
      </div>
    );
  }

  if (!entered && !showWelcomeBack && onboardStep === 3) {
    return (
      <div className="onboard-screen">
        {onboarded && <button className="onboard-back" onClick={() => { setOnboardStep(0); setShowWelcomeBack(true); }}>← BACK</button>}
        {!onboarded && <button className="onboard-back" onClick={() => setOnboardStep(2)}>← BACK</button>}
        <div className="onboard-label-sm">IDENTIFY YOURSELF</div>
        <div className="onboard-heading">Enter Your Callsign</div>
        <div className="onboard-hint">Your callsign identifies you to the command center and your team throughout the mission.</div>
        <input
          className="onboard-input" placeholder="e.g. BRAVO-2" value={inputCs}
          onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12); setInputCs(v); }}
          autoComplete="off" autoCorrect="off" spellCheck={false}
          onKeyDown={e => e.key === 'Enter' && inputCs.trim() && joinMission(inputCs)}
        />
        <div className="onboard-suggestions">
          <div className="onboard-suggestions-label">Suggested callsigns:</div>
          <div className="onboard-suggestions-row">
            {SUGGESTED_CALLSIGNS.map(cs => (
              <button key={cs} className="onboard-suggestion-chip" onClick={() => setInputCs(cs)}>{cs}</button>
            ))}
          </div>
        </div>
        <button className="btn-primary" disabled={!inputCs.trim() || joining} onClick={() => joinMission(inputCs)}>
          {joining ? '...' : 'JOIN MISSION'}
        </button>
        <div className="onboard-dots" style={{ marginTop: 16 }}><div className="onboard-dot" /><div className="onboard-dot" /><div className="onboard-dot onboard-dot--active" /></div>
      </div>
    );
  }

  if (!entered && showWelcomeBack) {
    return (
      <div className="welcome-back">
        <div className="welcome-back-label">WELCOME BACK</div>
        <div className="welcome-back-callsign">{callsign}</div>
        <button className="btn-primary" onClick={() => joinMission(callsign!)}>REJOIN MISSION →</button>
        <button className="btn-secondary" onClick={() => { localStorage.removeItem('skysentinel_callsign'); setCallsign(null); setShowWelcomeBack(false); setOnboardStep(3); }}>
          USE DIFFERENT CALLSIGN
        </button>
      </div>
    );
  }

  const medical = target ? getMedicalGuidance(target.health) : null;
  const unreadAlerts = alerts.length;

  // ═══════════════════════════════════════════════════
  // RENDER — MAIN UI
  // ═══════════════════════════════════════════════════
  return (
    <div className="rescue-root">
      {/* ── Equipment checklist modal ── */}
      {showEquipCheck && (
        <div className="equip-modal" onClick={() => setShowEquipCheck(false)}>
          <div className="equip-title">PRE-MISSION CHECK</div>
          <div className="equip-item"><span className="equip-check">✓</span> Connected to command center</div>
          <div className="equip-item"><span className="equip-check">✓</span> Assigned to Survivor {target ? String(target.id).padStart(2, '0') : '--'}</div>
          <div className="equip-item"><span className="equip-check">✓</span> Route calculated ({totalRouteDist}m)</div>
          <div className="equip-deploy">MISSION ACTIVE — DEPLOY NOW</div>
        </div>
      )}

      {/* ── Screen flash ── */}
      {screenFlash && <div className="rescue-screen-flash" />}

      {/* ── Emergency modal ── */}
      {emergencyAlert && (
        <div className="rescue-emergency-modal">
          <div className="rescue-emergency-msg">{emergencyAlert.message}</div>
          <div className="rescue-emergency-sub">Tap CONFIRM to acknowledge</div>
          <button className="btn-primary" style={{ background: '#ff3333' }} onClick={() => setEmergencyAlert(null)}>CONFIRM</button>
        </div>
      )}

      {/* ── Alert banners ── */}
      {alerts.length > 0 && !emergencyAlert && (
        <div className="rescue-alert-stack">
          {alerts.slice(0, 2).map(a => (
            <div key={a.id} className={`rescue-alert-banner rescue-alert-banner--${a.level}`} onClick={() => dismissAlert(a.id)}>
              <span>{a.message}</span>
              <button className="rescue-alert-dismiss" aria-label="Dismiss">✕</button>
            </div>
          ))}
          {alerts.length > 2 && (
            <div className="rescue-alert-banner rescue-alert-banner--2" style={{ fontSize: 12, padding: '8px 20px' }}>
              +{alerts.length - 2} more alerts
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className="rescue-toast">{toast}</div>}

      {/* ── Offline banner ── */}
      {isOffline && <div className="rescue-offline-banner">OFFLINE — showing cached data</div>}

      {/* ── Top bar ── */}
      <div className="rescue-topbar">
        <div className="rescue-topbar-left">
          <button className="rescue-topbar-back" onClick={() => router.push('/')} aria-label="Back to home">←</button>
          <div className="rescue-topbar-brand">⬡ SKYSENTINEL · RESCUE</div>
        </div>
        <div className="rescue-topbar-right">
          {unreadAlerts > 0 && <span className="rescue-alert-count">{unreadAlerts} ALERT{unreadAlerts > 1 ? 'S' : ''}</span>}
          <span className="rescue-callsign-badge">{callsign}</span>
          <div className={`rescue-sync-dot rescue-sync-dot--${syncStatus}`} />
          <span className={`rescue-sync-label rescue-sync-label--${syncStatus}`}>
            {syncStatus === 'live' ? 'LIVE' : syncStatus === 'delayed' ? 'DELAYED' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="rescue-content">

        {/* ═══ TAB 1 — TARGET ═══ */}
        {tab === 'target' && (
          <>
            {!target ? (
              <div className="rescue-empty">No survivors detected yet.<br />Awaiting LiDAR scan…</div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="rescue-quick-actions">
                  <button className="rescue-quick-chip rescue-quick-chip--green" onClick={() => handleQuickAction('ARRIVED')}>✓ ARRIVED</button>
                  <button className="rescue-quick-chip rescue-quick-chip--cyan" onClick={() => handleQuickAction('EXTRACTED')}>🏥 EXTRACTED</button>
                  <button className={`rescue-quick-chip rescue-quick-chip--red ${backupRequested ? 'rescue-quick-chip--disabled' : ''}`} disabled={backupRequested} onClick={() => handleQuickAction('NEED_BACKUP')}>
                    {backupRequested ? '🆘 REQUESTED' : '🆘 NEED BACKUP'}
                  </button>
                  <button className="rescue-quick-chip rescue-quick-chip--orange" onClick={() => handleQuickAction('NEXT_TARGET')}>⏭ NEXT TARGET</button>
                  <button className="rescue-quick-chip rescue-quick-chip--white" onClick={() => handleQuickAction('UPDATE_STATUS')}>🔄 UPDATE STATUS</button>
                </div>

                {/* Navigation card */}
                {currentStep && (
                  <div className="rescue-nav-card">
                    <div className="rescue-nav-current">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="rescue-nav-turn-icon" style={{ fontSize: 48 }}>{TURN_ICONS[currentStep.turn] || '↑'}</div>
                        <div>
                          <div className="rescue-nav-distance">{currentStep.distance}m</div>
                          <div className="rescue-nav-distance-label">AHEAD</div>
                        </div>
                      </div>
                      <div className="rescue-nav-instruction">{currentStep.description}</div>
                      {turnInstructions.length > currentStepIdx + 1 && (
                        <div className="rescue-nav-upcoming">
                          {turnInstructions.slice(currentStepIdx + 1, currentStepIdx + 3).map((step, i) => (
                            <div key={i} className="rescue-nav-chip">
                              <span>{TURN_ICONS[step.turn] || '↑'}</span>
                              <span>THEN: {step.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Remaining */}
                <div className="rescue-nav-remaining">TOTAL: {totalRouteDist > 0 ? totalRouteDist : dist}m REMAINING</div>
                <div className="rescue-nav-progress">
                  <div className="rescue-nav-progress-fill" style={{ width: `${totalRouteDist > 0 ? (traveledDist / totalRouteDist) * 100 : 0}%` }} />
                </div>

                {/* Compass */}
                <div className="rescue-compass-wrap">
                  <svg className="rescue-compass" viewBox="0 0 100 100" style={{ transform: `rotate(${bearingDeg}deg)` }}>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                    <text x="50" y="14" textAnchor="middle" fill="#ff6600" fontSize="10" fontFamily="var(--font-jetbrains)">N</text>
                    <text x="90" y="54" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">E</text>
                    <text x="50" y="96" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">S</text>
                    <text x="10" y="54" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10">W</text>
                    <polygon points="50,18 56,38 50,34 44,38" fill="#ff6600" />
                    <polygon points="50,82 56,62 50,66 44,62" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                    <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.3)" />
                  </svg>
                  <div className="rescue-compass-dir">{dirFull(dir)}</div>
                </div>

                {/* Target card */}
                <div className={`rescue-target-card ${target.health < 35 ? 'rescue-target-card--critical' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="rescue-target-label">PRIMARY TARGET</span>
                    <span className={`rescue-priority-badge rescue-priority-badge--${target.priority.toLowerCase()}`}>{target.priority.toUpperCase()}</span>
                  </div>
                  <div className="rescue-survivor-id">SURVIVOR {String(target.id).padStart(2, '0')}</div>
                  <div className="rescue-health-bar">
                    <div className="rescue-health-fill" style={{ width: `${Math.max(0, target.health)}%`, background: healthColor(target.health) }} />
                  </div>
                  <div className="rescue-health-pct" style={{ color: healthColor(target.health) }}>{Math.round(target.health)}%</div>
                  {target.health < 20 && <div className="rescue-critical-warn">⚠ CRITICAL — RESPOND IMMEDIATELY</div>}
                  <div className="rescue-chips">
                    <div className="rescue-chip"><span className="rescue-chip-value">{dist}m</span><span className="rescue-chip-label">DISTANCE</span></div>
                    <div className="rescue-chip"><span className="rescue-chip-value">{eta}</span><span className="rescue-chip-label">ETA</span></div>
                    <div className="rescue-chip"><span className="rescue-chip-value">{target.priority.toUpperCase()}</span><span className="rescue-chip-label">PRIORITY</span></div>
                  </div>
                </div>

                {/* Drone view */}
                <div className="rescue-drone-view">
                  <button className="rescue-drone-toggle" onClick={() => setDroneViewOpen(o => !o)}>
                    <span>DRONE OVERHEAD VIEW</span>
                    <span className={`rescue-drone-toggle-arrow ${droneViewOpen ? 'rescue-drone-toggle-arrow--open' : ''}`}>▼</span>
                  </button>
                  {droneViewOpen && <canvas ref={droneCanvasRef} className="rescue-drone-canvas" />}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ TAB 2 — MAP ═══ */}
        {tab === 'map' && (
          <RescueMap
            survivors={mapSurvivors} dangerZones={mapDangers} evacZone={EVAC_ZONE}
            route={route} dronePos={dronePos} myPos={myPos}
            otherTeams={rescueTeams.filter(t => t.callsign !== callsign).map(t => ({
              callsign: t.callsign, x: 20 + Math.random() * 10, z: -20 - Math.random() * 10,
            }))}
          />
        )}

        {/* ═══ TAB 3 — SURVIVOR ═══ */}
        {tab === 'survivor' && (
          <div className="rescue-survivor-detail">
            {!target ? (
              <div className="rescue-empty">No target assigned</div>
            ) : (
              <>
                {/* Header card */}
                <div className="rescue-survivor-header-card">
                  <div className={`rescue-priority-circle rescue-priority-circle--${target.priority.toLowerCase()}`}>
                    <span className="rescue-priority-letter">{target.priority[0]}</span>
                    <span className="rescue-priority-sublabel">PRIORITY</span>
                  </div>
                  <div className="rescue-header-info">
                    <div className="rescue-header-id">SURVIVOR {String(target.id).padStart(2, '0')}</div>
                    <div className="rescue-header-detection">
                      <span>{target.foundByThermal ? '🌡' : '◎'}</span>
                      <span>Detected via {target.foundByThermal ? 'Thermal' : 'LiDAR'}</span>
                    </div>
                  </div>
                </div>

                {/* Live health */}
                <div className="rescue-live-health">
                  <div className="rescue-health-big" style={{ color: healthColor(target.health) }}>{Math.round(target.health)}%</div>
                  <div className="rescue-health-bar" style={{ margin: '8px 16px' }}>
                    <div className="rescue-health-fill" style={{ width: `${Math.max(0, target.health)}%`, background: healthColor(target.health) }} />
                  </div>
                  <div className="rescue-health-decay">▼ -0.12% every 5 seconds</div>
                </div>

                {/* Health chart */}
                <div className="rescue-section-label">HEALTH TIMELINE</div>
                <div className="rescue-health-chart-wrap">
                  {healthHistory.length > 1 ? (
                    <svg className="rescue-health-chart" viewBox="0 0 280 80" preserveAspectRatio="none">
                      <line x1="0" y1={80 - 35 * 0.7} x2="280" y2={80 - 35 * 0.7} stroke="#ff3333" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="0" y1={80 - 65 * 0.7} x2="280" y2={80 - 65 * 0.7} stroke="#ffcc00" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
                      <path d={`${chartPath} L 280 80 L 0 80 Z`} fill={`${healthColor(target.health)}25`} />
                      <path d={chartPath} fill="none" stroke={healthColor(target.health)} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      {healthHistory.map((h, i) => (
                        <circle key={i} cx={(i / (healthHistory.length - 1)) * 280} cy={80 - h * 0.7} r={i === healthHistory.length - 1 ? 5 : 3} fill={healthColor(target.health)} />
                      ))}
                    </svg>
                  ) : (
                    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains)' }}>Collecting data points…</span>
                    </div>
                  )}
                  <div className="rescue-chart-labels"><span>50s ago</span><span>NOW</span></div>
                </div>

                {/* Survival window */}
                <div className="rescue-survival">
                  <span className="rescue-survival-icon">⏳</span>
                  <div>
                    <div className="rescue-survival-label">SURVIVAL WINDOW</div>
                    <div className="rescue-survival-value" style={{ color: survivalColor(target.health) }}>{estimateSurvivalMinutes(target.health)}</div>
                  </div>
                </div>

                {/* Medical guidance */}
                {medical && (
                  <div className={`rescue-medical rescue-medical--${medical.level}`}>
                    <div className="rescue-medical-icon">{medical.icon}</div>
                    <div className="rescue-medical-title" style={{ color: healthColor(target.health) }}>{medical.title}</div>
                    <div className="rescue-medical-text">{medical.text}</div>
                  </div>
                )}

                {/* Details grid */}
                <div className="rescue-section-label">PHYSICAL DETAILS</div>
                <div className="rescue-details-grid">
                  <div className="rescue-detail-chip"><div className="rescue-detail-chip-label">POSITION</div><div className="rescue-detail-chip-value">X: {target.base.x.toFixed(1)}<br />Z: {target.base.z.toFixed(1)}</div></div>
                  <div className="rescue-detail-chip"><div className="rescue-detail-chip-label">DISTANCE</div><div className="rescue-detail-chip-value">{dist}m from you<br />{Math.round(Math.hypot(target.base.x - EVAC_ZONE.x, target.base.z - EVAC_ZONE.z))}m from evac</div></div>
                  <div className="rescue-detail-chip"><div className="rescue-detail-chip-label">HEALTH TREND</div><div className="rescue-detail-chip-value" style={{ color: target.health < 20 ? 'var(--danger)' : 'var(--warn)' }}>{target.health < 20 ? 'CRITICAL ↓↓' : 'DECLINING ↓'}</div></div>
                  <div className="rescue-detail-chip"><div className="rescue-detail-chip-label">TIME CRITICAL</div><div className="rescue-detail-chip-value">In {estimateSurvivalMinutes(target.health)}</div></div>
                </div>

                {/* Notes from command */}
                <div className="rescue-section-label">NOTES FROM COMMAND</div>
                {broadcasts.length > 0 ? (
                  <div className="rescue-cmd-note">
                    <div className="rescue-cmd-note-header">📡 COMMAND CENTER</div>
                    <div className="rescue-cmd-note-text">{broadcasts[broadcasts.length - 1].message}</div>
                    <div className="rescue-cmd-note-time">{new Date(broadcasts[broadcasts.length - 1].timestamp).toLocaleTimeString()}</div>
                  </div>
                ) : (
                  <div className="rescue-cmd-empty">No messages from command</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ TAB 4 — STATUS ═══ */}
        {tab === 'status' && (
          <div className="rescue-status-section">
            <div className="rescue-status-card">
              <div className="rescue-status-title">MISSION OVERVIEW</div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Total survivors</span><span className="rescue-stat-value">{mission?.survivorsDetected || 0} / {mission?.totalSurvivors || 0}</span></div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Critical</span><span className="rescue-stat-value" style={{ color: 'var(--danger)' }}>{allSurvivors.filter(s => s.health < 35).length}</span></div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Time remaining</span><span className={`rescue-stat-value rescue-stat-value--large ${(mission?.timeRemaining || 999) < 180 ? 'rescue-stat-value--red' : ''}`}>{timeStr}</span></div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Drone battery</span><span className="rescue-stat-value">{Math.round(mission?.battery || 0)}%</span></div>
            </div>
            <div className="rescue-status-card">
              <div className="rescue-status-title">MY STATUS</div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Callsign</span><span className="rescue-stat-value" style={{ color: 'var(--accent)' }}>{callsign}</span></div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Assignment</span><span className="rescue-stat-value">{target ? `Survivor ${String(target.id).padStart(2, '0')}` : '—'}</span></div>
              <div className="rescue-stat-row"><span className="rescue-stat-label">Status</span><span className="rescue-stat-value">{myStatus}</span></div>
              <button className="rescue-change-btn" onClick={changeCallsign}>CHANGE CALLSIGN</button>
              <button className="rescue-theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀ SUNLIGHT MODE' : '🌙 NIGHT MODE'}</button>
            </div>
            <div className="rescue-status-card">
              <div className="rescue-status-title">CONNECTION</div>
              <div className="rescue-conn-row">
                <div className={`rescue-sync-dot rescue-sync-dot--${syncStatus}`} />
                <span className="rescue-conn-text" style={{ color: syncStatus === 'live' ? 'var(--safe)' : syncStatus === 'delayed' ? 'var(--warn)' : 'var(--danger)' }}>
                  {syncStatus === 'live' ? 'CONNECTED' : syncStatus === 'delayed' ? 'DELAYED' : 'OFFLINE'} · Last sync {syncAge}s ago
                </span>
              </div>
              <div className="rescue-conn-note">Data may be up to 30s old when delayed</div>
            </div>
            <div className="rescue-status-card">
              <div className="rescue-status-title">ACTIVE RESCUE TEAMS</div>
              {rescueTeams.length === 0 && <div className="rescue-empty-italic">No teams online</div>}
              {rescueTeams.map(t => (
                <div key={t.callsign} className="rescue-team-row">
                  <span className="rescue-team-cs">{t.callsign}</span>
                  <span className="rescue-team-assign">{t.assignedSurvivor || '—'}</span>
                  <span className={`rescue-team-status rescue-team-status--${t.status.toLowerCase().replace(/\s/g, '')}`}>{t.status}</span>
                </div>
              ))}
            </div>

            {/* Activity Timeline */}
            {statusHistory.length > 0 && (
              <div className="rescue-status-card">
                <div className="rescue-status-title">ACTIVITY TIMELINE</div>
                <div className="rescue-timeline">
                  {statusHistory.slice(0, 10).map((s, i) => {
                    const ago = Math.round((Date.now() - s.timestamp) / 1000);
                    const agoStr = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ${ago % 60}s ago`;
                    return (
                      <div key={i} className="rescue-timeline-item">
                        <div className="rescue-timeline-dot" style={{ background: 'var(--accent)' }} />
                        <div className="rescue-timeline-info">
                          <div className="rescue-timeline-action">{s.action}{s.note ? ` — ${s.note}` : ''}</div>
                          <div className="rescue-timeline-time">{agoStr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rescue-status-card">
              <div className="rescue-status-title">BROADCAST MESSAGES</div>
              {broadcasts.length === 0 && <div className="rescue-empty-italic">No broadcasts</div>}
              {[...broadcasts].reverse().map((b, i) => (
                <div key={i} className="rescue-broadcast-item">
                  <div className="rescue-broadcast-msg">{b.message}</div>
                  <div className="rescue-broadcast-time">{new Date(b.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom tab bar ── */}
      <div className="rescue-tabs">
        {TABS.map(t => (
          <button key={t.id} id={`tab-${t.id}`} className={`rescue-tab rescue-tab--${tab === t.id ? 'active' : 'inactive'}`} onClick={() => setTab(t.id)}>
            <span className="rescue-tab-icon">
              {t.icon}
              {t.id === 'status' && unreadAlerts > 0 && <span className="rescue-tab-badge" />}
            </span>
            <span className="rescue-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Backup confirmation sheet ── */}
      {showBackupConfirm && (
        <>
          <div className="rescue-sheet-overlay" onClick={() => setShowBackupConfirm(false)} />
          <div className="rescue-backup-sheet">
            <div className="rescue-backup-title">SEND BACKUP REQUEST?</div>
            <div className="rescue-backup-desc">This will alert command center and all available rescue teams immediately.</div>
            <button className="btn-primary" style={{ background: 'var(--danger)', maxWidth: '100%' }} onClick={confirmBackup}>CONFIRM</button>
            <button className="btn-secondary" style={{ maxWidth: '100%' }} onClick={() => setShowBackupConfirm(false)}>CANCEL</button>
          </div>
        </>
      )}

      {/* ── Status report sheet ── */}
      {showStatusSheet && (
        <>
          <div className="rescue-sheet-overlay" onClick={() => setShowStatusSheet(false)} />
          <div className="rescue-sheet">
            <div className="rescue-sheet-handle" />
            <div className="rescue-sheet-title">STATUS REPORT</div>

            <div className="rescue-sheet-section-label">Current situation</div>
            <div className="rescue-sheet-chips">
              {['EN ROUTE', 'ON SITE', 'NEED ASSISTANCE', 'EXTRACTING', 'EXTRACTED', 'BLOCKED', 'MEDICAL EMERGENCY'].map(s => (
                <button key={s} className={`rescue-sheet-chip ${reportSituation === s ? 'rescue-sheet-chip--active' : ''}`} onClick={() => setReportSituation(s)}>{s}</button>
              ))}
            </div>

            <div className="rescue-sheet-section-label">Add note (optional)</div>
            <textarea
              className="rescue-sheet-textarea" rows={3} maxLength={120}
              placeholder="Add situation note (optional)..."
              value={reportNote} onChange={e => setReportNote(e.target.value)}
            />
            <div className="rescue-sheet-counter">{reportNote.length}/120</div>

            <div className="rescue-sheet-section-label">Estimated time</div>
            <div className="rescue-sheet-chips">
              {['5 MIN', '10 MIN', '20 MIN', '30+ MIN'].map(t => (
                <button key={t} className={`rescue-sheet-chip ${reportEta === t ? 'rescue-sheet-chip--active' : ''}`} onClick={() => setReportEta(t)}>{t}</button>
              ))}
            </div>

            <div className="rescue-sheet-section-label">Flag for command</div>
            <div className="rescue-sheet-flags">
              {['Route blocked ahead', 'Additional medical needed', 'Structural instability', 'Hostile conditions'].map(f => (
                <button key={f} className={`rescue-sheet-flag ${reportFlags.includes(f) ? 'rescue-sheet-flag--active' : ''}`}
                  onClick={() => setReportFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}>
                  <span className="rescue-sheet-flag-check">{reportFlags.includes(f) ? '✓' : ''}</span>
                  {f}
                </button>
              ))}
            </div>

            <button className="btn-primary" style={{ maxWidth: '100%', marginTop: 16 }} onClick={submitStatusReport}>SUBMIT REPORT</button>
          </div>
        </>
      )}
    </div>
  );
}

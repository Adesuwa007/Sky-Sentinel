'use client';
import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MissionState, DisasterType, DroneState, Vec2, SwarmDrone } from '../lib/types';
import {
  survivorsData, dangerZones, dangerZonesDetailed, evacuationZone,
  initialSwarmDrones, generateSwarmPaths, generateAutoSearchPath,
  resetSurvivors, recomputePriorities, blockedRoadCells,
  signalDeadZones, regenerateMission, getMissionSeed,
} from '../lib/data';
import { pathSurvivorToEvac } from '../lib/helpers';
import { generatePDFReport } from '../lib/pdfReport';
import Scene from '../components/Scene';
import { Minimap, type LogEntry } from '../components/ui';
import CCTopNav from './CCTopNav';
import CCLeftPanel from './CCLeftPanel';
import CCRightPanel from './CCRightPanel';
import CCMissionComplete from './CCMissionComplete';
import { HotkeyOverlay, ViewportHUD } from './CCOverlays';
import FPVReticle from './FPVReticle';
import './command.css';

function inSignalDeadZone(x: number, z: number): boolean {
  return signalDeadZones.some((d) => Math.hypot(x - d.x, z - d.z) < 14);
}

export default function CommandCenter() {
  /* ─── Core state (mirrors DisasterDroneSimulator) ─── */
  const [missionState, setMissionState] = useState<MissionState>('IDLE');
  const [firstPerson, setFirstPerson] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [disaster, setDisaster] = useState<DisasterType>('earthquake');
  const [scanProgress, setScanProgress] = useState(0);
  const [battery, setBattery] = useState(100);
  const [timeRemaining, setTimeRemaining] = useState(12 * 60);
  const [speed, setSpeed] = useState(0);
  const [dronePos, setDronePos] = useState(new THREE.Vector3(0, 6, 16));
  const [routeSafest, setRouteSafest] = useState<Vec2[]>([]);
  const [routeFastest, setRouteFastest] = useState<Vec2[]>([]);
  const [routeBalanced, setRouteBalanced] = useState<Vec2[]>([]);
  const [aiAdvice, setAiAdvice] = useState('Awaiting mission start.');
  const [replayMode, setReplayMode] = useState(false);
  const [scanningActive, setScanningActive] = useState(false);
  const [thermalVision, setThermalVision] = useState(false);
  const [swarmDrones, setSwarmDrones] = useState<SwarmDrone[]>(initialSwarmDrones);
  const [swarmActive, setSwarmActive] = useState(false);
  const [autoSearchPath] = useState<Vec2[]>(generateAutoSearchPath);
  const [autoSearchIdx, setAutoSearchIdx] = useState(0);
  const [scanRadius, setScanRadius] = useState(0);
  const [missionSummaryOpen, setMissionSummaryOpen] = useState(false);
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'processing' | 'complete'>('idle');
  const [missionReport, setMissionReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [thermalUsedThisMission, setThermalUsedThisMission] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [droneState, setDroneState] = useState<DroneState>('idle');
  const [missionSeed, setMissionSeedState] = useState(getMissionSeed());
  const [scenarioVersion, setScenarioVersion] = useState(0);
  const [missionLog, setMissionLog] = useState<LogEntry[]>([]);
  const [pdfReportLoading, setPdfReportLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const bumpSync = useCallback(() => setSyncVersion(v => v + 1), []);

  /* ─── Polling state ─── */
  const [rescueTeams, setRescueTeams] = useState<{ callsign: string; status: 'EN ROUTE' | 'ON SITE' | 'EXTRACTED'; assignedSurvivor: string | null; lastSeen: number }[]>([]);
  const [dataFresh, setDataFresh] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const missionStartRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState('00:00');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const dronePosRef = useRef(dronePos);
  useEffect(() => { dronePosRef.current = dronePos; }, [dronePos]);

  /* ─── Derived ─── */
  const intelActiveStates: MissionState[] = ['SCANNING', 'AUTO_SEARCH', 'SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'REPLAY', 'AR', 'THERMAL', 'SWARM', 'POINT_CLOUD', 'RECONSTRUCT'];
  const fullIntel = ['SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'REPLAY', 'AR', 'SWARM', 'POINT_CLOUD', 'RECONSTRUCT'].includes(missionState) || (missionState === 'SCANNING' && scanProgress >= 100);
  const scanReveal01 = missionState === 'SCANNING' ? scanProgress / 100 : fullIntel ? 1 : 0;
  const survivorsDetected = intelActiveStates.includes(missionState) ? survivorsData.filter((s) => s.foundByLidar || s.foundByThermal).length : 0;
  const baseSignal = Math.max(28, 100 - Math.round(Math.hypot(dronePos.x, dronePos.z) * 1.4));
  const inDead = inSignalDeadZone(dronePos.x, dronePos.z);
  const signal = inDead ? Math.max(12, Math.min(38, baseSignal - 28)) : baseSignal;

  /* ─── Risk computation ─── */
  const riskLevel = battery < 15 || timeRemaining < 60 ? 'CRITICAL' : battery < 30 || timeRemaining < 180 ? 'HIGH' : survivorsDetected > 0 ? 'MODERATE' : 'LOW';
  const riskFactors: string[] = [];
  if (battery < 25) riskFactors.push('Critical battery level');
  if (timeRemaining < 120) riskFactors.push('Mission time running low');
  if (inDead) riskFactors.push('Drone in signal dead zone');
  if (survivorsData.some(s => s.health < 20 && (s.foundByLidar || s.foundByThermal))) riskFactors.push('Survivor in critical condition');
  if (dangerZones.length > 3) riskFactors.push(`${dangerZones.length} active danger zones`);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const e = Math.floor((Date.now() - missionStartRef.current) / 1000);
    const mm = Math.floor(e / 60).toString().padStart(2, '0');
    const ss = (e % 60).toString().padStart(2, '0');
    setMissionLog((prev) => [...prev.slice(-50), { time: `${mm}:${ss}`, text, type }]);
  }, []);

  /* ─── Elapsed timer ─── */
  useEffect(() => {
    const i = setInterval(() => {
      const e = Math.floor((Date.now() - missionStartRef.current) / 1000);
      setElapsed(`${Math.floor(e / 60).toString().padStart(2, '0')}:${(e % 60).toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(i);
  }, []);

  /* ─── Battery & time drain ─── */
  useEffect(() => {
    const i = setInterval(() => {
      if (missionState === 'IDLE') return;
      setTimeRemaining((v) => Math.max(0, v - 1));
      setBattery((v) => Math.max(0, v - (missionState === 'SCANNING' ? 0.12 : 0.06)));
    }, 1000);
    return () => clearInterval(i);
  }, [missionState]);

  /* ─── Survivor health drain ─── */
  useEffect(() => {
    if (!['SCANNING', 'AUTO_SEARCH', 'DRONE', 'MISSION', 'DRONE_DEPLOY', 'SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM'].includes(missionState)) return;
    const i = setInterval(() => { survivorsData.forEach((s) => { s.health = Math.max(0, s.health - 0.12); }); recomputePriorities(); }, 5000);
    return () => clearInterval(i);
  }, [missionState]);

  /* ─── Swarm movement ─── */
  useEffect(() => {
    if (!swarmActive) return;
    const interval = setInterval(() => {
      setSwarmDrones((prev) => prev.map((d) => {
        if (d.path.length === 0) return d;
        const nextIdx = (d.pathIdx + 1) % d.path.length;
        const target = d.path[nextIdx];
        const newPos = { x: d.pos.x + (target.x - d.pos.x) * 0.08, z: d.pos.z + (target.z - d.pos.z) * 0.08 };
        const arrived = Math.hypot(target.x - newPos.x, target.z - newPos.z) < 0.5;
        return { ...d, pos: newPos, pathIdx: arrived ? nextIdx : d.pathIdx, progress: Math.min(100, d.progress + 0.3) };
      }));
    }, 50);
    return () => clearInterval(interval);
  }, [swarmActive]);

  /* ─── Auto search ─── */
  useEffect(() => {
    if (missionState !== 'AUTO_SEARCH') return;
    const interval = setInterval(() => {
      setAutoSearchIdx((prev) => {
        if (prev >= autoSearchPath.length - 1) {
          survivorsData.forEach((s) => { s.foundByLidar = true; });
          recomputePriorities();
          activateMissionState('SURVIVORS_DETECTED');
          setAiAdvice('Auto search complete. Full area charted — intel unlocked.');
          return prev;
        }
        return prev + 1;
      });
      setScanRadius((prev) => Math.min(40, prev + 0.3));
    }, 200);
    return () => clearInterval(interval);
  }, [missionState, autoSearchPath.length]); // eslint-disable-line

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const onLock = () => setPointerLocked(document.pointerLockElement === wrapRef.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && missionState === 'DRONE') {
        document.exitPointerLock(); setFirstPerson(false); setPointerLocked(false); activateMissionState('MISSION');
      }
      if (e.key === 'Escape' && isFullscreen) { setIsFullscreen(false); return; }
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        setIsFullscreen(v => !v);
      }
      if (e.key === 't' || e.key === 'T') { setThermalVision((v) => !v); setThermalUsedThisMission(true); }
      if (e.key === 'm' || e.key === 'M') setMuted(v => !v);
    };
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerlockchange', onLock); window.removeEventListener('keydown', onKey); };
  }, [missionState, isFullscreen]); // eslint-disable-line

  /* ─── Polling: rescue teams ─── */
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/rescue-teams');
        const data = await res.json();
        setRescueTeams(data.teams || []);
        setDataFresh(true);
      } catch { setDataFresh(false); }
    }, 5000);
    return () => clearInterval(poll);
  }, []);

  /* ─── Build mission payload — shared by periodic and immediate sync ─── */
  const buildMissionPayload = useCallback((overridePhase?: MissionState) => ({
    phase: overridePhase ?? missionState, disasterType: disaster, battery, signal,
    timeRemaining, scanProgress,
    survivorsDetected: survivorsData.filter(s => s.foundByLidar || s.foundByThermal).length,
    totalSurvivors: survivorsData.length,
    droneState: overridePhase === 'DRONE_DEPLOY' ? 'deploying' : overridePhase === 'MISSION' ? 'idle' : droneState,
    thermalActive: thermalVision, swarmActive: overridePhase === 'SWARM' ? true : swarmActive,
    missionSeed,
    routesGenerated: routeSafest.length > 1,
    rescueSimActive: (overridePhase ?? missionState) === 'RESCUE_SIM',
    missionComplete: (overridePhase ?? missionState) === 'COMPLETE',
    aiAdvice,
    missionLog: missionLog.slice(-20),
    riskLevel, riskFactors,
    dronePos: { x: dronePosRef.current.x, y: dronePosRef.current.y, z: dronePosRef.current.z },
    survivors: survivorsData.map(s => ({ ...s })),
    dangerZones: dangerZonesDetailed.map(d => ({ ...d })),
    routes: { safest: routeSafest, fastest: routeFastest, balanced: routeBalanced },
  }), [missionState, disaster, battery, signal, timeRemaining, scanProgress, droneState, thermalVision, swarmActive, missionSeed, routeSafest, routeFastest, routeBalanced, aiAdvice, missionLog, riskLevel, riskFactors, syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Sync mission state to server — reusable function ─── */
  const syncToServer = useCallback(async () => {
    try {
      await fetch('/api/mission-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildMissionPayload()),
      });
    } catch { /* ignore */ }
  }, [buildMissionPayload]);

  /* ─── Fire-and-forget immediate sync (for state transitions) ─── */
  const fireImmediateSync = useCallback((overridePhase?: MissionState) => {
    try {
      fetch('/api/mission-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildMissionPayload(overridePhase)),
      });
    } catch { /* ignore */ }
  }, [buildMissionPayload]);

  /* ─── Polling: sync mission state to server every 1s ─── */
  useEffect(() => {
    syncToServer();
    const poll = setInterval(syncToServer, 1000);
    return () => clearInterval(poll);
  }, [syncToServer]);

  /* ─── Helpers ─── */
  const generateNewScenario = useCallback((seed?: number) => {
    const newSeed = regenerateMission(seed);
    setMissionSeedState(newSeed);
    setScenarioVersion((v) => v + 1);
    setFirstPerson(false); setReplayMode(false); setScanningActive(false); setScanProgress(0);
    setRouteSafest([]); setRouteFastest([]); setRouteBalanced([]);
    setBattery(100); setTimeRemaining(12 * 60); setThermalVision(false); setPointerLocked(false);
    setSwarmActive(false); setSwarmDrones(initialSwarmDrones);
    setMissionSummaryOpen(false); setMissionReport(null); setThermalUsedThisMission(false);
    setScanState('idle'); setDroneState('idle'); setAutoSearchIdx(0); setScanRadius(0);
    setScanKey((k) => k + 1); missionStartRef.current = Date.now(); setMissionLog([]);
    try { document.exitPointerLock(); } catch { /* ignore */ }
    setMissionState('MISSION');
    setAiAdvice(`New scenario generated. Seed: ${newSeed}. Deploy drone when ready.`);
    addLog(`Scenario initialized — Seed: ${newSeed}`, 'system');
  }, [addLog]);

  const onSurvivorFound = useCallback((id: number, source: 'lidar' | 'thermal' = 'lidar') => {
    const s = survivorsData.find((sv) => sv.id === id);
    if (!s) return;
    if (source === 'thermal' && !s.foundByThermal) { s.foundByThermal = true; addLog(`Thermal contact: Survivor #${id}`, 'success'); bumpSync(); }
    if (source === 'lidar' && !s.foundByLidar) { s.foundByLidar = true; addLog(`LiDAR fix: Survivor #${id}`, 'success'); bumpSync(); }
  }, [addLog, bumpSync]);

  const calculateRescuePriority = useCallback(() => {
    const pick = [...survivorsData].sort((a, b) => a.health - b.health)[0];
    setAiAdvice(`AI priority: Survivor #${pick.id} (${pick.priority}) — HP ${Math.round(pick.health)}%`);
    addLog(`Priority target: #${pick.id} — ${pick.priority}`, 'warn');
  }, [addLog]);

  const createEscapePath = useCallback(() => {
    const primary = [...survivorsData].sort((a, b) => a.health - b.health)[0];
    const from = primary.base;
    setRouteSafest(pathSurvivorToEvac(from, evacuationZone, dangerZones, blockedRoadCells, 'safest'));
    setRouteFastest(pathSurvivorToEvac(from, evacuationZone, dangerZones, blockedRoadCells, 'fastest'));
    setRouteBalanced(pathSurvivorToEvac(from, evacuationZone, dangerZones, blockedRoadCells, 'balanced'));
    setAiAdvice(`Routes generated: survivor #${primary.id} → SAFE ZONE.`);
  }, []);

  const generateSummaryReport = useCallback(() => {
    setPdfReportLoading(true);
    addLog('Generating PDF report…', 'system');
    const detected = survivorsData.filter((s) => s.foundByLidar || s.foundByThermal);
    fetch('/api/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disasterType: disaster, survivorsDetected: detected.length, totalSurvivors: survivorsData.length,
        survivors: survivorsData.map((s) => ({ id: s.id, health: s.health, priority: s.priority, hidden: s.hidden, foundByLidar: s.foundByLidar, foundByThermal: s.foundByThermal, behavior: s.behavior, position: s.base })),
        dangerZones: dangerZonesDetailed.map((d) => ({ x: d.x, z: d.z, type: d.type, radius: d.radius })),
        routesSafest: routeSafest.length, routesFastest: routeFastest.length, routesBalanced: routeBalanced.length,
        batteryRemaining: battery, timeRemaining, totalMissionTime: 720, scanComplete: scanProgress >= 100,
        swarmDeployed: swarmActive, thermalUsed: thermalUsedThisMission, missionSeed,
      }),
    }).then((r) => r.json()).then((report) => {
      generatePDFReport(report, { disasterType: disaster, missionSeed, battery, timeRemaining, scanComplete: scanProgress >= 100, thermalUsed: thermalUsedThisMission, swarmDeployed: swarmActive });
      setPdfReportLoading(false); addLog('PDF report downloaded', 'success');
    }).catch(() => { setPdfReportLoading(false); addLog('Report generation failed', 'warn'); });
  }, [disaster, routeSafest, routeFastest, routeBalanced, battery, timeRemaining, scanProgress, swarmActive, thermalUsedThisMission, missionSeed, addLog]);

  function activateMissionState(next: MissionState) {
    if (next === 'ROUTE') {
      createEscapePath(); setMissionState('ROUTE_GENERATED'); addLog('Evacuation routes computed', 'success');
      bumpSync(); fireImmediateSync('ROUTE_GENERATED'); return;
    }
    setMissionState(next);
    if (next === 'MISSION') {
      resetSurvivors(); setFirstPerson(false); setReplayMode(false); setScanningActive(false);
      setScanProgress(0); setRouteSafest([]); setRouteFastest([]); setRouteBalanced([]);
      setBattery(100); setTimeRemaining(720); setDroneState('idle');
      setAiAdvice('Mission armed. Deploy drone when ready.'); addLog('Mission armed', 'system');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'DRONE_DEPLOY') {
      setDroneState('deploying'); setAiAdvice('Deploying drone…'); addLog('Drone deployment initiated', 'system');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'DRONE') {
      setFirstPerson(true); addLog('FPV mode engaged', 'info'); if (wrapRef.current) void wrapRef.current.requestPointerLock();
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'SCANNING') {
      resetSurvivors(); setRouteSafest([]); setRouteFastest([]); setRouteBalanced([]);
      setScanKey(k => k + 1); setScanProgress(0); setScanningActive(true); setScanState('scanning');
      setAiAdvice('LiDAR scanning — mapping terrain.'); addLog('LiDAR scan initiated', 'system');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'PLANNING') {
      calculateRescuePriority(); addLog('AI analyzing rescue priorities', 'system');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'ROUTE_GENERATED') {
      createEscapePath(); addLog('Routes computed', 'success');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'RESCUE_SIM') {
      setAiAdvice('Rescue simulation active.'); addLog('Rescue simulation active', 'warn');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'COMPLETE') {
      setMissionSummaryOpen(true); setReportLoading(true); addLog('Mission complete', 'success');
      const detected = survivorsData.filter((s) => s.foundByLidar || s.foundByThermal);
      fetch('/api/mission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disasterType: disaster, survivorsDetected: detected.length, totalSurvivors: survivorsData.length,
          survivors: survivorsData.map((s) => ({ id: s.id, health: s.health, priority: s.priority, hidden: s.hidden, foundByLidar: s.foundByLidar, foundByThermal: s.foundByThermal, behavior: s.behavior, position: s.base })),
          routesSafest: routeSafest.length, routesFastest: routeFastest.length, routesBalanced: routeBalanced.length,
          batteryRemaining: battery, timeRemaining, totalMissionTime: 720, scanComplete: scanProgress >= 100,
          dangerZonesIdentified: dangerZones.length, swarmDeployed: swarmActive, thermalUsed: thermalUsedThisMission, missionSeed,
        }),
      }).then((r) => r.json()).then((report) => { setMissionReport(report); setReportLoading(false); setAiAdvice(`Mission ${report.missionGrade}-grade.`); })
        .catch(() => { setReportLoading(false); setAiAdvice('Mission complete. AI unavailable.'); });
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'REPLAY') { generateNewScenario(); bumpSync(); return; }
    if (next === 'POINT_CLOUD') {
      setAiAdvice('Point Cloud view.'); addLog('Point Cloud mode', 'system');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'RECONSTRUCT') {
      setAiAdvice('Reconstructing 3D map…'); addLog('Reconstruction initiated', 'system');
      setTimeout(() => {
        setMissionState((prev) => {
          if (prev === 'RECONSTRUCT') { addLog('Reconstruction complete', 'success'); bumpSync(); return 'SURVIVORS_DETECTED'; }
          return prev;
        });
      }, 4000);
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'AUTO_SEARCH') {
      setAutoSearchIdx(0); setScanRadius(0); addLog('Auto search deployed', 'system');
      bumpSync(); fireImmediateSync(next); return;
    }
    if (next === 'SWARM') {
      addLog('Drone swarm deployed', 'system');
      const paths = generateSwarmPaths();
      setSwarmDrones((prev) => prev.map((d, i) => ({ ...d, path: paths[i], pathIdx: 0, status: d.role === 'lidar' ? 'Scanning' : d.role === 'thermal' ? 'Thermal' : 'Mapping', progress: 0 })));
      setSwarmActive(true); setAiAdvice('Swarm coordinating search sectors.');
    }
    // Push state to server immediately on every transition
    bumpSync(); fireImmediateSync(next);
  }

  const onScanDone = () => {
    setScanProgress(100); setScanningActive(false); setScanState('complete');
    survivorsData.forEach((s) => { s.foundByLidar = true; }); recomputePriorities();
    setMissionState('SURVIVORS_DETECTED');
    setAiAdvice(`Scan complete. ${survivorsData.length} contacts mapped.`);
    addLog(`Scan complete — ${survivorsData.length} contacts`, 'success');
    bumpSync(); fireImmediateSync('SURVIVORS_DETECTED');
  };

  const handleAction = (action: string) => {
    if (action === 'START_MISSION') { activateMissionState('MISSION'); return; }
    if (action === 'DEPLOY_DRONE') { activateMissionState('DRONE_DEPLOY'); return; }
    if (action === 'FPV_MODE') {
      if (firstPerson) {
        // Exit FPV
        document.exitPointerLock();
        setFirstPerson(false);
        setPointerLocked(false);
        addLog('Exited FPV mode', 'info');
      } else {
        // Enter FPV
        setFirstPerson(true);
        addLog('FPV mode engaged', 'info');
        if (wrapRef.current) void wrapRef.current.requestPointerLock();
      }
      return;
    }
    if (action === 'LIDAR_SCAN') { activateMissionState('SCANNING'); return; }
    if (action === 'VIEW_POINT_CLOUD') { activateMissionState('POINT_CLOUD'); return; }
    if (action === 'RECONSTRUCT_MAP') { activateMissionState('RECONSTRUCT'); return; }
    if (action === 'THERMAL') { setThermalVision((v) => !v); setThermalUsedThisMission(true); return; }
    if (action === 'AUTO_SEARCH') { activateMissionState('AUTO_SEARCH'); return; }
    if (action === 'DEPLOY_SWARM') { activateMissionState('SWARM'); return; }
    if (action === 'AI_PLANNING') { activateMissionState('PLANNING'); return; }
    if (action === 'GENERATE_ROUTES') { activateMissionState('ROUTE'); return; }
    if (action === 'RESCUE_SIM') { activateMissionState('RESCUE_SIM'); return; }
    if (action === 'OPEN_RESCUE') { window.open('/rescue', '_blank'); return; }
    if (action === 'MISSION_COMPLETE') { activateMissionState('COMPLETE'); return; }
    if (action.startsWith('LOAD_SEED:')) { const s = parseInt(action.split(':')[1]); if (!isNaN(s)) generateNewScenario(s); return; }
  };

  const handleBack = () => {
    if (missionState !== 'IDLE') { setConfirmLeave(true); return; }
    window.location.href = '/';
  };

  const handleBroadcast = async (msg: string) => {
    try {
      await fetch('/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
      addLog(`Broadcast: "${msg}"`, 'system');
    } catch { addLog('Broadcast failed', 'warn'); }
  };
  const PHASE_MAP: Record<string, string> = {
    IDLE: 'STANDBY', MISSION: 'ARMED', DRONE_DEPLOY: 'ARMED', DRONE: 'ARMED',
    SCANNING: 'SCANNING', AUTO_SEARCH: 'SCANNING', POINT_CLOUD: 'SCANNING', RECONSTRUCT: 'SCANNING',
    SURVIVORS_DETECTED: 'PLANNING', PLANNING: 'PLANNING', ROUTE: 'PLANNING', ROUTE_GENERATED: 'PLANNING',
    RESCUE_SIM: 'RESCUE', SWARM: 'RESCUE', THERMAL: 'RESCUE',
    COMPLETE: 'COMPLETE', REPLAY: 'COMPLETE', AR: 'RESCUE',
  };
  const phase = PHASE_MAP[missionState] || 'STANDBY';
  const sigBars = Math.ceil((signal / 100) * 4);
  const batColor = battery > 60 ? '#22c55e' : battery > 25 ? '#f97316' : '#ef4444';

  /* ── Altitude indicator ── */
  const altPct = Math.min(100, (dronePos.y / 80) * 100);
  const altColor = dronePos.y > 60 ? '#eab308' : dronePos.y < 5 ? '#ef4444' : '#00ffc8';
  const altWarning = dronePos.y > 60 ? '⚠ HIGH ALTITUDE' : dronePos.y < 5 ? '⚠ LOW ALTITUDE' : null;

  const gps = `${dronePos.x.toFixed(0)}, ${dronePos.z.toFixed(0)}`;
  const aiRecs = (missionReport as { aiRecommendations?: string[] })?.aiRecommendations || [];

  return (
    <div className="cc-root" ref={wrapRef}>
      {/* Confirm leave dialog */}
      {confirmLeave && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,0,16,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: '24px 32px', borderRadius: 12, border: '1px solid rgba(0,255,200,0.15)', background: 'rgba(10,10,40,0.95)', textAlign: 'center', maxWidth: 380 }}>
            <div style={{ fontSize: 14, color: '#e0e0ff', marginBottom: 8, fontFamily: 'var(--font-space-grotesk)' }}>Leave mission?</div>
            <div style={{ fontSize: 12, color: 'rgba(200,200,255,0.4)', marginBottom: 20 }}>Current state will be saved.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(200,200,255,0.5)', cursor: 'pointer' }}>CANCEL</button>
              <button onClick={() => { window.location.href = '/'; }} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>LEAVE</button>
            </div>
          </div>
        </div>
      )}

      <div className={`cc-topnav-wrap ${isFullscreen ? 'cc-topnav-wrap--hidden' : ''}`}>
        <CCTopNav
          missionState={missionState} muted={muted} onToggleMute={() => setMuted(v => !v)}
          onBack={handleBack} elapsed={elapsed} battery={battery} signal={signal}
          rescueTeamCount={rescueTeams.length} dataFresh={dataFresh}
        />
      </div>

      <div className="cc-body">
        <div className={`cc-left ${isFullscreen ? 'cc-panel--hidden' : ''}`}>
          <CCLeftPanel
            missionState={missionState} disaster={disaster} onSetDisaster={setDisaster}
            droneState={droneState} scanProgress={scanProgress} survivorsDetected={survivorsDetected}
            thermalVision={thermalVision} swarmActive={swarmActive} battery={battery}
            routesReady={routeSafest.length > 1} missionSeed={missionSeed} onAction={handleAction}
            rescueTeams={rescueTeams} survivors={survivorsData} missionLog={missionLog}
            fullIntel={fullIntel} pdfLoading={pdfReportLoading}
            firstPerson={firstPerson}
          />
        </div>

        <div className={`cc-center ${isFullscreen ? 'cc-center--fullscreen' : ''}`}>
          <Canvas
            shadows={{ type: THREE.PCFSoftShadowMap }}
            dpr={[1, 2]}
            gl={{ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
              rendererRef.current = gl;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = thermalVision ? 0.85 : 0.7;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            <color attach="background" args={[thermalVision ? '#050010' : '#000018']} />
            <Suspense fallback={null}>
              <Scene
                missionState={missionState} firstPerson={firstPerson} pointerLocked={pointerLocked}
                replayMode={replayMode || missionState === 'REPLAY'} thermalVision={thermalVision}
                disaster={disaster} scanReveal01={scanReveal01} fullIntel={fullIntel}
                scanProgress={scanProgress} safestPath={routeSafest} fastestPath={routeFastest}
                balancedPath={routeBalanced} swarmDrones={swarmActive ? swarmDrones : []}
                autoSearchPath={autoSearchPath} autoSearchIdx={autoSearchIdx}
                onDronePos={setDronePos} onSpeed={setSpeed}
                onScan={(v) => { if (scanningActive) setScanProgress(v); }}
                onScanDone={onScanDone} onSurvivorFound={onSurvivorFound}
                missionSummaryOpen={missionSummaryOpen} scanKey={scanKey}
                scenarioVersion={scenarioVersion} droneState={droneState}
                onDroneStateChange={(s) => {
                  setDroneState(s);
                  if (s === 'ready') { setAiAdvice('Drone on station — systems online.'); addLog('Drone on station', 'success'); }
                }}
              />
            </Suspense>
          </Canvas>
          <FPVReticle active={firstPerson} />

          {/* Thermal overlays */}
          {thermalVision && (
            <>
              <div className="thermal-scanline" />
              <div className="thermal-noise" />
              <div className="thermal-vignette" />
            </>
          )}
          {scanningActive && <div className="lidar-scan-overlay" />}

          {/* Viewport HUD */}
          <ViewportHUD
            alt={dronePos.y} spd={speed} gps={gps} battery={battery}
            signal={signal} scanProgress={scanProgress} survivorCount={survivorsDetected}
            aiAdvice={aiAdvice}
          />

          {/* Altitude bar */}
          <div className="cc-altitude-bar">
            <div className="cc-altitude-label" style={{ color: altColor }}>{Math.round(dronePos.y)}m</div>
            <div className="cc-altitude-track">
              <div className="cc-altitude-fill" style={{ height: `${altPct}%` }} />
            </div>
            <div className="cc-altitude-label-bottom">ALT</div>
            {altWarning && <div className="cc-altitude-warning" style={{ color: altColor }}>{altWarning}</div>}
          </div>

          {/* Fullscreen toggle button */}
          <button
            className="cc-fullscreen-btn"
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen 3D view (F)'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
          </button>

          {/* Minimap — larger, shifted right */}
          <div className="cc-hud-minimap-lg">
            <Minimap
              dronePos={dronePos} routeSafest={routeSafest} routeFastest={routeFastest}
              routeBalanced={routeBalanced} swarmDrones={swarmActive ? swarmDrones : []}
              thermalVision={thermalVision} autoSearchPath={autoSearchPath}
              autoSearchIdx={autoSearchIdx} scanRadius={scanRadius}
              scanReveal01={scanReveal01} fullIntel={fullIntel}
            />
          </div>

          {/* Route legend */}
          {routeSafest.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 16, left: 12, zIndex: 15,
              padding: '8px 12px', background: 'rgba(10,10,40,0.7)',
              border: '1px solid rgba(0,255,200,0.1)', borderRadius: 8,
              backdropFilter: 'blur(12px)', fontSize: 9, fontFamily: 'var(--font-jetbrains), monospace',
              color: 'rgba(200,200,255,0.4)', display: 'flex', gap: 10, pointerEvents: 'none',
            }}>
              <span><span style={{ color: '#2d86ff' }}>━</span> Safest</span>
              <span><span style={{ color: '#ffd84f' }}>━</span> Fastest</span>
              <span><span style={{ color: '#44cc88' }}>━</span> Balanced</span>
            </div>
          )}

          {/* Mission Complete Modal */}
          <CCMissionComplete
            open={missionSummaryOpen} report={missionReport} loading={reportLoading}
            missionSeed={missionSeed} battery={battery}
            onContinue={() => setMissionSummaryOpen(false)}
            onNewMission={() => generateNewScenario()}
            onReplay={() => generateNewScenario(missionSeed)}
            onExportPDF={generateSummaryReport}
          />
        </div>

        <div className={`cc-right ${isFullscreen ? 'cc-panel--hidden' : ''}`}>
          <CCRightPanel
            swarmDrones={swarmDrones} swarmActive={swarmActive} battery={battery}
            timeRemaining={timeRemaining} riskLevel={riskLevel} riskFactors={riskFactors}
            routeSafest={routeSafest} routeFastest={routeFastest} routeBalanced={routeBalanced}
            aiRecommendations={aiRecs} onBroadcast={handleBroadcast} missionReport={missionReport}
          />
        </div>
      </div>

      {/* Fullscreen floating HUD (shows when top nav is hidden) */}
      {isFullscreen && (
        <div className="cc-fs-hud">
          <div style={{ fontSize: 10, color: '#00ffc8', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '0.1em', marginBottom: 4 }}>
            ⬡ SKYSENTINEL · COMMAND CENTER
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`cc-phase-badge cc-phase--${phase.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: 9 }}>
              <span className="cc-phase-dot" style={{ width: 5, height: 5 }} /> {phase}
            </span>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: batColor }}>
              {Math.round(battery)}%
            </span>
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 12 }}>
              {[1,2,3,4].map(i => <span key={i} style={{ width: 2, height: i * 3, borderRadius: 1, background: i <= sigBars ? '#00ffc8' : 'rgba(255,255,255,0.1)' }} />)}
            </span>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: '#00ffc8' }}>{elapsed}</span>
          </div>
        </div>
      )}

      {/* Fullscreen compress button (fixed top-right) */}
      {isFullscreen && (
        <button
          className="cc-fs-compress-btn"
          onClick={() => setIsFullscreen(false)}
          title="Exit fullscreen (Esc)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffc8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      )}

      <HotkeyOverlay />
    </div>
  );
}

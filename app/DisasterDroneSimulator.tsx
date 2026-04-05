'use client';
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import type { MissionState, DisasterType, DroneState, Vec2, SwarmDrone } from './lib/types';
import { deviceConfig } from './lib/deviceConfig';
import {
  survivorsData,
  dangerZones,
  dangerZonesDetailed,
  evacuationZone,
  initialSwarmDrones,
  generateSwarmPaths,
  generateAutoSearchPath,
  resetSurvivors,
  recomputePriorities,
  blockedRoadCells,
  signalDeadZones,
  regenerateMission,
  getMissionSeed,
} from './lib/data';
import { pathSurvivorToEvac } from './lib/helpers';
import { generatePDFReport } from './lib/pdfReport';
import Scene from './components/Scene';
import { ProgressBar, SideBtn, FPVOverlay, SwarmStatus, Minimap, MissionLog, type LogEntry } from './components/ui';

type AudioLike = { play: () => Promise<void>; pause: () => void };

const silentAudio: AudioLike = {
  play: async () => undefined,
  pause: () => undefined,
};

function useAudio() {
  const audioRef = useRef<{ drone: AudioLike; scan: AudioLike; beep: AudioLike; alarm: AudioLike; complete: AudioLike } | null>(null);
  useEffect(() => {
    audioRef.current = { drone: silentAudio, scan: silentAudio, beep: silentAudio, alarm: silentAudio, complete: silentAudio };
  }, []);
  return audioRef;
}

function useProceduralScanAudio(active: boolean, thermal: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    timerRef.current = window.setInterval(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = thermal ? 'triangle' : 'sine';
      osc.frequency.value = thermal ? 330 : 620;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }, thermal ? 220 : 140);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [active, thermal]);
}

function inSignalDeadZone(x: number, z: number): boolean {
  return signalDeadZones.some((d) => Math.hypot(x - d.x, z - d.z) < 14);
}

export default function DisasterDroneSimulator() {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [missionReport, setMissionReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [thermalUsedThisMission, setThermalUsedThisMission] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(!deviceConfig.isMobile);

  /* ─── PDF report generation state ─── */
  const [pdfReportLoading, setPdfReportLoading] = useState(false);

  /* ─── Drone deployment state ─── */
  const [droneState, setDroneState] = useState<DroneState>('idle');

  /* ─── Mission seed state for procedural gen ─── */
  const [missionSeed, setMissionSeedState] = useState(getMissionSeed());
  const [scenarioVersion, setScenarioVersion] = useState(0);

  /* ─── Mission log ─── */
  const [missionLog, setMissionLog] = useState<LogEntry[]>([]);
  const missionStartRef = useRef(Date.now());

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const elapsed = Math.floor((Date.now() - missionStartRef.current) / 1000);
    const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const ss = (elapsed % 60).toString().padStart(2, '0');
    setMissionLog((prev) => [...prev.slice(-50), { time: `${mm}:${ss}`, text, type }]);
  }, []);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const audio = useAudio();
  useProceduralScanAudio(scanningActive || thermalVision, thermalVision);

  const dronePosRef = useRef(dronePos);
  useEffect(() => { dronePosRef.current = dronePos; }, [dronePos]);

  const intelActiveStates: MissionState[] = ['SCANNING', 'AUTO_SEARCH', 'SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'REPLAY', 'AR', 'THERMAL', 'SWARM', 'POINT_CLOUD', 'RECONSTRUCT'];
  const fullIntel = ['SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'REPLAY', 'AR', 'SWARM', 'POINT_CLOUD', 'RECONSTRUCT'].includes(missionState) || (missionState === 'SCANNING' && scanProgress >= 100);
  const scanReveal01 = missionState === 'SCANNING' ? scanProgress / 100 : fullIntel ? 1 : 0;

  const survivorsDetected = intelActiveStates.includes(missionState)
    ? survivorsData.filter((s) => s.foundByLidar || s.foundByThermal).length
    : 0;

  const baseSignal = Math.max(28, 100 - Math.round(Math.hypot(dronePos.x, dronePos.z) * 1.4));
  const inDead = inSignalDeadZone(dronePos.x, dronePos.z);
  const signal = inDead ? Math.max(12, Math.min(38, baseSignal - 28)) : baseSignal;
  const signalGlitch = inDead;

  const timerText = `${Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:${(timeRemaining % 60).toString().padStart(2, '0')}`;

  /* ─── Generate new scenario ─── */
  const generateNewScenario = useCallback((seed?: number) => {
    const newSeed = regenerateMission(seed);
    setMissionSeedState(newSeed);
    setScenarioVersion((v) => v + 1);

    // Reset all state
    setFirstPerson(false);
    setReplayMode(false);
    setScanningActive(false);
    setScanProgress(0);
    setRouteSafest([]);
    setRouteFastest([]);
    setRouteBalanced([]);
    setBattery(100);
    setTimeRemaining(12 * 60);
    setThermalVision(false);
    setPointerLocked(false);
    setSwarmActive(false);
    setSwarmDrones(initialSwarmDrones);
    setMissionSummaryOpen(false);
    setMissionReport(null);
    setThermalUsedThisMission(false);
    setScanState('idle');
    setDroneState('idle');
    setAutoSearchIdx(0);
    setScanRadius(0);
    setScanKey((k) => k + 1);
    missionStartRef.current = Date.now();
    setMissionLog([]);
    try { document.exitPointerLock(); } catch { /* ignore */ }
    setMissionState('MISSION');
    setAiAdvice(`New scenario generated. Seed: ${newSeed}. Deploy drone when ready.`);
    addLog(`Scenario initialized — Seed: ${newSeed}`, 'system');
    addLog(`${survivorsData.length} survivors, ${dangerZones.length} danger zones`, 'info');
  }, [addLog]);

  useEffect(() => {
    const onLock = () => setPointerLocked(document.pointerLockElement === wrapRef.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && missionState === 'DRONE') {
        document.exitPointerLock(); setFirstPerson(false); setPointerLocked(false); activateMissionState('MISSION');
      }
      if (e.key === 't' || e.key === 'T') { setThermalVision((v) => !v); setThermalUsedThisMission(true); }
    };
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerlockchange', onLock); window.removeEventListener('keydown', onKey); };
  }, [missionState]);

  useEffect(() => {
    const i = window.setInterval(() => {
      if (missionState === 'IDLE') return;
      setTimeRemaining((v) => Math.max(0, v - 1));
      setBattery((v) => Math.max(0, v - (missionState === 'SCANNING' ? 0.12 : 0.06)));
    }, 1000);
    return () => window.clearInterval(i);
  }, [missionState]);

  useEffect(() => {
    if (!['SCANNING', 'AUTO_SEARCH', 'DRONE', 'MISSION', 'DRONE_DEPLOY', 'SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM'].includes(missionState)) return;
    const i = window.setInterval(() => {
      survivorsData.forEach((s) => { s.health = Math.max(0, s.health - 0.12); });
      recomputePriorities();
    }, 5000);
    return () => window.clearInterval(i);
  }, [missionState]);

  useEffect(() => {
    if (!audio.current) return;
    if (missionState !== 'IDLE') void audio.current.drone.play().catch(() => undefined);
    if (missionState === 'SCANNING') void audio.current.scan.play().catch(() => undefined);
    if (missionState !== 'SCANNING') audio.current.scan.pause();
    if (battery < 25) void audio.current.alarm.play().catch(() => undefined);
    if (battery >= 25) audio.current.alarm.pause();
  }, [audio, missionState, battery]);

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
  }, [missionState, autoSearchPath.length]);

  const onSurvivorFound = useCallback((id: number, source: 'lidar' | 'thermal' = 'lidar') => {
    const s = survivorsData.find((sv) => sv.id === id);
    if (!s) return;
    if (source === 'thermal' && !s.foundByThermal) {
      s.foundByThermal = true;
      setAiAdvice(`Heat signature locked: survivor #${id}.`);
      addLog(`Thermal contact: Survivor #${id} — ${Math.round(s.health)}% HP`, 'success');
      return;
    }
    if (source === 'lidar' && !s.foundByLidar) {
      s.foundByLidar = true;
      setAiAdvice(s.hidden ? `LiDAR contact: survivor #${id} (obstructed).` : `LiDAR fix: survivor #${id}.`);
      addLog(`LiDAR fix: Survivor #${id}${s.hidden ? ' (hidden)' : ''} — ${s.priority}`, 'success');
    }
  }, [addLog]);

  const calculateRescuePriority = useCallback(() => {
    const pick = [...survivorsData].sort((a, b) => a.health - b.health)[0];
    const dist = Math.hypot(pick.base.x - evacuationZone.x, pick.base.z - evacuationZone.z);
    const eta = Math.round(dist * 0.55 + (100 - pick.health) * 0.4);
    setAiAdvice(`AI priority: Survivor #${pick.id} (${pick.priority}) — HP ${pick.health}% — est. evac ${eta}s to SAFE ZONE.`);
    addLog(`Priority target: #${pick.id} — ${pick.priority} — ETA ${eta}s`, 'warn');
  }, []);

  const generateSummaryReport = useCallback(() => {
    setPdfReportLoading(true);
    setAiAdvice('Generating PDF mission report…');
    addLog('Generating PDF report…', 'system');
    const detected = survivorsData.filter((s) => s.foundByLidar || s.foundByThermal);
    fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disasterType: disaster,
        survivorsDetected: detected.length,
        totalSurvivors: survivorsData.length,
        survivors: survivorsData.map((s) => ({
          id: s.id, health: s.health, priority: s.priority, hidden: s.hidden,
          foundByLidar: s.foundByLidar, foundByThermal: s.foundByThermal,
          behavior: s.behavior, position: s.base,
        })),
        dangerZones: dangerZonesDetailed.map((d) => ({
          x: d.x, z: d.z, type: d.type, radius: d.radius,
        })),
        routesSafest: routeSafest.length,
        routesFastest: routeFastest.length,
        routesBalanced: routeBalanced.length,
        batteryRemaining: battery,
        timeRemaining,
        totalMissionTime: 12 * 60,
        scanComplete: scanProgress >= 100,
        swarmDeployed: swarmActive,
        thermalUsed: thermalUsedThisMission,
        missionSeed,
      }),
    })
      .then((r) => r.json())
      .then((report) => {
        generatePDFReport(report, {
          disasterType: disaster,
          missionSeed,
          battery,
          timeRemaining,
          scanComplete: scanProgress >= 100,
          thermalUsed: thermalUsedThisMission,
          swarmDeployed: swarmActive,
        });
        setPdfReportLoading(false);
        setAiAdvice('PDF report downloaded successfully.');
        addLog('PDF report downloaded', 'success');
      })
      .catch(() => {
        setPdfReportLoading(false);
        setAiAdvice('PDF report generation failed.');
        addLog('Report generation failed', 'warn');
      });
  }, [disaster, routeSafest, routeFastest, routeBalanced, battery, timeRemaining, scanProgress, swarmActive, thermalUsedThisMission, missionSeed, addLog]);

  const createEscapePath = useCallback(() => {
    const primary = [...survivorsData].sort((a, b) => a.health - b.health)[0];
    const from = primary.base;
    const safest = pathSurvivorToEvac(from, evacuationZone, dangerZones, blockedRoadCells, 'safest');
    const fastest = pathSurvivorToEvac(from, evacuationZone, dangerZones, blockedRoadCells, 'fastest');
    const balanced = pathSurvivorToEvac(from, evacuationZone, dangerZones, blockedRoadCells, 'balanced');
    setRouteSafest(safest);
    setRouteFastest(fastest);
    setRouteBalanced(balanced);
    const dist = Math.round(Math.hypot(from.x - evacuationZone.x, from.z - evacuationZone.z));
    setAiAdvice(`Routes: survivor #${primary.id} → SAFE ZONE (${dist}m). Safest ${safest.length} / Fastest ${fastest.length} / Balanced ${balanced.length} waypoints.`);
  }, []);

  function activateMissionState(next: MissionState) {
    if (next === 'ROUTE') {
      createEscapePath();
      setReplayMode(false);
      setMissionState('ROUTE_GENERATED');
      setAiAdvice('Routes generated: survivor → SAFE ZONE (evacuation).');
      return;
    }
    setMissionState(next);
    if (next === 'MISSION') {
      resetSurvivors();
      setFirstPerson(false);
      setReplayMode(false);
      setScanningActive(false);
      setScanProgress(0);
      setRouteSafest([]);
      setRouteFastest([]);
      setRouteBalanced([]);
      setBattery(100);
      setTimeRemaining(12 * 60);
      setDroneState('idle');
      setAiAdvice('Mission armed. Deploy drone when ready.');
      addLog('Mission armed — awaiting deployment', 'system');
      return;
    }
    if (next === 'DRONE_DEPLOY') {
      setDroneState('deploying');
      setAiAdvice('Deploying drone — entering disaster zone…');
      addLog('Drone deployment initiated — inbound to AO', 'system');
      return;
    }
    if (next === 'DRONE') { setFirstPerson(true); addLog('FPV mode engaged', 'info'); if (wrapRef.current) void wrapRef.current.requestPointerLock(); return; }
    if (next === 'SCANNING') {
      // Always reset scan state so LiDAR can be re-run any number of times
      resetSurvivors();
      setRouteSafest([]);
      setRouteFastest([]);
      setRouteBalanced([]);
      setScanKey(k => k + 1);
      setScanProgress(0);
      setScanningActive(true);
      setScanState('scanning');
      setAiAdvice('LiDAR scanning — mapping unknown terrain.');
      addLog('LiDAR scan initiated — mapping terrain', 'system');
      return;
    }
    if (next === 'PLANNING') { calculateRescuePriority(); addLog('AI analyzing rescue priorities', 'system'); return; }
    if (next === 'ROUTE_GENERATED') { createEscapePath(); addLog('Evacuation routes computed', 'success'); return; }
    if (next === 'RESCUE_SIM') { setAiAdvice('Rescue teams simulating extraction along balanced route…'); addLog('Rescue simulation active', 'warn'); return; }
    if (next === 'COMPLETE') {
      setMissionSummaryOpen(true);
      setAiAdvice('Mission complete. Generating AI analysis report…');
      addLog('Mission complete — generating report', 'success');
      void audio.current?.complete.play().catch(() => undefined);
      // Fetch AI mission analysis from backend API
      setReportLoading(true);
      const detected = survivorsData.filter((s) => s.foundByLidar || s.foundByThermal);
      fetch('/api/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disasterType: disaster,
          survivorsDetected: detected.length,
          totalSurvivors: survivorsData.length,
          survivors: survivorsData.map((s) => ({
            id: s.id, health: s.health, priority: s.priority, hidden: s.hidden,
            foundByLidar: s.foundByLidar, foundByThermal: s.foundByThermal,
            behavior: s.behavior, position: s.base,
          })),
          routesSafest: routeSafest.length,
          routesFastest: routeFastest.length,
          routesBalanced: routeBalanced.length,
          batteryRemaining: battery,
          timeRemaining,
          totalMissionTime: 12 * 60,
          scanComplete: scanProgress >= 100,
          dangerZonesIdentified: dangerZones.length,
          swarmDeployed: swarmActive,
          thermalUsed: thermalUsedThisMission,
          missionSeed,
        }),
      })
        .then((r) => r.json())
        .then((report) => {
          setMissionReport(report);
          setReportLoading(false);
          setAiAdvice(`Mission ${report.missionGrade}-grade. ${report.summary}`);
        })
        .catch(() => {
          setReportLoading(false);
          setAiAdvice('Mission complete. AI analysis unavailable.');
        });
      return;
    }
    if (next === 'REPLAY') {
      // Generate a completely new scenario
      generateNewScenario();
      return;
    }
    if (next === 'AR') {
      setAiAdvice('AR mode: use ENTER AR on canvas (WebXR). Evacuation routes stay visible in scene.');
      return;
    }
    if (next === 'POINT_CLOUD') {
      setAiAdvice('Point Cloud view — environment hidden. Showing raw LiDAR data only.');
      addLog('Point Cloud mode — viewing raw scan data', 'system');
      return;
    }
    if (next === 'RECONSTRUCT') {
      setAiAdvice('Reconstructing 3D map from point cloud data…');
      addLog('Map reconstruction initiated from point cloud', 'system');
      // Auto-transition back to SURVIVORS_DETECTED after reconstruction completes
      setTimeout(() => {
        setMissionState((prev) => {
          if (prev === 'RECONSTRUCT') {
            setAiAdvice('Reconstruction complete. Full 3D environment restored from scan data.');
            addLog('3D reconstruction complete — environment restored', 'success');
            return 'SURVIVORS_DETECTED';
          }
          return prev;
        });
      }, 4000);
      return;
    }
    if (next === 'AUTO_SEARCH') { setAutoSearchIdx(0); setScanRadius(0); setAiAdvice('Auto search grid active.'); addLog('Auto search grid deployed', 'system'); return; }
    if (next === 'SWARM') {
      addLog('Drone swarm deployed — 3 units', 'system');
      const paths = generateSwarmPaths();
      setSwarmDrones((prev) => prev.map((d, i) => ({
        ...d,
        path: paths[i],
        pathIdx: 0,
        status: d.role === 'lidar' ? 'Scanning' : d.role === 'thermal' ? 'Thermal Search' : 'Mapping',
        progress: 0,
      })));
      setSwarmActive(true);
      setAiAdvice('Swarm coordinating search sectors.');
    }
  }

  const requestPointerLock = useCallback(() => {
    if (missionState !== 'DRONE' || !wrapRef.current) return;
    void wrapRef.current.requestPointerLock();
  }, [missionState]);

  const onScanDone = () => {
    setScanProgress(100);
    setScanningActive(false);
    setScanState('complete');
    survivorsData.forEach((s) => { s.foundByLidar = true; });
    recomputePriorities();
    setMissionState('SURVIVORS_DETECTED');
    setAiAdvice(`Scan complete. ${survivorsData.length} contacts mapped. Intel unlocked.`);
    void audio.current?.beep.play().catch(() => undefined);
  };

  useEffect(() => {
    if (missionState !== 'AR' || !rendererRef.current) return;
    if (document.getElementById('ar-enter-button')) return;
    const btn = ARButton.createButton(rendererRef.current, { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: document.body } });
    btn.id = 'ar-enter-button'; btn.style.cssText = 'position:fixed;right:20px;bottom:20px'; btn.textContent = 'ENTER AR';
    document.body.appendChild(btn);
  }, [missionState]);

  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.toneMappingExposure = thermalVision ? 0.85 : 0.7;
  }, [thermalVision]);

  return (
    <div ref={wrapRef} onClick={requestPointerLock}
      style={{ height: '100vh', width: '100vw', background: thermalVision ? '#050010' : '#000018', color: '#fff', display: 'flex', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative' }}>
      {missionSummaryOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,8,20,0.82)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              maxWidth: 520,
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '24px 28px',
              borderRadius: 12,
              border: '1px solid rgba(50,220,180,0.35)',
              background: 'linear-gradient(165deg, rgba(6,24,32,0.95), rgba(4,12,22,0.98))',
              boxShadow: '0 0 40px rgba(0,200,180,0.12)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 3, color: '#33ccb0', fontFamily: 'monospace' }}>SKY SENTINEL</div>
                <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#e8f4ff' }}>AI Mission Report</h2>
              </div>
              {missionReport && (
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
                  background: missionReport.missionGrade === 'S' ? 'rgba(68,255,144,0.2)' : missionReport.missionGrade === 'A' ? 'rgba(0,200,255,0.2)' : 'rgba(255,200,70,0.2)',
                  border: `2px solid ${missionReport.missionGrade === 'S' ? '#44ff90' : missionReport.missionGrade === 'A' ? '#00ccff' : '#ffcc44'}`,
                  color: missionReport.missionGrade === 'S' ? '#44ff90' : missionReport.missionGrade === 'A' ? '#00ccff' : '#ffcc44',
                }}>
                  {missionReport.missionGrade}
                </div>
              )}
            </div>

            {reportLoading && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#4a8fa8', fontFamily: 'monospace', fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}>Analysing mission data…</div>
                <div style={{ width: 120, height: 2, margin: '0 auto', background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #00aaff, #00ffcc)', animation: 'loadPulse 1s ease-in-out infinite alternate' }} />
                </div>
              </div>
            )}

            {missionReport && !reportLoading && (
              <>
                {/* Summary */}
                <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.6, color: '#8aa8b8' }}>{missionReport.summary}</p>

                {/* Risk + Survivor row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#4a6a7a', letterSpacing: 1, fontFamily: 'monospace', marginBottom: 4 }}>RISK LEVEL</div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
                      color: missionReport.riskAssessment.level === 'CRITICAL' ? '#ff4444' : missionReport.riskAssessment.level === 'HIGH' ? '#ff8844' : missionReport.riskAssessment.level === 'MODERATE' ? '#ffcc44' : '#44ff90',
                    }}>
                      {missionReport.riskAssessment.level}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#4a6a7a', letterSpacing: 1, fontFamily: 'monospace', marginBottom: 4 }}>SURVIVORS</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#44ff90', fontFamily: 'monospace' }}>
                      {missionReport.survivorAnalysis.detected}/{missionReport.survivorAnalysis.total}
                      <span style={{ fontSize: 10, color: '#556677', marginLeft: 4 }}>
                        ({missionReport.survivorAnalysis.criticalCount} critical)
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#4a6a7a', letterSpacing: 1, fontFamily: 'monospace', marginBottom: 4 }}>AVG HEALTH</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: missionReport.survivorAnalysis.avgHealth < 40 ? '#ff5555' : '#aaddff', fontFamily: 'monospace' }}>
                      {missionReport.survivorAnalysis.avgHealth}%
                    </div>
                  </div>
                </div>

                {/* Route recommendation */}
                <div style={{ background: 'rgba(0,180,220,0.04)', border: '1px solid rgba(0,180,220,0.1)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: '#4a6a7a', letterSpacing: 1, fontFamily: 'monospace', marginBottom: 4 }}>RECOMMENDED ROUTE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#00ccff', fontFamily: 'monospace' }}>
                    {missionReport.routeAnalysis.recommendedRoute}
                    <span style={{ fontSize: 10, fontWeight: 400, color: '#5a8a9a', marginLeft: 8 }}>
                      — {missionReport.routeAnalysis.reason}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, fontFamily: 'monospace', color: '#4a7a8a' }}>
                    <span>Safest: {missionReport.routeAnalysis.safestWaypoints} pts</span>
                    <span>Fastest: {missionReport.routeAnalysis.fastestWaypoints} pts</span>
                    <span>Balanced: {missionReport.routeAnalysis.balancedWaypoints} pts</span>
                  </div>
                </div>

                {/* AI Recommendations */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: '#4a6a7a', letterSpacing: 1, fontFamily: 'monospace', marginBottom: 6 }}>AI RECOMMENDATIONS</div>
                  {missionReport.aiRecommendations.map((rec: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, lineHeight: 1.5, color: '#7aaab8', marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${i === 0 ? '#ff6644' : '#1a3a4a'}` }}>
                      {rec}
                    </div>
                  ))}
                </div>

                {/* Resource row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, fontSize: 10, fontFamily: 'monospace' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ color: '#3a5a6a', marginBottom: 2 }}>BATTERY</div>
                    <div style={{ color: missionReport.resourceStatus.batteryEfficiency === 'Poor' ? '#ff5555' : '#66ddaa', fontWeight: 600 }}>{missionReport.resourceStatus.batteryEfficiency}</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ color: '#3a5a6a', marginBottom: 2 }}>TIME</div>
                    <div style={{ color: '#66ddaa', fontWeight: 600 }}>{missionReport.resourceStatus.timeEfficiency}</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ color: '#3a5a6a', marginBottom: 2 }}>SCAN</div>
                    <div style={{ color: '#66ddaa', fontWeight: 600 }}>{missionReport.resourceStatus.scanCoverage}</div>
                  </div>
                </div>

                {/* Mission ID */}
                <div style={{ fontSize: 9, color: '#1e3040', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 12 }}>
                  REPORT {missionReport.id} · SEED {missionSeed} · {new Date(missionReport.timestamp).toLocaleString()}
                </div>
              </>
            )}

            {/* Fallback if no report yet and not loading */}
            {!missionReport && !reportLoading && (
              <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.55, color: '#8aa8b8' }}>
                All mapped survivors have routed evacuation plans. Emergency teams have simulated handoff at the western exit corridor.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setMissionSummaryOpen(false)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid rgba(80,200,255,0.4)',
                  background: 'rgba(0,120,160,0.25)', color: '#aef0ff',
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                }}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => generateNewScenario()}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid rgba(180,100,255,0.35)',
                  background: 'rgba(40,20,60,0.4)', color: '#ddbbff',
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                }}
              >
                New Mission
              </button>
              <button
                type="button"
                onClick={() => generateNewScenario(missionSeed)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid rgba(100,180,100,0.35)',
                  background: 'rgba(20,40,20,0.4)', color: '#bbffbb',
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                }}
              >
                Replay Mission
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0 }}>
        <Canvas
          shadows={{ type: deviceConfig.useSoftShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap }}
          dpr={deviceConfig.dpr}
          frameloop={deviceConfig.targetFPS > 0 ? 'demand' : 'always'}
          gl={{ antialias: !deviceConfig.isMobile, alpha: deviceConfig.isMobile, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            rendererRef.current = gl;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = thermalVision ? 0.85 : 0.7;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = deviceConfig.useSoftShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
            if (deviceConfig.enableXR) {
              gl.xr.enabled = true;
            }
          }}
        >
          <color attach="background" args={[thermalVision ? '#050010' : '#000018']} />
          <Suspense fallback={null}>
            <Scene
              missionState={missionState}
              firstPerson={firstPerson}
              pointerLocked={pointerLocked}
              replayMode={replayMode || missionState === 'REPLAY'}
              thermalVision={thermalVision}
              disaster={disaster}
              scanReveal01={scanReveal01}
              fullIntel={fullIntel}
              scanProgress={scanProgress}
              safestPath={routeSafest}
              fastestPath={routeFastest}
              balancedPath={routeBalanced}
              swarmDrones={swarmActive ? swarmDrones : []}
              autoSearchPath={autoSearchPath}
              autoSearchIdx={autoSearchIdx}
              onDronePos={setDronePos}
              onSpeed={setSpeed}
              onScan={(v) => { if (scanningActive) setScanProgress(v); }}
              onScanDone={onScanDone}
              onSurvivorFound={onSurvivorFound}
              missionSummaryOpen={missionSummaryOpen}
              scanKey={scanKey}
              scenarioVersion={scenarioVersion}
              droneState={droneState}
              onDroneStateChange={(s) => {
                setDroneState(s);
                if (s === 'ready') {
                  setAiAdvice('Drone on station — hovering at center. LiDAR, Thermal, and AI Planning now available.');
                  addLog('Drone on station — systems online', 'success');
                }
              }}
            />
          </Suspense>
        </Canvas>
        {/* Thermal camera overlays — scan line, noise grain, vignette */}
        {thermalVision && (
          <>
            <div className="thermal-scanline" />
            <div className="thermal-noise" />
            <div className="thermal-vignette" />
          </>
        )}
        {/* LiDAR scan overlay — subtle grid lines */}
        {scanningActive && <div className="lidar-scan-overlay" />}
        {firstPerson && !missionSummaryOpen && (
          <FPVOverlay
            dronePos={dronePos}
            speed={speed}
            battery={battery}
            signal={signal}
            signalGlitch={signalGlitch}
            survivorsDetected={survivorsDetected}
            scanProgress={scanProgress}
            missionState={missionState}
            thermalVision={thermalVision}
            timeText={timerText}
          />
        )}
      </div>

      {/* ── Mobile floating HUD (visible when sidebar is closed) ── */}
      {deviceConfig.isMobile && !sidebarOpen && !missionSummaryOpen && (
        <div style={{
          position: 'fixed', top: 12, left: 12, zIndex: 35,
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(4,14,28,0.88)', border: '1px solid rgba(0,180,220,0.2)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          fontFamily: 'monospace', fontSize: 10, color: '#6a9aaa', lineHeight: 1.8,
        }}>
          <div style={{ color: '#33ddf5', fontWeight: 700, letterSpacing: 2, marginBottom: 2, fontSize: 9 }}>⬡ SKY SENTINEL</div>
          <div>State: <span style={{ color: '#33ddf5', fontWeight: 600 }}>{missionState}</span></div>
          <div>Battery: <span style={{ color: battery < 25 ? '#ff5555' : '#22ccff' }}>{Math.round(battery)}%</span></div>
          <div>Scan: <span style={{ color: '#44ffbb' }}>{Math.round(scanProgress)}%</span></div>
          <div>Survivors: <span style={{ color: survivorsDetected ? '#44ff90' : '#445566' }}>{survivorsDetected}/{survivorsData.length}</span></div>
          <div>Time: <span style={{ color: timeRemaining < 120 ? '#ff5555' : '#8abbcc' }}>{timerText}</span></div>
          {thermalVision && <div style={{ color: '#ff8844' }}>🌡 THERMAL</div>}
        </div>
      )}

      {/* ── Mobile sidebar toggle button ── */}
      {deviceConfig.isMobile && (
        <button
          onClick={() => setSidebarOpen(v => !v)}
          style={{
            position: 'fixed', top: 12, right: sidebarOpen ? 332 : 12, zIndex: 45,
            width: 44, height: 44, borderRadius: 10,
            border: '1px solid rgba(0,180,220,0.35)',
            background: 'rgba(4,14,28,0.9)', color: '#33ddf5',
            fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'right 0.3s ease',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 0 16px rgba(0,200,255,0.12)',
          }}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      )}

      <div className={`sidebar ${thermalVision ? 'sidebar-thermal' : ''}`} style={{
        overflowY: 'auto',
        ...(deviceConfig.isMobile ? {
          position: 'fixed' as const,
          right: 0, top: 0, bottom: 0,
          zIndex: 40,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: sidebarOpen ? '-4px 0 24px rgba(0,0,0,0.5)' : 'none',
        } : {}),
      }}>
        <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${thermalVision ? 'rgba(255,100,50,0.1)' : 'rgba(0,180,220,0.1)'}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: thermalVision ? '#ff8844' : '#33ddf5', letterSpacing: 3, fontFamily: 'monospace' }}>⬡ SKY SENTINEL</div>
          <div style={{ fontSize: 8, color: '#3a4a5a', letterSpacing: 1.5, marginTop: 2 }}>AI DISASTER RESPONSE · DIGITAL TWIN</div>
          <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
            {(['earthquake', 'flood', 'fire'] as DisasterType[]).map((d) => (
              <button key={d} onClick={() => setDisaster(d)} style={{
                flex: 1, padding: '4px 0', borderRadius: 4, border: `1px solid ${disaster === d ? '#33ddf5' : 'rgba(255,255,255,0.06)'}`,
                background: disaster === d ? 'rgba(0,200,220,0.12)' : 'rgba(255,255,255,0.03)',
                color: disaster === d ? '#33ddf5' : '#445566', fontSize: 8, fontWeight: 600, letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase',
              }}>{d}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '8px 14px 0' }}>
          <ProgressBar value={battery} color={battery < 25 ? '#ff5555' : '#22ccff'} label="Battery" />
          <ProgressBar value={scanProgress} color="#44ffbb" label="Scan" />
          <ProgressBar value={signal} color="#aaddff" label="Signal" />
        </div>

        <div className={thermalVision ? 'glass-panel-warm' : 'glass-panel'} style={{ margin: '6px 14px 0', padding: '8px 10px', fontFamily: 'monospace', fontSize: 9, lineHeight: '1.9', color: '#6a9aaa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>State</span><span style={{ color: '#33ddf5', fontWeight: 600 }}>{missionState}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Survivors</span><span style={{ color: survivorsDetected ? '#44ff90' : '#445566' }}>{survivorsDetected} / {survivorsData.length}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Time</span><span style={{ color: timeRemaining < 120 ? '#ff5555' : '#8abbcc' }}>{timerText}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ALT / SPD</span><span style={{ color: '#6a8a9a' }}>{dronePos.y.toFixed(1)}m / {speed.toFixed(1)}km/h</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Seed</span><span style={{ color: '#4a6a7a', fontSize: 8 }}>{missionSeed}</span></div>
          {battery < 25 && <div style={{ color: '#ff4444', marginTop: 2 }}>⚠ LOW BATTERY — RETURN TO BASE</div>}
          {thermalVision && <div style={{ color: '#ff8844', marginTop: 2 }}>🌡 THERMAL IMAGING ACTIVE</div>}
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(0,180,220,0.06)', color: '#4a8fa8', fontSize: 8, lineHeight: 1.5 }}>{aiAdvice}</div>
        </div>

        <MissionLog entries={missionLog} thermalVision={thermalVision} />

        {swarmActive && <div style={{ padding: '0 14px' }}><SwarmStatus drones={swarmDrones} thermalVision={thermalVision} /></div>}

        <div style={{ padding: '0 14px' }}>
          <Minimap
            dronePos={dronePos}
            routeSafest={routeSafest}
            routeFastest={routeFastest}
            routeBalanced={routeBalanced}
            swarmDrones={swarmActive ? swarmDrones : []}
            thermalVision={thermalVision}
            autoSearchPath={autoSearchPath}
            autoSearchIdx={autoSearchIdx}
            scanRadius={scanRadius}
            scanReveal01={scanReveal01}
            fullIntel={fullIntel}
          />
        </div>

        <div style={{ padding: '8px 14px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#334455', letterSpacing: 1, fontFamily: 'monospace', marginBottom: 2 }}>◈ MISSION FLOW</div>
          <SideBtn onClick={() => activateMissionState('MISSION')} color="#22ccff" label="START MISSION" active={missionState === 'MISSION'} />
          <SideBtn onClick={() => activateMissionState('DRONE_DEPLOY')} color="#00aacc" label={droneState === 'deploying' ? 'DEPLOYING…' : droneState === 'ready' || droneState === 'scanning' || droneState === 'mission' ? 'DRONE READY ✓' : 'DEPLOY DRONE'} active={droneState === 'deploying'} disabled={droneState === 'deploying'} />
          <SideBtn onClick={() => missionState === 'DRONE' ? (document.exitPointerLock(), activateMissionState('MISSION')) : activateMissionState('DRONE')}
            color="#6677ff" label={missionState === 'DRONE' ? 'EXIT FPV' : 'DRONE FPV'} active={missionState === 'DRONE'} disabled={droneState === 'idle' || droneState === 'deploying'} />
          <SideBtn onClick={() => activateMissionState('SCANNING')} color="#00ccbb" label="LiDAR SCAN" active={missionState === 'SCANNING'} disabled={droneState !== 'ready' && droneState !== 'scanning' && droneState !== 'mission'} />
          <SideBtn onClick={() => activateMissionState('POINT_CLOUD')} color="#00eeff" label="VIEW POINT CLOUD" active={missionState === 'POINT_CLOUD'} disabled={scanProgress < 100} />
          <SideBtn onClick={() => activateMissionState('RECONSTRUCT')} color="#33ffcc" label="RECONSTRUCT MAP" active={missionState === 'RECONSTRUCT'} disabled={missionState !== 'POINT_CLOUD'} />
          <SideBtn onClick={() => { setThermalVision((v) => !v); setThermalUsedThisMission(true); }} color="#ff6633" label={thermalVision ? 'THERMAL: ON' : 'THERMAL VISION'} active={thermalVision} disabled={droneState === 'idle' || droneState === 'deploying'} />
          <SideBtn onClick={() => activateMissionState('AUTO_SEARCH')} color="#44ffaa" label="AUTO SEARCH" active={missionState === 'AUTO_SEARCH'} disabled={droneState === 'idle' || droneState === 'deploying'} />
          <SideBtn onClick={() => activateMissionState('SWARM')} color="#aa66ff" label="DEPLOY SWARM" active={swarmActive} disabled={droneState === 'idle' || droneState === 'deploying'} />
          <SideBtn onClick={() => activateMissionState('PLANNING')} color="#ffcc22" label="AI PLANNING" disabled={survivorsDetected === 0 || droneState === 'idle' || droneState === 'deploying'} />
          <SideBtn onClick={() => activateMissionState('ROUTE')} color="#2d86ff" label="GENERATE ROUTES" disabled={survivorsDetected === 0} active={missionState === 'ROUTE_GENERATED'} />
          <SideBtn onClick={() => activateMissionState('RESCUE_SIM')} color="#ff88cc" label="RESCUE SIM" disabled={routeBalanced.length < 2} active={missionState === 'RESCUE_SIM'} />
          <SideBtn onClick={generateSummaryReport} color="#00ffaa" label={pdfReportLoading ? 'GENERATING…' : '📄 DOWNLOAD PDF REPORT'} disabled={pdfReportLoading} />
          <SideBtn onClick={() => activateMissionState('COMPLETE')} color="#44ff90" label="MISSION COMPLETE" />
          <SideBtn onClick={() => generateNewScenario()} color="#ff4488" label="⟳ NEW MISSION" />
          <SideBtn onClick={() => activateMissionState('REPLAY')} color="#bb66ff" label="REPLAY" />
          <SideBtn onClick={() => activateMissionState('AR')} color="#33ff99" label="AR VIEW" />
        </div>

        <div style={{ padding: '6px 14px 10px', borderTop: '1px solid rgba(0,180,220,0.06)', fontSize: 8, color: '#1e3040', fontFamily: 'monospace', letterSpacing: 1 }}>
          WASD/QE FLY · SHIFT BOOST · T THERMAL · ESC EXIT
        </div>
      </div>
    </div>
  );
}

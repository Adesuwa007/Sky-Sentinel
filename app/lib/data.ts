import type { Survivor, Vec2, SwarmDrone } from './types';
import {
  generateMissionScenario,
  randomSeed,
  EVAC_ZONE,
  HELIPAD_ZONE,
  AMBULANCE_ZONE,
  type MissionScenario,
  type DangerZone,
} from './proceduralGeneration';

/* ────────────────────────────────────────────────────────
   MISSION SEED — drives all procedural generation
   ──────────────────────────────────────────────────────── */

let currentSeed = randomSeed();
let currentScenario: MissionScenario = generateMissionScenario(currentSeed);

export function getMissionSeed(): number {
  return currentSeed;
}

export function setMissionSeed(seed: number) {
  currentSeed = seed;
  currentScenario = generateMissionScenario(seed);
  applyScenario(currentScenario);
}

export function regenerateMission(seed?: number) {
  const s = seed ?? randomSeed();
  setMissionSeed(s);
  return s;
}

export function getCurrentScenario(): MissionScenario {
  return currentScenario;
}

/* ────────────────────────────────────────────────────────
   MUTABLE RUNTIME DATA
   These arrays/values are updated when a scenario is applied.
   Existing code can keep referencing them directly.
   ──────────────────────────────────────────────────────── */

export const survivorsData: Survivor[] = [];
export const dangerZones: Vec2[] = [];
export const dangerZonesDetailed: DangerZone[] = [];
export const blockedRoadCells: Vec2[] = [];
export const signalDeadZones: Vec2[] = [];
export let initialSwarmDrones: SwarmDrone[] = [];

/** Fixed evacuation/safe zone positions */
export const evacuationZone: Vec2 = EVAC_ZONE;
export const helipadZone: Vec2 = HELIPAD_ZONE;
export const ambulancePickupZone: Vec2 = AMBULANCE_ZONE;

/** @deprecated Use evacuationZone — kept for backward compatibility */
export const safeZone = evacuationZone;

export const pColor: Record<string, string> = { High: '#ff3b3b', Medium: '#ffd84f', Low: '#44ff90' };
export const mapSize = 120;

/* ────────────────────────────────────────────────────────
   APPLY SCENARIO → update mutable arrays
   ──────────────────────────────────────────────────────── */

function applyScenario(scenario: MissionScenario) {
  // Survivors
  survivorsData.length = 0;
  scenario.survivors.forEach((s) => survivorsData.push({ ...s }));

  // Danger zones (Vec2[] for backward compat + detailed)
  dangerZones.length = 0;
  dangerZonesDetailed.length = 0;
  scenario.dangerZones.forEach((d) => {
    dangerZones.push({ x: d.x, z: d.z });
    dangerZonesDetailed.push({ ...d });
  });

  // Blocked roads
  blockedRoadCells.length = 0;
  scenario.blockedRoadCells.forEach((b) => blockedRoadCells.push({ ...b }));

  // Signal dead zones
  signalDeadZones.length = 0;
  scenario.signalDeadZones.forEach((s) => signalDeadZones.push({ ...s }));

  // Swarm drones
  initialSwarmDrones = scenario.swarmDrones.map((d) => ({ ...d, path: [...d.path] }));
}

/* ────────────────────────────────────────────────────────
   RESET + RECOMPUTE
   ──────────────────────────────────────────────────────── */

export function resetSurvivors() {
  survivorsData.length = 0;
  currentScenario.survivors.forEach((s) => survivorsData.push({
    ...s,
    foundByLidar: false,
    foundByThermal: false,
  }));
  recomputePriorities();
}

export function recomputePriorities() {
  const sorted = [...survivorsData].sort((a, b) => a.health - b.health);
  sorted.forEach((s, i) => {
    s.priority = i < Math.max(1, Math.floor(sorted.length * 0.2))
      ? 'High'
      : i < Math.max(3, Math.floor(sorted.length * 0.55))
        ? 'Medium'
        : 'Low';
  });
}

/* ────────────────────────────────────────────────────────
   SWARM / SEARCH PATH GENERATION
   (these depend on current survivorsData)
   ──────────────────────────────────────────────────────── */

export function generateSwarmPaths(): Vec2[][] {
  const lidarPath: Vec2[] = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    lidarPath.push({ x: Math.cos(a) * 18, z: Math.sin(a) * 18 });
  }
  const thermalPath: Vec2[] = [];
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      thermalPath.push({ x: col * 8, z: row * 8 });
    }
  }
  const mappingPath: Vec2[] = survivorsData.map((s) => ({ ...s.base }));
  mappingPath.push({ x: evacuationZone.x, z: evacuationZone.z });
  return [lidarPath, thermalPath, mappingPath];
}

export function generateAutoSearchPath(): Vec2[] {
  const pts: Vec2[] = [];
  const step = 8;
  for (let row = -20; row <= 20; row += step) {
    if (((row + 20) / step) % 2 === 0) {
      for (let col = -20; col <= 20; col += step) pts.push({ x: col, z: row });
    } else {
      for (let col = 20; col >= -20; col -= step) pts.push({ x: col, z: row });
    }
  }
  pts.push({ x: 0, z: 16 });
  return pts;
}

/** Optional GLB assets under public/models — loaded if present */
export const envModelFiles = [
  'tree.glb',
  'car.glb',
  'streetlight.glb',
] as const;

/* ────────────────────────────────────────────────────────
   INITIAL BOOT — apply the first scenario
   ──────────────────────────────────────────────────────── */
applyScenario(currentScenario);
recomputePriorities();

/**
 * Procedural Generation Engine for Sky Sentinel
 * ──────────────────────────────────────────────
 * Generates reproducible disaster scenarios from a numeric seed.
 * Every call with the same seed yields the same map layout.
 */

import type { Survivor, Vec2, SwarmDrone, SurvivorBehavior, Priority } from './types';

/* ────────────────────────────────────────────────────────
   SEEDED PRNG (Mulberry32 – fast, 32-bit, period ≈ 2³²)
   ──────────────────────────────────────────────────────── */

export function createRNG(seed: number) {
  let s = seed | 0;
  return {
    /** Returns a float in [0, 1). */
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Returns an integer in [min, max]. */
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    /** Returns a float in [min, max). */
    float(min: number, max: number): number {
      return this.next() * (max - min) + min;
    },
    /** Pick a random element from an array. */
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    /** Shuffle array in-place (Fisher–Yates). */
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

export type RNG = ReturnType<typeof createRNG>;

/* ────────────────────────────────────────────────────────
   MAP CONSTANTS
   ──────────────────────────────────────────────────────── */

const MAP_SIZE = 120;
const MAP_HALF = MAP_SIZE / 2;

/** Playable inner region (survivors / danger zones spawn here). */
const INNER_MIN = -28;
const INNER_MAX = 28;

/** Building bounding boxes — survivors must NOT spawn inside these */
const BUILDING_ZONES: { min: Vec2; max: Vec2 }[] = [
  // collapsed building area (roughly centred at origin, 14×12)
  { min: { x: -8, z: -7 }, max: { x: 8, z: 7 } },
];

/** Minimum distance between any two survivors */
const MIN_SURVIVOR_DIST = 5;
/** Minimum distance from a danger zone center */
const MIN_DANGER_DIST = 4;
/** Minimum distance from a blocked road cell */
const MIN_BLOCKED_DIST = 3;

/* ────────────────────────────────────────────────────────
   EVACUATION (fixed — always safe western exit corridor)
   ──────────────────────────────────────────────────────── */

export const EVAC_ZONE: Vec2 = { x: -54, z: 0 };
export const HELIPAD_ZONE: Vec2 = { x: -52, z: -4 };
export const AMBULANCE_ZONE: Vec2 = { x: -52, z: 4 };

/** Minimum distance a danger zone must keep from the evacuation zone. */
const DANGER_EVAC_MIN_DIST = 18;

/* ────────────────────────────────────────────────────────
   COLLISION HELPERS
   ──────────────────────────────────────────────────────── */

function insideBox(p: Vec2, box: { min: Vec2; max: Vec2 }): boolean {
  return p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;
}

function dist2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isValidPosition(
  pos: Vec2,
  buildings: typeof BUILDING_ZONES,
  dangerZones: Vec2[],
  blockedRoads: Vec2[],
  existing: Vec2[],
  minDist: number,
): boolean {
  // Outside inner region?
  if (pos.x < INNER_MIN || pos.x > INNER_MAX || pos.z < INNER_MIN || pos.z > INNER_MAX) return false;
  // Inside building?
  if (buildings.some((b) => insideBox(pos, b))) return false;
  // Too close to danger zone?
  if (dangerZones.some((d) => dist2D(pos, d) < MIN_DANGER_DIST)) return false;
  // Too close to blocked road?
  if (blockedRoads.some((b) => dist2D(pos, b) < MIN_BLOCKED_DIST)) return false;
  // Too close to another placed entity?
  if (existing.some((e) => dist2D(pos, e) < minDist)) return false;
  return true;
}

/* ────────────────────────────────────────────────────────
   1. RANDOM DANGER ZONES
   ──────────────────────────────────────────────────────── */

export interface DangerZone extends Vec2 {
  radius: number;           // visual radius (varies 3.5 – 7)
  type: 'fire' | 'collapse' | 'flood';
}

export function generateRandomDangerZones(rng: RNG, count = 3): DangerZone[] {
  const zones: DangerZone[] = [];
  const types: DangerZone['type'][] = ['fire', 'collapse', 'flood'];
  let attempts = 0;

  while (zones.length < count && attempts < 300) {
    attempts++;
    const candidate: Vec2 = {
      x: rng.float(INNER_MIN + 2, INNER_MAX - 2),
      z: rng.float(INNER_MIN + 2, INNER_MAX - 2),
    };

    // Must not be inside a building
    if (BUILDING_ZONES.some((b) => insideBox(candidate, b))) continue;
    // Must keep away from evacuation zone
    if (dist2D(candidate, EVAC_ZONE) < DANGER_EVAC_MIN_DIST) continue;
    // Must not overlap other danger zones (min 10m apart)
    if (zones.some((z) => dist2D(candidate, z) < 10)) continue;

    zones.push({
      x: candidate.x,
      z: candidate.z,
      radius: rng.float(3.5, 7),
      type: rng.pick(types),
    });
  }
  return zones;
}

/* ────────────────────────────────────────────────────────
   2. RANDOM BLOCKED ROADS
   ──────────────────────────────────────────────────────── */

export function generateRandomBlockedRoads(rng: RNG, dangerZones: Vec2[], count?: number): Vec2[] {
  const n = count ?? rng.int(2, 5);
  const roads: Vec2[] = [];
  let attempts = 0;

  while (roads.length < n && attempts < 200) {
    attempts++;
    const candidate: Vec2 = {
      x: rng.float(INNER_MIN, INNER_MAX),
      z: rng.float(INNER_MIN, INNER_MAX),
    };
    if (BUILDING_ZONES.some((b) => insideBox(candidate, b))) continue;
    if (dist2D(candidate, EVAC_ZONE) < 12) continue;
    if (dangerZones.some((d) => dist2D(candidate, d) < 3)) continue;
    if (roads.some((r) => dist2D(candidate, r) < 6)) continue;
    roads.push(candidate);
  }
  return roads;
}

/* ────────────────────────────────────────────────────────
   3. RANDOM SURVIVORS
   ──────────────────────────────────────────────────────── */

const BEHAVIORS: SurvivorBehavior[] = ['walk', 'sit', 'lie', 'wave', 'hide', 'limp'];

export function generateRandomSurvivors(
  rng: RNG,
  dangerZones: Vec2[],
  blockedZones: Vec2[],
  totalCount?: number,
): Survivor[] {
  const count = totalCount ?? rng.int(5, 8);
  const survivors: Survivor[] = [];
  const positions: Vec2[] = [];
  let attempts = 0;

  // Phase 1: Generate positions
  while (positions.length < count && attempts < 500) {
    attempts++;
    const candidate: Vec2 = {
      x: rng.float(INNER_MIN + 1, INNER_MAX - 1),
      z: rng.float(INNER_MIN + 1, INNER_MAX - 1),
    };
    if (!isValidPosition(candidate, BUILDING_ZONES, dangerZones, blockedZones, positions, MIN_SURVIVOR_DIST)) continue;
    positions.push(candidate);
  }

  // Phase 2: Assign health + build survivor objects
  const healthValues: number[] = [];
  for (let i = 0; i < positions.length; i++) {
    healthValues.push(rng.float(12, 88));
  }

  // GUARANTEE: At least one survivor is far from evac zone (≥ 30m)
  // so pathfinding is meaningful
  let hasFarSurvivor = positions.some((p) => dist2D(p, EVAC_ZONE) >= 30);
  if (!hasFarSurvivor && positions.length > 0) {
    // Move the last survivor far from evac
    let farAttempts = 0;
    while (farAttempts < 100) {
      farAttempts++;
      const candidate: Vec2 = {
        x: rng.float(10, INNER_MAX - 2),
        z: rng.float(INNER_MIN + 2, INNER_MAX - 2),
      };
      if (dist2D(candidate, EVAC_ZONE) >= 30 &&
          isValidPosition(candidate, BUILDING_ZONES, dangerZones, blockedZones,
            positions.slice(0, -1), MIN_SURVIVOR_DIST)) {
        positions[positions.length - 1] = candidate;
        hasFarSurvivor = true;
        break;
      }
    }
  }

  // Phase 3: Assign priorities to maintain balance
  // Sort by health low → high
  const indexed = healthValues.map((h, i) => ({ h, i }));
  indexed.sort((a, b) => a.h - b.h);

  const priorities: Priority[] = new Array(positions.length);
  // Guarantee: at least 1 High, 2 Medium, 2 Low
  indexed.forEach((entry, rank) => {
    if (rank < Math.max(1, Math.floor(positions.length * 0.2))) {
      priorities[entry.i] = 'High';
    } else if (rank < Math.max(3, Math.floor(positions.length * 0.55))) {
      priorities[entry.i] = 'Medium';
    } else {
      priorities[entry.i] = 'Low';
    }
  });

  // Build final survivor list
  for (let i = 0; i < positions.length; i++) {
    const behavior = rng.pick(BEHAVIORS);
    survivors.push({
      id: i + 1,
      base: positions[i],
      health: Math.round(healthValues[i]),
      priority: priorities[i],
      behavior,
      hidden: behavior === 'hide' || (behavior === 'lie' && rng.next() < 0.5),
      foundByLidar: false,
      foundByThermal: false,
    });
  }

  return survivors;
}

/* ────────────────────────────────────────────────────────
   4. RANDOM DRONE SPAWN POINTS
   ──────────────────────────────────────────────────────── */

export function generateRandomDroneSpawns(rng: RNG, count = 3): Vec2[] {
  const spawns: Vec2[] = [];
  // Drones spawn at edges — safe deployment zone
  for (let i = 0; i < count; i++) {
    const edge = rng.int(0, 3); // 0=north, 1=south, 2=east, 3=west
    let x: number;
    let z: number;
    switch (edge) {
      case 0: x = rng.float(-20, 20); z = rng.float(28, 38); break; // north
      case 1: x = rng.float(-20, 20); z = rng.float(-38, -28); break; // south
      case 2: x = rng.float(28, 38); z = rng.float(-20, 20); break; // east
      default: x = rng.float(-38, -28); z = rng.float(-20, 20); break; // west
    }
    // Ensure drones are spread out
    if (spawns.some((s) => dist2D(s, { x, z }) < 6)) {
      i--; continue;
    }
    spawns.push({ x, z });
  }
  return spawns;
}

export function generateSwarmDrones(rng: RNG): SwarmDrone[] {
  const spawns = generateRandomDroneSpawns(rng, 3);
  const roles: SwarmDrone['role'][] = ['lidar', 'thermal', 'mapping'];
  const names = ['ALPHA', 'BRAVO', 'CHARLIE'];
  const colors = ['#33ddf5', '#ff8844', '#aa66ff'];
  const statuses = ['Standby', 'Thermal Search', 'Mapping'];

  return spawns.map((pos, i) => ({
    id: names[i].toLowerCase(),
    name: names[i],
    color: colors[i],
    role: roles[i],
    status: statuses[i],
    pos,
    path: [] as Vec2[],
    pathIdx: 0,
    progress: 0,
  }));
}

/* ────────────────────────────────────────────────────────
   5. RANDOM SIGNAL DEAD ZONES
   ──────────────────────────────────────────────────────── */

export function generateRandomSignalDeadZones(rng: RNG, count = 2): Vec2[] {
  const zones: Vec2[] = [];
  let attempts = 0;
  while (zones.length < count && attempts < 100) {
    attempts++;
    const candidate: Vec2 = {
      x: rng.float(INNER_MIN, INNER_MAX),
      z: rng.float(INNER_MIN, INNER_MAX),
    };
    if (dist2D(candidate, EVAC_ZONE) < 15) continue;
    if (zones.some((z) => dist2D(candidate, z) < 12)) continue;
    zones.push(candidate);
  }
  return zones;
}

/* ────────────────────────────────────────────────────────
   6. COMPLETE SCENARIO GENERATION
   ──────────────────────────────────────────────────────── */

export interface MissionScenario {
  seed: number;
  dangerZones: DangerZone[];
  blockedRoadCells: Vec2[];
  survivors: Survivor[];
  swarmDrones: SwarmDrone[];
  signalDeadZones: Vec2[];
  droneStartPos: Vec2;
}

export function generateMissionScenario(seed: number): MissionScenario {
  const rng = createRNG(seed);

  // Generate in dependency order
  const dangerZones = generateRandomDangerZones(rng, rng.int(2, 4));
  const blockedRoadCells = generateRandomBlockedRoads(rng, dangerZones);
  const survivors = generateRandomSurvivors(rng, dangerZones, blockedRoadCells);
  const swarmDrones = generateSwarmDrones(rng);
  const signalDeadZones = generateRandomSignalDeadZones(rng);

  // Main drone starts from a random safe edge position
  const droneSpawns = generateRandomDroneSpawns(rng, 1);
  const droneStartPos = droneSpawns[0];

  return {
    seed,
    dangerZones,
    blockedRoadCells,
    survivors,
    swarmDrones,
    signalDeadZones,
    droneStartPos,
  };
}

/** Generate a random seed from the current time + entropy. */
export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

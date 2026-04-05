import * as THREE from 'three';
import type { Vec2 } from './types';
import type { RouteMode } from './types';

export const mapSize = 120;

export function markMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/** GLB buildings / drone / survivors: keep original materials & textures; only shadows + IBL response. */
export function applyGLTFShadowsAndIBL(root: THREE.Object3D, envMapIntensityMin = 0.7) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const mm = m as THREE.MeshStandardMaterial;
        mm.envMapIntensity = envMapIntensityMin;
      }
    });
  });
}

/** Survivors / drone: pick up IBL + ground shadows but do not cast (performance). */
export function applyIBLReceiveNoCast(root: THREE.Object3D, envMapIntensityMin = 0.7) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const mm = m as THREE.MeshStandardMaterial;
        mm.envMapIntensity = envMapIntensityMin;
      }
    });
  });
}

/** Props / debris: receive ground shadows only — avoids hundreds of shadow casters */
export function markMeshesNoShadow(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  });
}

/** Full map coverage: grid spans world [/≈-mapHalf, +mapHalf] in X/Z */
const MAP_HALF = mapSize / 2;
const GRID_RES = 72;
const CELL = mapSize / GRID_RES;

function key(x: number, z: number) {
  return `${x},${z}`;
}

function toGrid(v: Vec2) {
  const gx = Math.floor((v.x + MAP_HALF) / CELL);
  const gz = Math.floor((v.z + MAP_HALF) / CELL);
  return {
    x: Math.max(0, Math.min(GRID_RES - 1, gx)),
    z: Math.max(0, Math.min(GRID_RES - 1, gz)),
  };
}

function toWorld(g: { x: number; z: number }): Vec2 {
  return {
    x: g.x * CELL - MAP_HALF + CELL / 2,
    z: g.z * CELL - MAP_HALF + CELL / 2,
  };
}

function isBlockedCell(cx: number, cz: number, blockedWorld: Vec2[]): boolean {
  const wx = cx * CELL - MAP_HALF + CELL / 2;
  const wz = cz * CELL - MAP_HALF + CELL / 2;
  return blockedWorld.some((b) => Math.hypot(wx - b.x, wz - b.z) < 2.4);
}

function dangerCost(cx: number, cz: number, dangerCenters: Vec2[]): number {
  const wx = cx * CELL - MAP_HALF + CELL / 2;
  const wz = cz * CELL - MAP_HALF + CELL / 2;
  let minD = Infinity;
  for (const d of dangerCenters) {
    minD = Math.min(minD, Math.hypot(wx - d.x, wz - d.z));
  }
  if (minD > 8) return 0;
  return Math.max(0, 1 - minD / 8);
}

/**
 * A* with danger weighting and blocked areas.
 * Safest strongly avoids danger; fastest minimizes distance with light danger penalty; balanced is in between.
 */
export function gridPathWeighted(start: Vec2, end: Vec2, dangerCenters: Vec2[], blockedWorld: Vec2[], mode: RouteMode): Vec2[] {
  const dangerMul = mode === 'safest' ? 14 : mode === 'fastest' ? 1.2 : 5.5;
  const s = toGrid(start);
  const e = toGrid(end);
  const sk = key(s.x, s.z);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const open = new Set<string>([sk]);
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[sk, 0]]);
  const fScore = new Map<string, number>([[sk, Math.hypot(e.x - s.x, e.z - s.z)]]);
  while (open.size) {
    let current = '';
    let best = Infinity;
    for (const n of open) {
      const f = fScore.get(n) ?? Infinity;
      if (f < best) {
        best = f;
        current = n;
      }
    }
    if (!current) break;
    const [cx, cz] = current.split(',').map(Number);
    if (cx === e.x && cz === e.z) {
      const out: Vec2[] = [];
      let c = current;
      while (came.has(c)) {
        const [x, z] = c.split(',').map(Number);
        out.push(toWorld({ x, z }));
        c = came.get(c)!;
      }
      return out.reverse();
    }
    open.delete(current);
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= GRID_RES || nz >= GRID_RES) continue;
      if (isBlockedCell(nx, nz, blockedWorld)) continue;
      const nk = key(nx, nz);
      const step = Math.hypot(dx, dz);
      const dang = dangerCost(nx, nz, dangerCenters) * dangerMul;
      const t = (gScore.get(current) ?? 1e9) + step + dang;
      if (t < (gScore.get(nk) ?? 1e9)) {
        came.set(nk, current);
        gScore.set(nk, t);
        fScore.set(nk, t + Math.hypot(e.x - nx, e.z - nz));
        open.add(nk);
      }
    }
  }
  return [];
}

/** Legacy pathfinder — hard-blocks expanded regions around A/B (original behavior). */
export function gridPath(start: Vec2, end: Vec2, blockedA: Vec2[], blockedB: Vec2[]): Vec2[] {
  const blocked: Vec2[] = [];
  blockedA.forEach((b) => {
    const g = toGrid(b);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const nx = g.x + dx;
      const nz = g.z + dz;
      if (nx >= 0 && nz >= 0 && nx < GRID_RES && nz < GRID_RES) blocked.push(toWorld({ x: nx, z: nz }));
    }
  });
  blockedB.forEach((b) => {
    const g = toGrid(b);
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      const nx = g.x + dx;
      const nz = g.z + dz;
      if (nx >= 0 && nz >= 0 && nx < GRID_RES && nz < GRID_RES) blocked.push(toWorld({ x: nx, z: nz }));
    }
  });
  return gridPathWeighted(start, end, [], blocked, 'safest');
}

export function concatPaths(a: Vec2[], b: Vec2[]): Vec2[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const last = a[a.length - 1];
  const first = b[0];
  if (Math.hypot(last.x - first.x, last.z - first.z) < 0.1) return [...a, ...b.slice(1)];
  return [...a, ...b];
}

/** Full rescue path: survivor position → evacuation (single continuous path). */
export function pathSurvivorToEvac(
  survivorPos: Vec2,
  evac: Vec2,
  dangerCenters: Vec2[],
  blockedWorld: Vec2[],
  mode: RouteMode,
): Vec2[] {
  return gridPathWeighted(survivorPos, evac, dangerCenters, blockedWorld, mode);
}

export function worldToMap(v: Vec2) {
  return { x: ((v.x + mapSize / 2) / mapSize) * 100, y: ((v.z + mapSize / 2) / mapSize) * 100 };
}

export function pathToSvg(points: Vec2[]) {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${worldToMap(p).x} ${worldToMap(p).y}`).join(' ');
}

export function heightColor(y: number): THREE.Color {
  if (y < -0.5) return new THREE.Color('#2288ff');
  if (y < 0.5) return new THREE.Color('#22dd88');
  if (y < 1.5) return new THREE.Color('#ffdd22');
  return new THREE.Color('#ff4422');
}


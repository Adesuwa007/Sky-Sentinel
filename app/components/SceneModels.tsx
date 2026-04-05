'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { survivorsData } from '../lib/data';
import { deviceConfig } from '../lib/deviceConfig';
import {
  getRemainingEnvPlacements,
  getStreetlightPlacements,
  getTreePlacements,
} from '../lib/envPlacements';
import { applyGLTFShadowsAndIBL, applyIBLReceiveNoCast, markMeshesNoShadow } from '../lib/helpers';
import { InstancedStreetlights, InstancedTrees } from './InstancedNature';

type LoadStatus = 'loading' | 'ready' | 'missing';

/* ────────────────────────────────────────────────────────
   GLB LOADER CACHE — load each GLB URL once, share across clones
   ──────────────────────────────────────────────────────── */

const glbCache = new Map<string, { scene: THREE.Group; status: LoadStatus }>();
const glbListeners = new Map<string, Array<(result: { scene: THREE.Group | null; status: LoadStatus }) => void>>();

function loadGLBCached(url: string): Promise<{ scene: THREE.Group | null; status: LoadStatus }> {
  const cached = glbCache.get(url);
  if (cached) return Promise.resolve({ scene: cached.scene, status: cached.status });

  return new Promise((resolve) => {
    const existing = glbListeners.get(url);
    if (existing) {
      existing.push(resolve);
      return;
    }
    glbListeners.set(url, [resolve]);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const result = { scene: gltf.scene, status: 'ready' as LoadStatus };
        glbCache.set(url, { scene: gltf.scene, status: 'ready' });
        glbListeners.get(url)?.forEach((cb) => cb(result));
        glbListeners.delete(url);
      },
      undefined,
      () => {
        const result = { scene: null, status: 'missing' as LoadStatus };
        glbListeners.get(url)?.forEach((cb) => cb(result));
        glbListeners.delete(url);
      },
    );
  });
}

function useSafeGLTF(url: string): { scene: THREE.Group | null; status: LoadStatus } {
  const [state, setState] = useState<{ scene: THREE.Group | null; status: LoadStatus }>({
    scene: null,
    status: 'loading',
  });
  useEffect(() => {
    let cancelled = false;
    setState({ scene: null, status: 'loading' });

    const cached = glbCache.get(url);
    if (cached) {
      setState({ scene: cached.scene, status: cached.status });
      return;
    }

    loadGLBCached(url).then((result) => {
      if (!cancelled) setState({ scene: result.scene, status: result.status });
    });

    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

/* ────────────────────────────────────────────────────────
   SEEDED RNG — deterministic placement every render
   ──────────────────────────────────────────────────────── */

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

/* ────────────────────────────────────────────────────────
   MINIMUM DISTANCE CHECK — prevents overlapping
   ──────────────────────────────────────────────────────── */

type Pos2D = { x: number; z: number };

function isTooClose(pos: Pos2D, occupied: Pos2D[], minDist: number): boolean {
  return occupied.some((o) => Math.hypot(pos.x - o.x, pos.z - o.z) < minDist);
}

/* ────────────────────────────────────────────────────────
   BUILDING COLORS — shared palette
   ──────────────────────────────────────────────────────── */

const BLDG_COLORS = [
  '#3a4048', '#454d55', '#353b42', '#4a5058', '#2e3338',
  '#52585e', '#3f4850', '#484e56', '#404448', '#5a5e64',
  '#423a36', '#4e4440', '#3c3632', '#564e4a',
];

/* ════════════════════════════════════════════════════════════════
   CITY BUILDINGS — all buildings generated ONCE via useMemo
   
   Layout:
   • 1 GLB collapsed building at center (or procedural fallback)
   • ~6 damaged buildings in the inner ring (radius 14–26)
   • ~10 intact buildings on the outer ring (radius 30–50)
   • Total: ~17 buildings, well-spaced, never overlapping
   
   Keeps clear lanes for cars/streetlights at x = ±22 corridor
   ════════════════════════════════════════════════════════════════ */

// Reserve positions for cars & streetlights so buildings don't spawn there
const RESERVED_POSITIONS: Pos2D[] = [
  // streetlights at x=±22
  { x: -22, z: -12 }, { x: -22, z: 0 }, { x: -22, z: 12 },
  { x: 22, z: -12 }, { x: 22, z: 0 }, { x: 22, z: 12 },
  // cars
  { x: -8, z: 4 }, { x: 6, z: -18 }, { x: -5, z: -22 }, { x: 18, z: 2 },
];

/*  Inner damaged buildings — placed in a ring around center, avoiding overlap */
const INNER_DAMAGED_BUILDINGS = (() => {
  const r = seededRng(42);
  const occupied: Pos2D[] = [{ x: 0, z: 0 }]; // center reserved for GLB
  // Add reserved positions so buildings don't cover cars/lights
  RESERVED_POSITIONS.forEach((p) => occupied.push(p));

  const candidates: Array<{ x: number; z: number; w: number; h: number; d: number; damage: number }> = [];
  const minDist = 14; // minimum distance between building centers

  // Try to place ~6 damaged buildings in the inner ring
  let attempts = 0;
  while (candidates.length < deviceConfig.innerBuildingCount && attempts < 60) {
    attempts++;
    const angle = r() * Math.PI * 2;
    const radius = 16 + r() * 12; // radius 16–28
    const x = Math.round(Math.cos(angle) * radius);
    const z = Math.round(Math.sin(angle) * radius);

    if (isTooClose({ x, z }, occupied, minDist)) continue;
    if (Math.abs(x) > 48 || Math.abs(z) > 48) continue;

    occupied.push({ x, z });
    candidates.push({
      x, z,
      w: 6 + Math.floor(r() * 6),
      h: 6 + Math.floor(r() * 10),
      d: 6 + Math.floor(r() * 5),
      damage: 0.3 + r() * 0.5,
    });
  }
  return candidates;
})();

/*  Outer intact buildings — city perimeter */
const OUTER_INTACT_BUILDINGS = (() => {
  const r = seededRng(99);
  // Start with all inner + reserved positions
  const occupied: Pos2D[] = [
    { x: 0, z: 0 },
    ...INNER_DAMAGED_BUILDINGS.map((b) => ({ x: b.x, z: b.z })),
    ...RESERVED_POSITIONS,
  ];
  const minDist = 14;

  const candidates: Array<{ x: number; z: number; w: number; h: number; d: number }> = [];

  // Place ~10 outer buildings on perimeter ring
  let attempts = 0;
  while (candidates.length < deviceConfig.outerBuildingCount && attempts < 80) {
    attempts++;
    const angle = r() * Math.PI * 2;
    const radius = 34 + r() * 16; // radius 34–50
    const x = Math.round(Math.cos(angle) * radius);
    const z = Math.round(Math.sin(angle) * radius);

    if (isTooClose({ x, z }, occupied, minDist)) continue;
    if (Math.abs(x) > 55 || Math.abs(z) > 55) continue;

    occupied.push({ x, z });
    candidates.push({
      x, z,
      w: 7 + Math.floor(r() * 6),
      h: 10 + Math.floor(r() * 16),
      d: 7 + Math.floor(r() * 5),
    });
  }
  return candidates;
})();

/* ────────────────────────────────────────────────────────
   PROCEDURAL BUILDINGS — single useMemo, generated once
   ──────────────────────────────────────────────────────── */

function ProceduralCityscape() {
  const group = useMemo(() => {
    const root = new THREE.Group();
    const r = seededRng(77);

    // ── Inner damaged buildings ──
    INNER_DAMAGED_BUILDINGS.forEach((b, idx) => {
      const color = BLDG_COLORS[idx % BLDG_COLORS.length];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.06 });

      const topCut = b.h * (1 - b.damage * 0.4);
      const main = new THREE.Mesh(new THREE.BoxGeometry(b.w, topCut, b.d), mat);
      main.position.set(b.x, topCut / 2, b.z);
      main.castShadow = true;
      main.receiveShadow = true;
      root.add(main);

      // ── Detail elements (desktop only for performance) ──
      if (deviceConfig.enableBuildingDetails) {
        // Fallen wall
        if (b.damage > 0.35) {
          const wallH = b.h * 0.35;
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(b.w * 0.7, wallH, 0.35),
            new THREE.MeshStandardMaterial({
              color: BLDG_COLORS[(idx + 3) % BLDG_COLORS.length],
              roughness: 0.92, metalness: 0.04,
            }),
          );
          wall.position.set(b.x + (r() - 0.5) * 2, wallH * 0.4, b.z + b.d / 2 + 0.3);
          wall.rotation.x = 0.2 + r() * 0.4;
          wall.castShadow = true;
          root.add(wall);
        }

        // Collapsed floor slabs
        if (b.damage > 0.4) {
          const slab = new THREE.Mesh(
            new THREE.BoxGeometry(b.w * (0.4 + r() * 0.3), 0.25, b.d * (0.3 + r() * 0.3)),
            new THREE.MeshStandardMaterial({
              color: BLDG_COLORS[(idx + 5) % BLDG_COLORS.length],
              roughness: 0.95, metalness: 0.03,
            }),
          );
          slab.position.set(b.x + (r() - 0.5) * 2, 0.12 + r() * 1.5, b.z + (r() - 0.5) * 3);
          slab.rotation.set(r() * 0.1, r() * 0.2, r() * 0.15 - 0.07);
          slab.castShadow = true;
          slab.receiveShadow = true;
          root.add(slab);
        }

        // Rubble around building
        const rubbleCount = Math.floor(b.damage * 3) + 1;
        for (let rb = 0; rb < rubbleCount; rb++) {
          const size = 0.4 + r() * 1.2;
          const rubble = new THREE.Mesh(
            new THREE.BoxGeometry(size, size * 0.3, size * 0.6),
            new THREE.MeshStandardMaterial({
              color: BLDG_COLORS[(idx + rb + 7) % BLDG_COLORS.length],
              roughness: 0.96, metalness: 0.02,
            }),
          );
          rubble.position.set(
            b.x + (r() - 0.5) * (b.w + 3),
            size * 0.15,
            b.z + (r() - 0.5) * (b.d + 3),
          );
          rubble.rotation.set(r() * 0.4, r() * Math.PI, r() * 0.3);
          rubble.receiveShadow = true;
          root.add(rubble);
        }

        // Windows on intact faces
        if (topCut > 4) {
          const winMat = new THREE.MeshStandardMaterial({ color: '#0a0e14', roughness: 0.3, metalness: 0.1 });
          const floors = Math.floor(topCut / 3);
          const cols = Math.floor(b.w / 2.5);
          for (let fl = 0; fl < floors; fl++) {
            for (let c = 0; c < cols; c++) {
              if (r() < 0.25) continue;
              const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), winMat);
              win.position.set(b.x - b.w / 2 + 1.2 + c * 2.2, 1.8 + fl * 3, b.z + b.d / 2 + 0.01);
              root.add(win);
            }
          }
        }

        // Rebar on severely damaged
        if (b.damage > 0.5) {
          const rebarMat = new THREE.MeshStandardMaterial({ color: '#3a2218', roughness: 0.65, metalness: 0.7 });
          for (let rb = 0; rb < 2; rb++) {
            const rebar = new THREE.Mesh(
              new THREE.CylinderGeometry(0.04, 0.04, 1.5 + r() * 2, 4),
              rebarMat,
            );
            rebar.position.set(
              b.x + (r() - 0.5) * b.w * 0.5,
              topCut + r() * 1,
              b.z + (r() - 0.5) * b.d * 0.5,
            );
            rebar.rotation.z = (r() - 0.5) * 1;
            root.add(rebar);
          }
        }
      } // end desktop-only details
    });

    // ── Outer intact buildings ──
    OUTER_INTACT_BUILDINGS.forEach((b, idx) => {
      const color = BLDG_COLORS[(idx + 4) % BLDG_COLORS.length];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.1 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);

      // Windows (desktop only)
      if (deviceConfig.enableBuildingDetails) {
        const winMat = new THREE.MeshStandardMaterial({ color: '#0c1018', roughness: 0.3, metalness: 0.1 });
        const floors = Math.floor(b.h / 3);
        const cols = Math.floor(b.w / 2.5);
        for (let fl = 0; fl < floors; fl++) {
          for (let c = 0; c < cols; c++) {
            if (r() < 0.15) continue;
            const litWindow = r() < 0.18;
            const wMat = litWindow
              ? new THREE.MeshStandardMaterial({ color: '#ffeebb', emissive: '#ffcc66', emissiveIntensity: 0.4 })
              : winMat;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.1), wMat);
            win.position.set(b.x - b.w / 2 + 1.2 + c * 2.2, 1.8 + fl * 3, b.z + b.d / 2 + 0.01);
            root.add(win);
          }
        }
      }
    });

    return root;
  }, []);

  return <primitive object={group} />;
}

/* ────────────────────────────────────────────────────────
   COLLAPSED BUILDING GLB — SINGLE model at center only
   Falls back to a single procedural damaged structure
   ──────────────────────────────────────────────────────── */

function CentralCollapsedBuilding() {
  const { scene, status } = useSafeGLTF('/models/collapsed-building.glb');

  const obj = useMemo(() => {
    if (!scene || status !== 'ready') return null;
    const o = clone(scene);
    o.scale.setScalar(2);
    o.position.set(0, 0, 0);
    applyGLTFShadowsAndIBL(o, 0.7);
    return o;
  }, [scene, status]);

  if (status === 'loading') return null;

  // GLB available → single model at center
  if (obj) return <primitive object={obj} />;

  // Fallback → single procedural damaged building at center
  return <CentralBuildingFallback />;
}

function CentralBuildingFallback() {
  const g = useMemo(() => {
    const root = new THREE.Group();
    const r = seededRng(42);
    const mat = new THREE.MeshStandardMaterial({ color: '#3a4048', roughness: 0.88, metalness: 0.06 });

    // Main collapsed structure
    const main = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), mat);
    main.position.set(0, 3, 0);
    main.castShadow = true;
    main.receiveShadow = true;
    root.add(main);

    // Partial upper floor
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3, 7),
      new THREE.MeshStandardMaterial({ color: '#454d55', roughness: 0.9, metalness: 0.04 }),
    );
    upper.position.set(1, 7.5, -1);
    upper.rotation.z = 0.04;
    upper.castShadow = true;
    root.add(upper);

    // Fallen wall
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(9, 4, 0.35),
      new THREE.MeshStandardMaterial({ color: '#353b42', roughness: 0.92, metalness: 0.04 }),
    );
    wall.position.set(1, 1.5, 5.3);
    wall.rotation.x = 0.6;
    wall.castShadow = true;
    root.add(wall);

    // Rubble pile
    for (let i = 0; i < 8; i++) {
      const size = 0.5 + r() * 1.8;
      const rubble = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * 0.35, size * 0.65),
        new THREE.MeshStandardMaterial({
          color: BLDG_COLORS[(i + 2) % BLDG_COLORS.length],
          roughness: 0.96, metalness: 0.02,
        }),
      );
      rubble.position.set((r() - 0.5) * 14, size * 0.17, (r() - 0.5) * 12);
      rubble.rotation.set(r() * 0.3, r() * Math.PI, r() * 0.2);
      rubble.receiveShadow = true;
      root.add(rubble);
    }

    // Rebar sticking out
    const rebarMat = new THREE.MeshStandardMaterial({ color: '#3a2218', roughness: 0.65, metalness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const rebar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2 + r() * 2.5, 4), rebarMat);
      rebar.position.set((r() - 0.5) * 8, 6 + r() * 2, (r() - 0.5) * 6);
      rebar.rotation.z = (r() - 0.5) * 1.2;
      rebar.rotation.x = (r() - 0.5) * 0.4;
      root.add(rebar);
    }

    return root;
  }, []);
  return <primitive object={g} />;
}

/* ────────────────────────────────────────────────────────
   SURVIVORS — GLB clones or capsule fallback
   ──────────────────────────────────────────────────────── */

function SurvivorsGLB({ survivorRefs }: { survivorRefs: React.MutableRefObject<THREE.Object3D[]> }) {
  const { scene, status } = useSafeGLTF('/models/survivor.glb');

  const survivorSnapshot = useMemo(() => {
    return survivorsData.map((s) => ({
      id: s.id,
      base: { ...s.base },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survivorsData.length]);

  const nodes = useMemo(() => {
    const newRefs: THREE.Object3D[] = [];

    if (status === 'loading') {
      survivorRefs.current = newRefs;
      return null;
    }

    const elements = survivorSnapshot.map((s) => {
      let obj: THREE.Object3D;

      if (status === 'ready' && scene) {
        obj = clone(scene);
        obj.scale.setScalar(2);
        obj.userData.defaultSurvivorScale = 2;
        obj.position.set(s.base.x, 0, s.base.z);
        applyIBLReceiveNoCast(obj, 0.7);
      } else {
        obj = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.32, 1.0, 6, 12),
          new THREE.MeshStandardMaterial({ color: '#c9a090', roughness: 0.65 }),
        );
        body.position.y = 0.65;
        (obj as THREE.Group).add(body);
        obj.userData.defaultSurvivorScale = 1;
        obj.position.set(s.base.x, 0, s.base.z);
        applyIBLReceiveNoCast(obj, 0.6);
      }

      newRefs.push(obj);
      return <primitive key={`survivor-${s.id}`} object={obj} />;
    });

    survivorRefs.current = newRefs;
    return elements;
  }, [scene, status, survivorSnapshot, survivorRefs]);

  if (!nodes) return null;
  return <>{nodes}</>;
}

/* ────────────────────────────────────────────────────────
   ENVIRONMENT PLACEHOLDERS (when GLBs are missing)
   ──────────────────────────────────────────────────────── */

function yOffsetForFile(file: string): number {
  if (file.includes('car')) return 0.2;
  if (file.includes('tree')) return 2;
  if (file.includes('street')) return 2.5;
  return 0;
}

function envPlaceholder(file: string, p: { x: number; z: number; s: number; r?: number }, y0: number) {
  const g = new THREE.Group();
  const rv = p.r ?? 0;
  g.rotation.y = rv;
  g.position.set(p.x, y0, p.z);
  const s = p.s;
  if (file.includes('car')) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2 * s, 0.9 * s, 4 * s),
      new THREE.MeshStandardMaterial({ color: '#3a4a62', metalness: 0.45, roughness: 0.55 }),
    );
    body.position.y = 0.45 * s;
    g.add(body);
  } else {
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * s, 0.45 * s, 1 * s),
      new THREE.MeshStandardMaterial({ color: '#6a5c4a', roughness: 0.95 }),
    );
    d.position.y = 0.22 * s;
    g.add(d);
  }
  markMeshesNoShadow(g);
  return g;
}

/* ────────────────────────────────────────────────────────
   ENVIRONMENT FILE GROUP — load GLB and clone for each placement
   ──────────────────────────────────────────────────────── */

function EnvFileGroup({ file, items }: { file: string; items: ReturnType<typeof getRemainingEnvPlacements> }) {
  const url = `/models/${file}`;
  const { scene, status } = useSafeGLTF(url);
  const y0 = yOffsetForFile(file);

  const nodes = useMemo(() => {
    if (status === 'loading') return null;
    if (status === 'ready' && scene) {
      return items.map((p, idx) => {
        const o = clone(scene);
        o.position.set(p.x, y0, p.z);
        o.scale.setScalar(p.s);
        if (p.r) o.rotation.y = p.r;
        markMeshesNoShadow(o);
        return <primitive key={`${file}-${idx}`} object={o} />;
      });
    }
    return items.map((p, idx) => {
      const o = envPlaceholder(file, p, y0);
      return <primitive key={`${file}-${idx}-ph`} object={o} />;
    });
  }, [scene, status, file, items, y0]);

  if (!nodes) return null;
  return <>{nodes}</>;
}

/* ────────────────────────────────────────────────────────
   COMPUTE PLACEMENTS AT MODULE LEVEL (stable references)
   ──────────────────────────────────────────────────────── */

const placementsRest = getRemainingEnvPlacements();
const byFile = new Map<string, typeof placementsRest>();
placementsRest.forEach((p) => {
  const arr = byFile.get(p.file) ?? [];
  // On mobile, cap props per file type for performance
  if (deviceConfig.isMobile && arr.length >= deviceConfig.maxEnvPropsPerFile) return;
  arr.push(p);
  byFile.set(p.file, arr);
});

const treePlacements = getTreePlacements();
const streetPlacements = getStreetlightPlacements();

/* ────────────────────────────────────────────────────────
   MAIN EXPORT — WorldSceneModels
   ──────────────────────────────────────────────────────── */

/** Building, survivors, environment — GLB when present; instanced trees/lights; placeholders if missing. */
export function WorldSceneModels({ survivorRefs }: { survivorRefs: React.MutableRefObject<THREE.Object3D[]> }) {
  return (
    <>
      {/* 1 collapsed building at center (GLB or procedural fallback) */}
      <CentralCollapsedBuilding />
      {/* ~6 inner damaged + ~10 outer intact — generated once via useMemo */}
      <ProceduralCityscape />
      {/* Survivors */}
      <SurvivorsGLB survivorRefs={survivorRefs} />
      {/* Trees & streetlights (instanced for performance) */}
      <InstancedTrees items={treePlacements} />
      <InstancedStreetlights items={streetPlacements} />
      {/* Cars and remaining env props */}
      {Array.from(byFile.entries()).map(([file, items]) => (
        <EnvFileGroup key={file} file={file} items={items} />
      ))}
    </>
  );
}

/* ────────────────────────────────────────────────────────
   DRONE MODEL
   ──────────────────────────────────────────────────────── */

function DroneFallback() {
  const g = useMemo(() => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.35, 1.2),
      new THREE.MeshStandardMaterial({ color: '#4a6a8a', metalness: 0.55, roughness: 0.38 }),
    );
    root.add(body);
    applyIBLReceiveNoCast(root, 0.6);
    return root;
  }, []);
  return <primitive object={g} />;
}

/** Drone body — GLB from `/models/drone.glb` or compact box fallback. */
export function DroneSceneModel({ onLoaded }: { onLoaded: (loaded: boolean) => void }) {
  const { scene, status } = useSafeGLTF('/models/drone.glb');
  const obj = useMemo(() => {
    if (!scene || status !== 'ready') return null;
    const o = clone(scene);
    o.scale.set(1.5, 1.5, 1.5);
    o.position.set(0, -0.42, 0);
    applyIBLReceiveNoCast(o, 0.7);
    return o;
  }, [scene, status]);

  useEffect(() => {
    if (status === 'loading') {
      onLoaded(false);
      return;
    }
    onLoaded(true);
    return () => onLoaded(false);
  }, [onLoaded, status]);

  if (status === 'loading') return null;
  if (status === 'missing' || !obj) return <DroneFallback />;
  return <primitive object={obj} />;
}

'use client';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { deviceConfig } from '../lib/deviceConfig';

const MAX_POINTS = deviceConfig.lidarMaxPoints;
const BATCH = deviceConfig.lidarBatch;
const RAYCAST_BATCH = 12; // rays per frame for raycasting mode

/** Shared point cloud data that persists across component mounts */
export interface PointCloudData {
  positions: Float32Array;
  colors: Float32Array;
  head: number;
}

export function createPointCloudData(): PointCloudData {
  return {
    positions: new Float32Array(MAX_POINTS * 3),
    colors: new Float32Array(MAX_POINTS * 3),
    head: 0,
  };
}

/** Height-based LiDAR coloring — cyan core with height variation */
function lidarColor(y: number): THREE.Color {
  if (y < -0.5) return new THREE.Color('#00aaff');
  if (y < 0.5) return new THREE.Color('#00ffcc');
  if (y < 1.5) return new THREE.Color('#22ffee');
  if (y < 3.0) return new THREE.Color('#44eeff');
  if (y < 5.0) return new THREE.Color('#66ddff');
  return new THREE.Color('#88ccff');
}

/** Cinematic LiDAR point cloud with raycasting support.
 *  When `worldGroup` is provided, rays are cast from the drone onto scene geometry.
 *  Otherwise falls back to randomized procedural points.
 *
 *  `pointCloudRef` — shared data ref to persist points across state changes.
 *  `viewOnly`      — if true, renders stored points without generating new ones. */
export function LidarPoints({
  active,
  droneRef,
  scanKey,
  worldGroup,
  pointCloudRef,
  viewOnly = false,
}: {
  active: boolean;
  droneRef: React.RefObject<THREE.Group | null>;
  scanKey?: number;
  worldGroup?: THREE.Group | null;
  pointCloudRef: React.MutableRefObject<PointCloudData>;
  viewOnly?: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const raycaster = useRef(new THREE.Raycaster());

  // Reset when scanKey changes (only for active/scanning mode, not viewOnly)
  useEffect(() => {
    if (viewOnly) return;
    const data = pointCloudRef.current;
    data.head = 0;
    data.positions.fill(0);
    data.colors.fill(0);
    if (pointsRef.current) {
      pointsRef.current.geometry.setDrawRange(0, 0);
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    }
  }, [scanKey, viewOnly, pointCloudRef]);

  const geom = useMemo(() => {
    const data = pointCloudRef.current;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    const n = Math.min(data.head, MAX_POINTS);
    g.setDrawRange(0, n);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanKey, pointCloudRef]);

  const spriteTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();
    // Bright core with soft glow falloff
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.15, 'rgba(180,255,250,0.95)');
    grad.addColorStop(0.35, 'rgba(80,255,230,0.6)');
    grad.addColorStop(0.6, 'rgba(0,200,255,0.25)');
    grad.addColorStop(1, 'rgba(0,80,180,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;

    const data = pointCloudRef.current;

    // ── VIEW-ONLY MODE — just render existing cloud, no new points ──
    if (viewOnly) {
      const n = Math.min(data.head, MAX_POINTS);
      const g = pointsRef.current.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
      g.setDrawRange(0, n);
      return;
    }

    // ── ACTIVE SCANNING MODE — generate new points ──
    if (!active || !droneRef.current) return;
    if (data.head >= MAX_POINTS) {
      // Already filled — stop generating
      return;
    }

    const center = droneRef.current.position;
    const pos = data.positions;
    const col = data.colors;

    // ── RAYCASTING MODE — cast rays from drone to scene objects ──
    if (worldGroup) {
      const rc = raycaster.current;
      rc.far = 50;
      const dir = new THREE.Vector3();

      for (let i = 0; i < RAYCAST_BATCH; i++) {
        // Random direction: hemisphere below + around drone
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.85 + 0.15; // mostly downward
        dir.set(
          Math.sin(phi) * Math.cos(theta),
          -Math.cos(phi), // downward bias
          Math.sin(phi) * Math.sin(theta),
        );
        rc.set(center, dir.normalize());

        const hits = rc.intersectObject(worldGroup, true);
        if (hits.length > 0) {
          const hit = hits[0];
          const pt = hit.point;
          const idx = data.head % MAX_POINTS;
          data.head++;
          const o = idx * 3;
          pos[o] = pt.x;
          pos[o + 1] = pt.y;
          pos[o + 2] = pt.z;
          const c = lidarColor(pt.y);
          col[o] = c.r;
          col[o + 1] = c.g;
          col[o + 2] = c.b;
        }
      }
    }

    // ── PROCEDURAL FALLBACK — random points around drone ──
    const proceduralCount = worldGroup ? Math.max(0, BATCH - RAYCAST_BATCH) : BATCH;
    for (let i = 0; i < proceduralCount; i++) {
      const th = Math.random() * Math.PI * 2;
      const r = THREE.MathUtils.randFloat(1.5, 32);
      const x = center.x + Math.cos(th) * r;
      const heightBias = Math.random();
      let y: number;
      if (heightBias < 0.45) {
        y = THREE.MathUtils.randFloat(-0.5, 0.3); // ground
      } else if (heightBias < 0.7) {
        y = THREE.MathUtils.randFloat(0.3, 3.0); // low structures
      } else if (heightBias < 0.9) {
        y = THREE.MathUtils.randFloat(3.0, 7.0); // buildings
      } else {
        y = THREE.MathUtils.randFloat(7.0, 12.0); // tall structures
      }
      const z = center.z + Math.sin(th) * r;
      const idx = data.head % MAX_POINTS;
      data.head++;
      const o = idx * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      const c = lidarColor(y);
      col[o] = c.r;
      col[o + 1] = c.g;
      col[o + 2] = c.b;
    }

    const n = Math.min(data.head, MAX_POINTS);
    const g = pointsRef.current.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, n);
  });

  return (
    <points ref={pointsRef} geometry={geom} frustumCulled={false}>
      <pointsMaterial
        vertexColors
        map={spriteTex}
        size={0.32}
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

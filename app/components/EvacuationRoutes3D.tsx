'use client';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Vec2 } from '../lib/types';

function toLinePoints(path: Vec2[], y: number, frac: number): THREE.Vector3[] {
  if (path.length < 2) return [];
  const n = Math.max(2, Math.floor(path.length * Math.min(1, Math.max(0, frac))));
  return path.slice(0, n).map((p) => new THREE.Vector3(p.x, y, p.z));
}

/** 3D evacuation routes + GPS pearls on safest path (cyan / yellow / white). */
export function EvacuationRoutes3D({
  safest,
  fastest,
  balanced,
  visible,
  routeDraw,
}: {
  safest: Vec2[];
  fastest: Vec2[];
  balanced: Vec2[];
  visible: boolean;
  routeDraw: number;
}) {
  const rd = Number.isFinite(routeDraw) ? Math.min(1, Math.max(0, routeDraw)) : 0;
  const g1 = useRef<THREE.Mesh>(null);
  const g2 = useRef<THREE.Mesh>(null);
  const g3 = useRef<THREE.Mesh>(null);

  // Cache the curve so we don't recreate it every frame
  const safestCurve = useMemo(() => {
    if (safest.length < 2) return null;
    return new THREE.CatmullRomCurve3(safest.map((p) => new THREE.Vector3(p.x, 0.1, p.z)));
  }, [safest]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!visible || !safestCurve) return;
    const u = (t * 0.2) % 1;
    [g1, g2, g3].forEach((gr, k) => {
      if (!gr.current) return;
      const pt = safestCurve.getPointAt((u + k * 0.31) % 1);
      gr.current.position.set(pt.x, 0.25, pt.z);
    });
  });

  const ptsS = useMemo(() => toLinePoints(safest, 0.15, rd), [safest, rd]);
  const ptsF = useMemo(() => toLinePoints(fastest, 0.15, rd), [fastest, rd]);
  const ptsB = useMemo(() => toLinePoints(balanced, 0.15, rd), [balanced, rd]);

  if (!visible) return null;

  return (
    <group>
      {ptsS.length > 1 && (
        <>
          <Line renderOrder={2} points={ptsS} color="#00d9e8" lineWidth={3} transparent opacity={0.35 + 0.5 * rd} />
          <Line renderOrder={3} points={ptsS} color="#a8ffff" lineWidth={1} transparent opacity={Math.min(1, 0.5 + rd)} />
        </>
      )}
      {ptsF.length > 1 && (
        <Line renderOrder={2} points={ptsF} color="#ffd400" lineWidth={2.5} transparent opacity={0.88} />
      )}
      {ptsB.length > 1 && (
        <Line renderOrder={2} points={ptsB} color="#ffffff" lineWidth={2} transparent opacity={0.92} />
      )}
      {safest.length > 1 && visible && (
        <>
          <mesh ref={g1}>
            <sphereGeometry args={[0.2, 14, 12]} />
            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
          <mesh ref={g2}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color="#00ffff" emissive="#88ffff" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
          <mesh ref={g3}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color="#00ffff" emissive="#88ffff" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PropPlacement } from '../lib/envPlacements';
import { deviceConfig } from '../lib/deviceConfig';

/** Low-cost foliage + street furniture (no per-tree draw calls). */
export function InstancedTrees({ items: rawItems }: { items: PropPlacement[] }) {
  const items = deviceConfig.isMobile ? rawItems.slice(0, deviceConfig.maxTrees) : rawItems;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.14, 0.18, 1.0, 6);
    trunk.translate(0, 0.5, 0);
    const crown = new THREE.ConeGeometry(0.95, 2.0, 8);
    crown.translate(0, 1.7, 0);
    return mergeGeometries([trunk, crown]);
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3a5a42',
        roughness: 0.9,
        metalness: 0.04,
      }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((p, i) => {
      dummy.position.set(p.x, 2, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(0, p.r ?? 0, 0);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, dummy]);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} receiveShadow />;
}

export function InstancedStreetlights({ items: rawItems }: { items: PropPlacement[] }) {
  const items = deviceConfig.isMobile ? rawItems.slice(0, deviceConfig.maxStreetlights) : rawItems;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6);
    pole.translate(0, 1.7, 0);
    const bulb = new THREE.SphereGeometry(0.24, 8, 6);
    bulb.translate(0, 3.45, 0);
    return mergeGeometries([pole, bulb]);
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2c323c',
        roughness: 0.45,
        metalness: 0.35,
        emissive: '#ffcc88',
        emissiveIntensity: 0.6,
      }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((p, i) => {
      dummy.position.set(p.x, 2.5, p.z);
      dummy.scale.setScalar(p.s);
      dummy.rotation.set(0, p.r ?? 0, 0);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, dummy]);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} receiveShadow />;
}

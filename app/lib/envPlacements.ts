/** World positions for optional GLB props (trees, cars, lights, debris). */
export type PropPlacement = { file: string; x: number; z: number; s: number; r?: number };

export function getEnvPropPlacements(): PropPlacement[] {
  const out: PropPlacement[] = [];

  // Streetlights along the x = ±22 corridors (clear of buildings)
  for (const z of [-12, 0, 12] as const) {
    out.push({ file: 'streetlight.glb', x: -22, z, s: 1.2, r: 0 });
    out.push({ file: 'streetlight.glb', x: 22, z, s: 1.2, r: Math.PI });
  }

  // Trees on the perimeter — well away from center
  for (let i = 0; i < 5; i++) {
    out.push({ file: 'tree.glb', x: -32 + (i % 3) * 4, z: -36 + i * 2.2, s: 1.4 + (i % 2) * 0.15, r: (i * 0.37) % (Math.PI * 2) });
    out.push({ file: 'tree.glb', x: 26 + (i % 2) * 3, z: 22 - i * 1.4, s: 1.25, r: (i * 0.51) % (Math.PI * 2) });
  }

  // Cars placed on "streets" — clear corridors between buildings
  // These coordinates are reserved in SceneModels.tsx so buildings won't spawn here
  const carSpots = [
    { x: -8, z: 4, r: 0 },         // central street
    { x: 6, z: -18, r: Math.PI / 2 },  // south street
    { x: -5, z: -22, r: -Math.PI / 4 }, // south-west
    { x: 18, z: 2, r: Math.PI },        // east corridor
  ];
  carSpots.forEach((c) => out.push({ file: 'car.glb', x: c.x, z: c.z, s: 1.1, r: c.r }));

  return out;
}

const ALL = getEnvPropPlacements();

export function getTreePlacements() {
  return ALL.filter((p) => p.file === 'tree.glb');
}

export function getStreetlightPlacements() {
  return ALL.filter((p) => p.file === 'streetlight.glb');
}

/** Cars — loaded per-file (few instances). */
export function getRemainingEnvPlacements(): PropPlacement[] {
  return ALL.filter((p) => p.file !== 'tree.glb' && p.file !== 'streetlight.glb');
}

'use client';

/* ═══════════════════════════════════════════════════════════════════
   DEVICE DETECTION & QUALITY CONFIG
   
   Desktop  → Full simulation command center (unchanged visuals)
   Mobile   → Optimized but visually realistic AR field view
   ═══════════════════════════════════════════════════════════════════ */

const _isMobile: boolean =
  typeof navigator !== 'undefined'
    ? /Mobi|Android|iPhone/i.test(navigator.userAgent)
    : false;

export const deviceConfig = {
  isMobile: _isMobile,

  // ── Canvas ──
  /** R3F dpr range — mobile caps at 1.5, desktop uses native */
  dpr: (_isMobile ? [1, 1.5] : [1, 2]) as [number, number],

  // ── FPS ──
  /** 0 = unlimited (desktop), 30 = capped (mobile) */
  targetFPS: _isMobile ? 30 : 0,

  // ── Shadows — kept on both, reduced quality on mobile ──
  shadowMapSize: (_isMobile ? 512 : 1024) as number,
  /** Use cheaper PCFShadowMap on mobile vs PCFSoftShadowMap on desktop */
  useSoftShadows: !_isMobile,
  /** Reduced shadow camera frustum on mobile for tighter shadow area */
  shadowCameraFar: _isMobile ? 60 : 120,
  shadowCameraBounds: _isMobile ? 28 : 50,
  /** Only 1 shadow-casting directional light on mobile */
  enableFillLight: !_isMobile,

  // ── Post-processing (bloom, vignette, chromatic aberration) ──
  enablePostProcessing: !_isMobile,

  // ── LiDAR — 50% reduction (not 80%) ──
  lidarMaxPoints: _isMobile ? 4000 : 8000,
  lidarBatch: _isMobile ? 25 : 50,

  // ── Buildings — slight reduction ──
  innerBuildingCount: _isMobile ? 4 : 6,
  outerBuildingCount: _isMobile ? 7 : 10,
  /** Keep windows/rubble/rebar on both for realism */
  enableBuildingDetails: true,

  // ── Particles — 50% reduction ──
  dustCount: _isMobile ? 200 : 400,
  smokeCount: _isMobile ? 60 : 120,
  fireCount: _isMobile ? 40 : 80,
  dangerParticleCount: _isMobile ? 24 : 48,
  lidarDustCount: _isMobile ? 150 : 300,

  // ── Nature / Environment — reduce duplicates, keep some ──
  maxTrees: _isMobile ? 10 : Infinity,
  maxStreetlights: _isMobile ? 6 : Infinity,
  maxEnvPropsPerFile: _isMobile ? 3 : Infinity,

  // ── Cinematic effects — keep thermal/LiDAR, skip heaviest on mobile ──
  enableScanWave: !_isMobile,           // sphere expand — skip on mobile
  enableRadarRings: !_isMobile,         // heavy — skip on mobile
  enableLidarDust: true,                // keep with reduced density
  enableEnvironmentPreset: !_isMobile,  // IBL cubemap is expensive
  enableThermalShimmer: true,           // keep for realism
  enableNavLights: !_isMobile,          // 3 extra point lights — skip on mobile

  // ── Lighting — fewer point lights on mobile ──
  /** Disable per-danger-zone point lights on mobile (saves N point lights) */
  enableDangerZoneLights: !_isMobile,
  /** Reduce center ambient point light intensity on mobile */
  centerPointIntensity: _isMobile ? 10 : 20,
  /** Reduce sky dome segment count on mobile */
  skyDomeSegments: (_isMobile ? 24 : 48) as number,

  // ── Geometry quality ──
  /** Reduce ring/circle segment counts for mobile */
  circleSegments: (_isMobile ? 24 : 48) as number,

  // ── XR / AR ──
  enableXR: _isMobile,
} as const;

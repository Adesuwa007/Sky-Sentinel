'use client';
/* eslint-disable react-hooks/refs */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { DisasterType, DroneState, MissionState, Vec2, SwarmDrone } from '../lib/types';
import { survivorsData, dangerZones, evacuationZone, helipadZone, ambulancePickupZone, pColor } from '../lib/data';
import { WorldSceneModels, DroneSceneModel } from './SceneModels';
import { LidarPoints, createPointCloudData } from './LidarPoints';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { EvacuationRoutes3D } from './EvacuationRoutes3D';
import { mapSize } from '../lib/helpers';
import { deviceConfig } from '../lib/deviceConfig';

/* ────────────────────────────────────────────────────────────────────────────
   VIGNETTE SHADER
   ──────────────────────────────────────────────────────────────────────────── */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.6 },
    offset: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec2 center=vUv-0.5;
      float dist=length(center);
      float vig=smoothstep(offset,offset-0.45,dist*(darkness+offset));
      gl_FragColor=vec4(c.rgb*vig,c.a);
    }`,
};

/* ────────────────────────────────────────────────────────────────────────────
   CHROMATIC ABERRATION SHADER (thermal mode only)
   ──────────────────────────────────────────────────────────────────────────── */
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.003 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main(){
      float r=texture2D(tDiffuse,vUv+vec2(amount,0.0)).r;
      float g=texture2D(tDiffuse,vUv).g;
      float b=texture2D(tDiffuse,vUv-vec2(amount,0.0)).b;
      gl_FragColor=vec4(r,g,b,1.0);
    }`,
};

/* ────────────────────────────────────────────────────────────────────────────
   FPS LIMITER — caps render rate on mobile for thermal stability
   Used with Canvas frameloop="demand" on mobile
   ──────────────────────────────────────────────────────────────────────────── */
function FPSLimiter({ fps }: { fps: number }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (fps <= 0) return;
    const interval = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(interval);
  }, [fps, invalidate]);
  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
   POST-PROCESSING
   ──────────────────────────────────────────────────────────────────────────── */
function MissionBloom({ thermalVision, isScanning }: { thermalVision: boolean; isScanning: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const w = Math.max(256, Math.floor(size.width * 0.65));
    const h = Math.max(256, Math.floor(size.height * 0.65));
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    // Bloom — higher for scanning, highest for thermal
    const bloomIntensity = thermalVision ? 1.0 : isScanning ? 0.55 : 0.18;
    const bloomRadius = thermalVision ? 0.6 : isScanning ? 0.4 : 0.2;
    const bloomThreshold = thermalVision ? 0.12 : isScanning ? 0.45 : 0.85;
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), bloomIntensity, bloomRadius, bloomThreshold);
    composer.addPass(bloom);

    // Vignette — always active, stronger in thermal
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.darkness.value = thermalVision ? 1.0 : 0.55;
    vignettePass.uniforms.offset.value = thermalVision ? 0.85 : 1.1;
    composer.addPass(vignettePass);

    // Chromatic aberration — thermal only
    if (thermalVision) {
      const caPass = new ShaderPass(ChromaticAberrationShader);
      caPass.uniforms.amount.value = 0.0025;
      composer.addPass(caPass);
    }

    composerRef.current = composer;
    return () => composer.dispose();
  }, [gl, scene, camera, size.width, size.height, thermalVision, isScanning]);
  useFrame(() => composerRef.current?.render(), 1);
  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
   ROTATING RADAR SWEEP LINE (thin glowing cyan line rotating 360°)
   ──────────────────────────────────────────────────────────────────────────── */
function RotatingRadarSweep({ droneRef }: { droneRef: React.RefObject<THREE.Group | null> }) {
  const lineRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!droneRef.current) return;
    const t = state.clock.elapsedTime;
    const dp = droneRef.current.position;
    if (lineRef.current) {
      lineRef.current.position.set(dp.x, dp.y - 0.3, dp.z);
      lineRef.current.rotation.y = t * 2.2;
    }
    if (trailRef.current) {
      trailRef.current.position.set(dp.x, dp.y - 0.3, dp.z);
      trailRef.current.rotation.y = t * 2.2 - 0.35;
      const mat = trailRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.04 + Math.sin(t * 6) * 0.015;
    }
  });
  return (
    <>
      {/* Main sweep line */}
      <mesh ref={lineRef}>
        <planeGeometry args={[0.06, 30]} />
        <meshBasicMaterial color="#00ffee" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Trailing fan */}
      <mesh ref={trailRef}>
        <circleGeometry args={[15, 1, 0, 0.35]} />
        <meshBasicMaterial color="#00ddcc" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SCANNING GRID (temporary grid on ground during scan)
   ──────────────────────────────────────────────────────────────────────────── */
function ScanningGrid({ droneRef }: { droneRef: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.GridHelper>(null);
  useFrame((state) => {
    if (!ref.current || !droneRef.current) return;
    const dp = droneRef.current.position;
    ref.current.position.set(dp.x, 0.04, dp.z);
    const t = state.clock.elapsedTime;
    const opacityVal = 0.12 + Math.sin(t * 3) * 0.05;
    // GridHelper.material can be a single material or an array
    const mats = Array.isArray(ref.current.material) ? ref.current.material : [ref.current.material];
    mats.forEach((m) => { if ('opacity' in m) { m.opacity = opacityVal; m.transparent = true; } });
  });
  return (
    <gridHelper ref={ref as any} args={[30, 20, '#00ccaa', '#006655']} />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   EXPANDING RADAR RINGS (pulse from drone position downward)
   ──────────────────────────────────────────────────────────────────────────── */
function RadarRings({ droneRef }: { droneRef: React.RefObject<THREE.Group | null> }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const RING_COUNT = 3;

  useFrame((state) => {
    if (!droneRef.current) return;
    const t = state.clock.elapsedTime;
    const dp = droneRef.current.position;
    refs.current.forEach((ring, i) => {
      if (!ring) return;
      const phase = (t * 0.8 + i * (1 / RING_COUNT)) % 1;
      const scale = 1 + phase * 28;
      ring.position.set(dp.x, 0.08, dp.z);
      ring.scale.setScalar(scale);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.35 * (1 - phase));
    });
  });

  return (
    <>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <mesh
          key={`radar-ring-${i}`}
          ref={(m) => { if (m) refs.current[i] = m; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.9, 1.0, 64]} />
          <meshBasicMaterial color="#00ffdd" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SCAN WAVE SPHERE (expanding transparent sphere)
   ──────────────────────────────────────────────────────────────────────────── */
function ScanWaveSphere({ droneRef }: { droneRef: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current || !droneRef.current) return;
    const t = state.clock.elapsedTime;
    const dp = droneRef.current.position;
    const phase = (t * 0.35) % 1;
    const scale = 1 + phase * 35;
    ref.current.position.set(dp.x, dp.y, dp.z);
    ref.current.scale.setScalar(scale);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.12 * (1 - phase));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial color="#22ffee" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
    </mesh>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LIDAR DUST PARTICLES (floating in scan light)
   ──────────────────────────────────────────────────────────────────────────── */
function LidarDustParticles({ droneRef }: { droneRef: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Points>(null);
  const DUST_COUNT = deviceConfig.lidarDustCount;
  const offsets = useRef<Float32Array>(new Float32Array(DUST_COUNT * 3));

  const geom = useMemo(() => {
    const arr = new Float32Array(DUST_COUNT * 3);
    const offs = offsets.current;
    for (let i = 0; i < DUST_COUNT; i++) {
      arr[i * 3] = THREE.MathUtils.randFloatSpread(30);
      arr[i * 3 + 1] = THREE.MathUtils.randFloat(-2, 14);
      arr[i * 3 + 2] = THREE.MathUtils.randFloatSpread(30);
      offs[i * 3] = arr[i * 3];
      offs[i * 3 + 1] = arr[i * 3 + 1];
      offs[i * 3 + 2] = arr[i * 3 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useFrame((state) => {
    if (!ref.current || !droneRef.current) return;
    const t = state.clock.elapsedTime;
    const dp = droneRef.current.position;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const offs = offsets.current;
    for (let i = 0; i < DUST_COUNT; i++) {
      arr[i * 3] = dp.x + offs[i * 3] + Math.sin(t * 0.3 + i) * 0.5;
      arr[i * 3 + 1] = offs[i * 3 + 1] + Math.sin(t * 0.5 + i * 0.7) * 0.8;
      arr[i * 3 + 2] = dp.z + offs[i * 3 + 2] + Math.cos(t * 0.25 + i * 0.3) * 0.5;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geom} frustumCulled={false}>
      <pointsMaterial color="#88ffee" size={0.08} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   THERMAL HEAT SHIMMER (distortion-like rings around survivors)
   ──────────────────────────────────────────────────────────────────────────── */
function ThermalHeatShimmer({ survivors }: { survivors: typeof survivorsData }) {
  const refs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const pulse = 1 + Math.sin(t * 3 + i * 1.7) * 0.15;
      mesh.scale.setScalar(pulse);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + Math.sin(t * 5 + i * 2) * 0.04;
    });
  });

  return (
    <>
      {survivors.map((s, i) => {
        const heatColor = s.health < 35 ? '#ff2200' : s.health < 65 ? '#ff8800' : '#ffcc00';
        return (
          <group key={`shimmer-${s.id}`} position={[s.base.x, 0, s.base.z]}>
            {/* Heat circle on ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
              <circleGeometry args={[4.5, 32]} />
              <meshBasicMaterial color={heatColor} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            {/* Pulsing shimmer ring */}
            <mesh
              ref={(m) => { if (m) refs.current[i] = m; }}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.12, 0]}
            >
              <ringGeometry args={[3.2, 4.8, 48]} />
              <meshBasicMaterial color={heatColor} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
            </mesh>
            {/* Vertical heat column */}
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[1.8, 2.5, 6, 16, 1, true]} />
              <meshBasicMaterial color={heatColor} transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SCAN PROGRESS STATUS TEXT
   ──────────────────────────────────────────────────────────────────────────── */
function scanStatusText(progress: number): string {
  if (progress >= 100) return 'SCAN COMPLETE — Survivors Detected';
  if (progress >= 70) return 'Detecting Heat Signatures...';
  if (progress >= 40) return 'Analyzing Structures...';
  return 'Mapping Environment...';
}

/* ────────────────────────────────────────────────────────────────────────────
   HELPERS (textures)
   ──────────────────────────────────────────────────────────────────────────── */

function makeRadialSpriteTexture(inner: string, outer: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  ctx.fillStyle = '#2b3038';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = Math.random() * 0.18;
    ctx.fillStyle = `rgba(${45 + Math.random() * 40},${45 + Math.random() * 40},${45 + Math.random() * 40},${a})`;
    ctx.fillRect(x, y, Math.random() * 2 + 0.3, Math.random() * 2 + 0.3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.needsUpdate = true;
  return tex;
}

/* ── Movement feel constants ─────────────────────────────────────────── */
const DRONE_SPEED_NORMAL  = 6;
const DRONE_SPEED_BOOST   = 12;
const DRONE_ALTITUDE_SPEED = 10;
const ACCEL_LERP    = 0.12;
const DECEL_DAMPING = 0.88;
const MOUSE_SENSITIVITY = 0.0015;
const MOUSE_SMOOTH_LERP = 0.12;
const ORBIT_ROTATE_SPEED = 0.8;
const ORBIT_ZOOM_SPEED   = 1.5;
const ORBIT_DAMPING      = 0.1;
const ALTITUDE_MIN = 2;
const ALTITUDE_MAX = 80;
/* ────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────────
   CAMERA INSPECTOR — double-click to reposition orbit target (look-at point)
   Only active in third-person (non-FPV) mode. Drone and mission state unchanged.
   ──────────────────────────────────────────────────────────────────────────── */
function CameraInspector({
  orbitRef,
  firstPerson,
}: {
  orbitRef: React.RefObject<any>;
  firstPerson: boolean;
}) {
  const { camera, gl, size } = useThree();
  // Focus target for smooth orbit target animation
  const animFrom   = useRef(new THREE.Vector3());
  const animTo     = useRef(new THREE.Vector3());
  const animT      = useRef(1); // 1 = done, 0 = just started
  const ANIM_DUR   = 0.55; // seconds

  // Visual focus-ring state
  const ringRef      = useRef<THREE.Mesh>(null);
  const ringOpacity  = useRef(0);
  const ringPos      = useRef(new THREE.Vector3());

  // Floor plane for raycasting (matches ground plane)
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );

  useEffect(() => {
    if (firstPerson) return; // disabled in FPV

    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();

    const onDblClick = (e: MouseEvent) => {
      if (!orbitRef.current) return;

      // Convert mouse to NDC
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      );

      raycaster.setFromCamera(ndc, camera);

      // Intersect with the horizontal floor plane (y=0)
      const hit = new THREE.Vector3();
      const intersected = raycaster.ray.intersectPlane(floorPlane, hit);
      if (!intersected) return;

      // Clamp within map bounds (mapSize = 72)
      const HALF = 36;
      hit.x = THREE.MathUtils.clamp(hit.x, -HALF, HALF);
      hit.z = THREE.MathUtils.clamp(hit.z, -HALF, HALF);
      hit.y = 0;

      // Start target animation
      animFrom.current.copy(orbitRef.current.target);
      animTo.current.copy(hit);
      animT.current = 0;

      // Trigger ring fade-in at hit point
      ringPos.current.copy(hit);
      ringOpacity.current = 0.85;
    };

    canvas.addEventListener('dblclick', onDblClick);
    return () => canvas.removeEventListener('dblclick', onDblClick);
  }, [firstPerson, camera, gl, floorPlane, orbitRef, size]);

  useFrame((_, delta) => {
    // Animate orbit target
    if (animT.current < 1 && orbitRef.current) {
      animT.current = Math.min(1, animT.current + delta / ANIM_DUR);
      // Smooth ease-out cubic
      const t = 1 - Math.pow(1 - animT.current, 3);
      orbitRef.current.target.lerpVectors(animFrom.current, animTo.current, t);
      orbitRef.current.update();
    }

    // Fade ring out
    if (ringOpacity.current > 0) {
      ringOpacity.current = Math.max(0, ringOpacity.current - delta * 1.6);
      if (ringRef.current) {
        const mat = ringRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = ringOpacity.current;
        // Expand ring outward as it fades
        const scale = 1 + (0.85 - ringOpacity.current) * 3.5;
        ringRef.current.scale.setScalar(scale);
        ringRef.current.visible = ringOpacity.current > 0.01;
      }
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={ringPos.current}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
    >
      <ringGeometry args={[0.55, 0.95, 48]} />
      <meshBasicMaterial
        color="#33eeff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}


/* ────────────────────────────────────────────────────────────────────────────
   MAIN SCENE
   ──────────────────────────────────────────────────────────────────────────── */

export default function Scene({
  missionState, firstPerson, pointerLocked, replayMode, thermalVision,
  disaster, scanReveal01, fullIntel, scanProgress,
  safestPath, fastestPath, balancedPath, swarmDrones, autoSearchPath, autoSearchIdx,
  onDronePos, onSpeed, onScan, onScanDone, onSurvivorFound,
  missionSummaryOpen, scanKey, scenarioVersion,
  droneState, onDroneStateChange,
}: {
  missionState: MissionState; firstPerson: boolean; pointerLocked: boolean; replayMode: boolean; thermalVision: boolean;
  disaster: DisasterType;
  scanReveal01: number; fullIntel: boolean; scanProgress: number;
  safestPath: Vec2[]; fastestPath: Vec2[]; balancedPath: Vec2[];
  swarmDrones: SwarmDrone[]; autoSearchPath: Vec2[]; autoSearchIdx: number;
  onDronePos: (v: THREE.Vector3) => void; onSpeed: (s: number) => void;
  onScan: (s: number) => void; onScanDone: () => void; onSurvivorFound: (id: number, source?: 'lidar' | 'thermal') => void;
  missionSummaryOpen?: boolean;
  scanKey?: number;
  scenarioVersion?: number;
  droneState: DroneState;
  onDroneStateChange: (state: DroneState) => void;
}) {
  const { camera } = useThree();
  const worldRef = useRef<THREE.Group>(null);
  const droneRef = useRef<THREE.Group>(null);
  const droneBodyRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Mesh[]>([]);
  const survivorRefs = useRef<THREE.Object3D[]>([]);
  const spotlightTarget = useRef<THREE.Object3D>(new THREE.Object3D());
  const scanRingRef = useRef<THREE.Mesh>(null);
  const dangerRefs = useRef<THREE.Mesh[]>([]);
  const velocity = useRef(new THREE.Vector3());
  const targetVelocity = useRef(new THREE.Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const scanTheta = useRef(0);
  const scanVal = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const orbitRef = useRef<any>(null);
  const trailRef = useRef<THREE.Vector3[]>([]);
  const [droneLoaded, setDroneLoaded] = useState(false);
  const [routeDraw, setRouteDraw] = useState(0);
  const routeTickRef = useRef(0);
  const scanEmitAccum = useRef(0);
  const droneEmitAccum = useRef(0);

  /* ── Shared point cloud data — persists across mission states ── */
  const pointCloudRef = useRef(createPointCloudData());

  /* ── Deployment animation state ── */
  const DEPLOY_START = useMemo(() => new THREE.Vector3(-55, 22, 0), []);
  const DEPLOY_END = useMemo(() => new THREE.Vector3(0, 6, 0), []);
  const deployProgress = useRef(0);
  const deployCameraDone = useRef(false);
  const prevDroneState = useRef(droneState);

  // Reset deploy progress when droneState goes to 'deploying'
  useEffect(() => {
    if (droneState === 'deploying' && prevDroneState.current !== 'deploying') {
      deployProgress.current = 0;
      deployCameraDone.current = false;
      if (droneRef.current) {
        droneRef.current.position.copy(DEPLOY_START);
      }
    }
    if (droneState === 'idle') {
      deployProgress.current = 0;
      deployCameraDone.current = false;
      if (droneRef.current) {
        droneRef.current.position.copy(DEPLOY_START);
      }
    }
    prevDroneState.current = droneState;
  }, [droneState, DEPLOY_START]);

  // Reset scan state + point cloud when scanKey changes (allows re-running LiDAR)
  useEffect(() => {
    scanTheta.current = 0;
    scanVal.current = 0;
    scanEmitAccum.current = 0;
    droneEmitAccum.current = 0;
    // Reset point cloud data
    pointCloudRef.current = createPointCloudData();
  }, [scanKey]);

  // Also reset when mission state transitions to SCANNING
  const prevMissionState = useRef(missionState);
  useEffect(() => {
    if (missionState === 'SCANNING' && prevMissionState.current !== 'SCANNING') {
      scanTheta.current = 0;
      scanVal.current = 0;
      scanEmitAccum.current = 0;
    }
    prevMissionState.current = missionState;
  }, [missionState]);
  const smokeTex = useMemo(() => makeRadialSpriteTexture('rgba(120,120,120,0.8)', 'rgba(20,20,20,0)'), []);
  const emberTex = useMemo(() => makeRadialSpriteTexture('rgba(255,180,60,1)', 'rgba(255,20,0,0)'), []);
  const groundTex = useMemo(() => makeGroundTexture(), []);
  const crackRoughnessTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    if (!ctx) return new THREE.Texture();
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);
    for (let n = 0; n < 55; n++) {
      ctx.strokeStyle = `rgba(15,15,18,${0.35 + Math.random() * 0.45})`;
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5 + (n % 4); k++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(16, 16);
    return t;
  }, []);

  const _dpCount = deviceConfig.dangerParticleCount;
  const dangerParticleGeoms = useMemo(() => {
    return dangerZones.map((z) => {
      const arr = new Float32Array(_dpCount * 3);
      for (let i = 0; i < _dpCount; i++) {
        arr[i * 3] = z.x + THREE.MathUtils.randFloatSpread(4.8);
        arr[i * 3 + 1] = THREE.MathUtils.randFloat(0.5, 4.2);
        arr[i * 3 + 2] = z.z + THREE.MathUtils.randFloatSpread(4.8);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      return g;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioVersion]);

  const preScanFlight = ['IDLE', 'MISSION', 'DRONE_DEPLOY', 'DRONE'].includes(missionState);
  const showDetection = ['SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'AR', 'THERMAL', 'SWARM'].includes(missionState);
  const survivorsRevealed =
    ['SURVIVORS_DETECTED', 'PLANNING', 'ROUTE', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'REPLAY', 'AR', 'AUTO_SEARCH', 'SWARM'].includes(missionState) ||
    (missionState === 'SCANNING' && scanProgress >= 97);
  const showRoutes3D = ['ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'AR', 'SWARM', 'REPLAY'].includes(missionState) ||
    (safestPath.length > 1 && ['PLANNING', 'SURVIVORS_DETECTED'].includes(missionState));
  const canShowRoutes = showRoutes3D;
  const canManualFly = ['MISSION', 'DRONE_DEPLOY', 'DRONE', 'SURVIVORS_DETECTED', 'PLANNING', 'ROUTE_GENERATED', 'RESCUE_SIM', 'COMPLETE', 'AR', 'AUTO_SEARCH', 'SWARM'].includes(missionState);
  const isScanning = missionState === 'SCANNING';
  const isAutoSearch = missionState === 'AUTO_SEARCH';
  const isPointCloud = missionState === 'POINT_CLOUD';
  const isReconstruct = missionState === 'RECONSTRUCT';
  const showDangerZones = !isPointCloud && !isReconstruct && (fullIntel || (missionState === 'SCANNING' && scanReveal01 > 0.22));
  const showSafeZones = !isPointCloud && !isReconstruct && (fullIntel || (missionState === 'SCANNING' && scanReveal01 > 0.55));

  /* ── Point Cloud / Reconstruct — environment mesh opacity animation ── */
  const envOpacity = useRef(1);
  const envTargetOpacity = isPointCloud ? 0 : 1;
  const reconstructDone = useRef(false);

  useEffect(() => {
    if (isPointCloud) {
      envOpacity.current = 1; // will animate toward 0
      reconstructDone.current = false;
    }
    if (isReconstruct) {
      envOpacity.current = 0; // will animate toward 1
      reconstructDone.current = false;
    }
  }, [isPointCloud, isReconstruct]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      // Also set lowercase key for existing checks
      keys.current[e.key.toLowerCase()] = true;
      // Prevent browser scroll for PageUp/PageDown and arrow keys
      if (e.code === 'PageUp' || e.code === 'PageDown' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!firstPerson || !pointerLocked) return;
      targetYaw.current -= e.movementX * MOUSE_SENSITIVITY;
      targetPitch.current = THREE.MathUtils.clamp(targetPitch.current - e.movementY * MOUSE_SENSITIVITY, -Math.PI / 3, Math.PI / 3);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [firstPerson, pointerLocked]);

  useEffect(() => { if (canShowRoutes) setRouteDraw(0); }, [safestPath, fastestPath, balancedPath, canShowRoutes]); // eslint-disable-line

  useFrame((state, delta) => {
    if (!droneRef.current) return;
    const t = state.clock.elapsedTime;
    if (worldRef.current) {
      if (disaster === 'earthquake') worldRef.current.rotation.z = Math.sin(t * 0.15) * 0.035;
      else worldRef.current.rotation.z = THREE.MathUtils.lerp(worldRef.current.rotation.z, 0, 0.05);
    }

    /* ── DRONE DEPLOYMENT ANIMATION ── */
    if (droneState === 'idle') {
      // Drone hidden outside grid, no movement
      droneRef.current.position.copy(DEPLOY_START);
      droneRef.current.visible = false;
      // Body tilt reset
      if (droneBodyRef.current) droneBodyRef.current.rotation.x = 0;
      return;
    }

    droneRef.current.visible = true;

    if (droneState === 'deploying') {
      // Smooth fly-in from outside the grid to center
      deployProgress.current = Math.min(1, deployProgress.current + delta * 0.28);
      const p = deployProgress.current;
      // Ease-in-out cubic for smooth motion
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      // Interpolate position
      const lerpPos = DEPLOY_START.clone().lerp(DEPLOY_END, ease);
      // Add slight arc (rise up then descend) via a parabolic Y offset
      const arcHeight = 8 * Math.sin(ease * Math.PI);
      lerpPos.y += arcHeight;
      droneRef.current.position.copy(lerpPos);

      // Yaw: face forward (toward center)
      const dir = DEPLOY_END.clone().sub(droneRef.current.position).normalize();
      yaw.current = Math.atan2(-dir.x, -dir.z);
      droneRef.current.rotation.y = yaw.current;

      // Tilt body forward during fly-in for realism
      if (droneBodyRef.current) {
        const tiltAmount = Math.sin(ease * Math.PI) * 0.25;
        droneBodyRef.current.rotation.x = tiltAmount;
      }

      // Camera follows the drone during deployment
      if (!firstPerson && !deployCameraDone.current) {
        const camTarget = new THREE.Vector3(
          lerpPos.x - 8 + ease * 8,
          lerpPos.y + 12 - ease * 4,
          lerpPos.z + 20 - ease * 8,
        );
        camera.position.lerp(camTarget, 0.04);
        camera.lookAt(lerpPos);
      }

      // Update drone pos for UI
      onDronePos(droneRef.current.position.clone());
      onSpeed(deployProgress.current * 45);

      // Deployment complete
      if (deployProgress.current >= 1) {
        deployCameraDone.current = true;
        droneRef.current.position.copy(DEPLOY_END);
        if (droneBodyRef.current) droneBodyRef.current.rotation.x = 0;
        onDroneStateChange('ready');
      }

      // Spin propellers fast during deployment
      propRef.current.forEach((p, i) => {
        p.rotation.y += delta * 55;
        const mat = p.material as THREE.MeshStandardMaterial;
        mat.emissive.set(i % 2 === 0 ? '#ff3648' : '#31ff96');
        mat.emissiveIntensity = 1.4 + Math.sin(t * 12) * 0.5;
      });
      spotlightTarget.current.position.copy(droneRef.current.position).add(new THREE.Vector3(0, -6, 0));

      return;
    }

    // Reset body tilt for non-deploying states
    if (droneBodyRef.current) {
      droneBodyRef.current.rotation.x = THREE.MathUtils.lerp(droneBodyRef.current.rotation.x, 0, 0.1);
    }

    /* ── HOVER BOBBING — add gentle Y oscillation when ready and not scanning ── */
    const addHoverBob = (droneState === 'ready' || droneState === 'mission') && !isScanning && !isAutoSearch && !replayMode;
    if (addHoverBob) {
      const hoverOffset = Math.sin(t * 1.8) * 0.25 + Math.sin(t * 3.1) * 0.08;
      droneRef.current.position.y += hoverOffset * delta * 2;
    }

    /* ── Smooth mouse look interpolation (FPV) ── */
    if (firstPerson) {
      yaw.current = THREE.MathUtils.lerp(yaw.current, targetYaw.current, MOUSE_SMOOTH_LERP);
      pitch.current = THREE.MathUtils.lerp(pitch.current, targetPitch.current, MOUSE_SMOOTH_LERP);
    }

    /* ── NORMAL DRONE MOVEMENT (smooth velocity system) ── */
    const speed = (keys.current['ShiftLeft'] || keys.current['ShiftRight'] || keys.current.shift) ? DRONE_SPEED_BOOST : DRONE_SPEED_NORMAL;

    if (replayMode) {
      const idx = Math.floor((t * 8) % Math.max(1, trailRef.current.length));
      const p = trailRef.current[idx];
      if (p) droneRef.current.position.lerp(p, 0.12);
    } else if (isScanning) {
      scanTheta.current += delta * 0.58;
      const target = new THREE.Vector3(Math.cos(scanTheta.current) * 16, 12, Math.sin(scanTheta.current) * 16);
      velocity.current.lerp(target.sub(droneRef.current.position).multiplyScalar(0.07), 0.28);
      yaw.current = -scanTheta.current - Math.PI / 2;
      targetYaw.current = yaw.current;
      scanVal.current = Math.min(100, scanVal.current + delta * 9);
      scanEmitAccum.current += delta;
      if (scanEmitAccum.current >= 0.1) {
        scanEmitAccum.current = 0;
        onScan(scanVal.current);
      }
      if (scanVal.current >= 100) onScanDone();
    } else if (isAutoSearch && autoSearchPath.length > 0) {
      const target = autoSearchPath[autoSearchIdx];
      if (target) {
        const tgt = new THREE.Vector3(target.x, 10, target.z);
        const dir2 = tgt.clone().sub(droneRef.current.position);
        if (dir2.length() > 0.5) {
          velocity.current.lerp(dir2.normalize().multiplyScalar(0.3), 0.1);
          yaw.current = Math.atan2(-dir2.x, -dir2.z);
          targetYaw.current = yaw.current;
        }
        survivorsData.forEach(s => {
          const dist = Math.hypot(droneRef.current!.position.x - s.base.x, droneRef.current!.position.z - s.base.z);
          if (dist < 8) onSurvivorFound(s.id, 'lidar');
        });
      }
    } else if (canManualFly) {
      // Build target velocity from keys
      const tv = new THREE.Vector3();

      if (firstPerson) {
        // FPV: camera-relative movement — WASD only for horizontal
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw.current, 0));
        const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw.current, 0));
        if (keys.current.w || keys.current['KeyW']) tv.addScaledVector(forward, speed);
        if (keys.current.s || keys.current['KeyS']) tv.addScaledVector(forward, -speed);
        if (keys.current.a || keys.current['KeyA']) tv.addScaledVector(right, -speed);
        if (keys.current.d || keys.current['KeyD']) tv.addScaledVector(right, speed);
      } else {
        // Third-person: yaw-relative input — WASD only for horizontal
        const input = new THREE.Vector3(
          (keys.current.d || keys.current['KeyD'] ? 1 : 0) - (keys.current.a || keys.current['KeyA'] ? 1 : 0),
          0,
          (keys.current.s || keys.current['KeyS'] ? 1 : 0) - (keys.current.w || keys.current['KeyW'] ? 1 : 0),
        );
        if (input.lengthSq() > 0) {
          input.normalize().multiplyScalar(speed).applyEuler(new THREE.Euler(0, yaw.current, 0));
          tv.add(input);
        }
      }

      // Altitude: Q/E (FPV) + PageUp/PageDown + ArrowUp/ArrowDown (both modes)
      if (keys.current.q || keys.current['KeyQ']) tv.y -= speed;
      if (keys.current.e || keys.current['KeyE']) tv.y += speed;
      if (keys.current['PageUp'] || keys.current['ArrowUp']) tv.y += DRONE_ALTITUDE_SPEED;
      if (keys.current['PageDown'] || keys.current['ArrowDown']) tv.y -= DRONE_ALTITUDE_SPEED;

      // Smooth acceleration — lerp toward target velocity
      velocity.current.lerp(tv, ACCEL_LERP);

      // Smooth deceleration when no keys pressed
      if (tv.lengthSq() === 0) {
        velocity.current.multiplyScalar(DECEL_DAMPING);
      }
    }

    if (!replayMode && !isScanning && !isAutoSearch) {
      droneRef.current.position.addScaledVector(velocity.current, delta);
    } else {
      velocity.current.multiplyScalar(Math.exp(-2.8 * delta));
      droneRef.current.position.add(velocity.current);
    }
    droneRef.current.position.y = THREE.MathUtils.clamp(droneRef.current.position.y, ALTITUDE_MIN, ALTITUDE_MAX);
    droneRef.current.rotation.y = yaw.current;
    droneEmitAccum.current += delta;
    if (droneEmitAccum.current >= 0.05) {
      droneEmitAccum.current = 0;
      onDronePos(droneRef.current.position.clone());
    }
    onSpeed(velocity.current.length() * 26);
    trailRef.current.push(droneRef.current.position.clone());
    if (trailRef.current.length > 1500) trailRef.current.shift();

    survivorsData.forEach((s, i) => {
      const obj = survivorRefs.current[i];
      if (!obj) return;
      const deb = !survivorsRevealed && !thermalVision;
      const ds = (obj.userData.defaultSurvivorScale as number) ?? 1;
      if (deb) {
        obj.visible = true;
        obj.scale.setScalar(ds * 0.22);
        obj.rotation.order = 'YXZ';
        obj.rotation.x = 1.15;
        obj.rotation.z = 0.35 + (i % 3) * 0.2;
        return;
      }
      obj.rotation.x = 0;
      obj.rotation.z = 0;
      obj.scale.setScalar(ds);
      if (preScanFlight && !thermalVision && !s.foundByLidar && !s.foundByThermal) {
        obj.visible = false;
      } else if (s.hidden && !s.foundByLidar && !s.foundByThermal && !thermalVision) {
        obj.visible = false;
      } else {
        obj.visible = true;
      }
      switch (s.behavior) {
        case 'walk': obj.position.x = s.base.x + Math.sin(t * 0.5) * 1.6; obj.position.z = s.base.z + Math.cos(t * 0.4) * 1.3; break;
        case 'sit': obj.position.set(s.base.x, 0.05, s.base.z); obj.rotation.x = -0.4; break;
        case 'lie': obj.position.set(s.base.x, 0.05, s.base.z); obj.rotation.z = Math.PI / 2; break;
        case 'wave': obj.rotation.y = 0.7 + Math.sin(t * 1.5) * 0.6; break;
        case 'hide': obj.position.set(s.base.x + 0.8, 0.05, s.base.z - 0.8); break;
        default: obj.position.x = s.base.x + Math.sin(t * 1.1) * 0.4;
      }
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if ('emissive' in m) {
            const sm = m as THREE.MeshStandardMaterial;
            if (thermalVision) {
              // Heat-based colors: red = low HP (hot/distressed), orange = medium, yellow = high HP
              const heatCol = s.health < 35 ? '#ff1100' : s.health < 65 ? '#ff7700' : '#ffcc00';
              sm.emissive.set(heatCol);
              sm.emissiveIntensity = 1.8 + Math.sin(t * 3 + i * 2) * 0.5;
            } else {
              sm.emissive.set(showDetection ? '#ff2222' : '#000000');
              sm.emissiveIntensity = showDetection ? 0.42 : 0;
            }
          }
        });
      });
    });

    if (isScanning) {
      const center = droneRef.current.position;
      survivorsData.forEach(s => {
        const dist = Math.hypot(center.x - s.base.x, center.z - s.base.z);
        if (dist < 20 && !s.foundByLidar) onSurvivorFound(s.id, 'lidar');
      });
    }
    if (thermalVision) {
      survivorsData.forEach((s) => {
        const dist = Math.hypot(droneRef.current!.position.x - s.base.x, droneRef.current!.position.z - s.base.z);
        if (dist < 18 && !s.foundByThermal) onSurvivorFound(s.id, 'thermal');
      });
    }

    if (firstPerson) {
      // Velocity-based camera shake
      const spd = velocity.current.length();
      const shakeIntensity = spd * 0.0008;
      const scanShake = isScanning ? Math.sin(t * 18) * 0.015 + Math.cos(t * 23) * 0.01 : 0;
      const shakeX = shakeIntensity > 0.0001 ? (Math.random() - 0.5) * shakeIntensity : 0;
      const shakeY = shakeIntensity > 0.0001 ? (Math.random() - 0.5) * shakeIntensity * 0.5 : 0;

      camera.position.copy(droneRef.current.position).add(new THREE.Vector3(shakeX + scanShake, 1.35 + shakeY, scanShake * 0.5));

      // Smooth quaternion-based look
      const quaternion = new THREE.Quaternion();
      quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
      camera.quaternion.copy(quaternion);
    }

    // Propeller spin speed (idle/deploying already returned above)
    propRef.current.forEach((p, i) => {
      p.rotation.y += delta * 30;
      const mat = p.material as THREE.MeshStandardMaterial;
      mat.emissive.set(i % 2 === 0 ? '#ff3648' : '#31ff96');
      mat.emissiveIntensity = 0.9 + Math.sin(t * 8) * 0.35;
    });

    spotlightTarget.current.position.copy(droneRef.current.position).add(new THREE.Vector3(0, -1.4, -10).applyEuler(new THREE.Euler(0, yaw.current, 0)));
    if (scanRingRef.current) scanRingRef.current.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
    dangerRefs.current.forEach((dz) => {
      if (!dz) return;
      const mat = dz.material as THREE.MeshBasicMaterial;
      if (mat && 'opacity' in mat) {
        mat.opacity = (thermalVision ? 0.07 : 0.16) + Math.sin(t * 2.2) * 0.05;
      }
    });
    if (canShowRoutes && routeDraw < 1) {
      routeTickRef.current += 1;
      if (routeTickRef.current % 4 === 0) {
        setRouteDraw((v) => Math.min(1, v + delta * 0.35 * 4));
      }
    }

    /* ── POINT CLOUD / RECONSTRUCT — animate environment mesh opacity ── */
    if ((isPointCloud || isReconstruct) && worldRef.current) {
      const speed = isPointCloud ? 2.5 : 0.6; // fade out fast, reconstruct slow
      const prev = envOpacity.current;
      envOpacity.current = THREE.MathUtils.lerp(prev, envTargetOpacity, delta * speed);
      const op = envOpacity.current;

      worldRef.current.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if ('opacity' in m) {
            m.transparent = true;
            m.opacity = op;
            m.needsUpdate = true;
          }
        });
      });

      // When reconstruct finishes (opacity near 1), restore full opacity
      if (isReconstruct && op > 0.98 && !reconstructDone.current) {
        reconstructDone.current = true;
        worldRef.current.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ('opacity' in m) {
              m.opacity = 1;
              m.transparent = false;
              m.needsUpdate = true;
            }
          });
        });
      }
    }

    // OrbitControls damping requires .update() every frame
    if (orbitRef.current && !firstPerson) {
      orbitRef.current.update();
    }
  });

  const _dustN = deviceConfig.dustCount;
  const dustGeometry = useMemo(() => {
    const arr = new Float32Array(_dustN * 3);
    for (let i = 0; i < _dustN; i++) { arr[i * 3] = THREE.MathUtils.randFloatSpread(mapSize); arr[i * 3 + 1] = THREE.MathUtils.randFloat(0.2, 18); arr[i * 3 + 2] = THREE.MathUtils.randFloatSpread(mapSize); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); return g;
  }, []);

  const _smokeN = deviceConfig.smokeCount;
  const smokeGeometry = useMemo(() => {
    const arr = new Float32Array(_smokeN * 3);
    for (let i = 0; i < _smokeN; i++) {
      arr[i * 3] = THREE.MathUtils.randFloatSpread(46);
      arr[i * 3 + 1] = THREE.MathUtils.randFloat(0.5, 8);
      arr[i * 3 + 2] = THREE.MathUtils.randFloatSpread(46);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  const _fireN = deviceConfig.fireCount;
  const fireGeometry = useMemo(() => {
    const arr = new Float32Array(_fireN * 3);
    for (let i = 0; i < _fireN; i++) {
      const zone = dangerZones[i % Math.max(1, dangerZones.length)];
      arr[i * 3] = zone.x + THREE.MathUtils.randFloatSpread(6);
      arr[i * 3 + 1] = THREE.MathUtils.randFloat(0.2, 5.5);
      arr[i * 3 + 2] = zone.z + THREE.MathUtils.randFloatSpread(6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioVersion]);

  const ambientColor = thermalVision ? '#0d0b18' : '#7f91a6';
  const ambientIntensity = thermalVision ? 0.08 : 0.28;
  const groundColor = thermalVision ? '#030005' : '#1e242a';
  const hideLabels = missionSummaryOpen || missionState === 'COMPLETE';

  /* ── Drone nav light blink ── */
  const [navBlink, setNavBlink] = useState(false);
  useEffect(() => {
    const i = setInterval(() => setNavBlink(v => !v), 600);
    return () => clearInterval(i);
  }, []);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 28, 45]} fov={52} />
      <fog attach="fog" args={[thermalVision ? '#050010' : isScanning ? '#060d18' : '#080e1a', thermalVision ? 20 : isScanning ? 18 : 30, deviceConfig.isMobile ? 80 : (thermalVision ? 90 : isScanning ? 85 : 110)]} />

      {/* ── GRADIENT SKY DOME ── */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[200, deviceConfig.skyDomeSegments, Math.floor(deviceConfig.skyDomeSegments / 2)]} />
        <meshBasicMaterial color={thermalVision ? '#080010' : '#0a1420'} side={THREE.BackSide} />
      </mesh>
      {/* Upper sky atmosphere glow */}
      {!thermalVision && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 190, 0]}>
          <circleGeometry args={[200, deviceConfig.skyDomeSegments]} />
          <meshBasicMaterial color="#0e1a2e" side={THREE.DoubleSide} transparent opacity={0.7} />
        </mesh>
      )}

      {/* ── LIGHTING ── */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      {/* Main moonlight — cool white directional */}
      <directionalLight
        position={[-28, 44, -24]}
        intensity={thermalVision ? 0.08 : 1.0}
        color={thermalVision ? '#110022' : '#b8cce2'}
        castShadow
        shadow-mapSize={[deviceConfig.shadowMapSize, deviceConfig.shadowMapSize]}
        shadow-camera-near={1}
        shadow-camera-far={deviceConfig.shadowCameraFar}
        shadow-camera-left={-deviceConfig.shadowCameraBounds}
        shadow-camera-right={deviceConfig.shadowCameraBounds}
        shadow-camera-top={deviceConfig.shadowCameraBounds}
        shadow-camera-bottom={-deviceConfig.shadowCameraBounds}
        shadow-bias={-0.001}
      />
      {/* Warm fill light from opposite side — desktop only */}
      {deviceConfig.enableFillLight && <directionalLight position={[30, 20, 30]} intensity={thermalVision ? 0.02 : 0.25} color="#c4a882" />}
      {/* Point light for city center ambient glow */}
      <pointLight position={[0, 20, 0]} intensity={thermalVision ? (deviceConfig.isMobile ? 4 : 8) : deviceConfig.centerPointIntensity} distance={80} decay={2} color={thermalVision ? '#110022' : '#8aa4c0'} />
      {/* Hemisphere for sky/ground color blending */}
      <hemisphereLight intensity={thermalVision ? 0.03 : 0.35} color={thermalVision ? '#080018' : '#7a8ea8'} groundColor="#1a1e28" />

      {/* ── ATMOSPHERE PARTICLES ── */}

      {!isPointCloud && !isReconstruct && <>
      <points geometry={dustGeometry}>
        <pointsMaterial color={thermalVision ? '#331155' : '#7ba7c7'} size={0.06} transparent opacity={0.22} depthWrite={false} />
      </points>
      {(disaster === 'fire' || disaster === 'earthquake') && (
        <points geometry={smokeGeometry}>
          <pointsMaterial map={smokeTex} color={thermalVision ? '#3a1030' : '#5d666f'} size={3.6} transparent opacity={thermalVision ? 0.14 : 0.22} depthWrite={false} />
        </points>
      )}
      {disaster === 'fire' && (
        <points geometry={fireGeometry}>
          <pointsMaterial map={emberTex} color={thermalVision ? '#ff5c00' : '#ff8a2a'} size={0.75} transparent opacity={0.85} depthWrite={false} />
        </points>
      )}

      <gridHelper args={[mapSize, 32, thermalVision ? '#1a0033' : '#2a4060', thermalVision ? '#0a0018' : '#172238']} />
      </>}
      {/* Ground plane — hidden in pure point cloud view */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow visible={!isPointCloud}>
        <planeGeometry args={[mapSize, mapSize]} />
        <meshStandardMaterial
          map={groundTex}
          color={groundColor}
          roughnessMap={disaster === 'earthquake' ? crackRoughnessTex : undefined}
          roughness={disaster === 'earthquake' ? 0.88 : 0.98}
          metalness={0.02}
          envMapIntensity={0.15}
          transparent
          opacity={isPointCloud ? 0 : 0.92}
        />
      </mesh>
      {disaster === 'flood' && !isPointCloud && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.18, 0]} renderOrder={-2}>
          <planeGeometry args={[mapSize * 0.98, mapSize * 0.98]} />
          <meshStandardMaterial color="#1a3a48" metalness={0.35} roughness={0.25} transparent opacity={0.82} envMapIntensity={0.8} />
        </mesh>
      )}

      <group ref={worldRef}>
        <Suspense fallback={null}>
          {deviceConfig.enableEnvironmentPreset && <Environment preset="city" environmentIntensity={thermalVision ? 0.1 : 0.3} />}
          <WorldSceneModels survivorRefs={survivorRefs} />
        </Suspense>
      </group>

      {/* ── Persistent LiDAR point cloud — visible in POINT_CLOUD & RECONSTRUCT ── */}
      {(isPointCloud || isReconstruct) && (
        <LidarPoints
          active={false}
          viewOnly
          droneRef={droneRef}
          scanKey={scanKey}
          worldGroup={worldRef.current}
          pointCloudRef={pointCloudRef}
        />
      )}

      <EvacuationRoutes3D
        safest={safestPath}
        fastest={fastestPath}
        balanced={balancedPath}
        visible={showRoutes3D}
        routeDraw={routeDraw}
      />

      {/* Main drone */}
      <group ref={droneRef} position={DEPLOY_START.toArray()}>
        <group ref={droneBodyRef}>
          <ModelErrorBoundary>
            <Suspense fallback={null}>
              <DroneSceneModel onLoaded={setDroneLoaded} />
            </Suspense>
          </ModelErrorBoundary>
        </group>
        {!droneLoaded && <mesh receiveShadow><capsuleGeometry args={[0.45, 1.6, 8, 16]} /><meshStandardMaterial color="#9fb7d6" metalness={0.56} roughness={0.35} /></mesh>}
        {[-1, 1].flatMap((x, xi) => [-1, 1].map((z, zi) => (
          <mesh key={`${x}${z}`} ref={(m) => { if (m) propRef.current[xi * 2 + zi] = m; }} position={[x * 1.2, 0.55, z * 1.2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.04, 16]} /><meshStandardMaterial color="#111827" emissive="#ff3344" emissiveIntensity={1} />
          </mesh>
        )))}
        {/* Enhanced drone spotlight — brighter during scan */}
        <spotLight
          castShadow={false}
          position={[0, 0.5, 0]}
          angle={isScanning ? 0.55 : 0.42}
          penumbra={0.8}
          distance={isScanning ? 45 : 35}
          intensity={thermalVision ? 8 : isScanning ? 60 : 25}
          color={thermalVision ? '#ff6600' : isScanning ? '#e8ffff' : '#c9ebff'}
          target={spotlightTarget.current}
        />
        <primitive object={spotlightTarget.current} />
        {/* Drone scan ring (existing, pulsing) */}
        {isScanning && <mesh ref={scanRingRef} position={[0, -9.8, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4, 8, 64]} /><meshBasicMaterial color="#35edff" transparent opacity={0.35} blending={THREE.AdditiveBlending} /></mesh>}

        {/* ── Scanning light under drone (always visible when not idle) ── */}
        {droneState !== 'idle' && (
          <>
            {/* Cone of light beam */}
            <mesh position={[0, -2.5, 0]}>
              <coneGeometry args={[1.8, 5, 16, 1, true]} />
              <meshBasicMaterial
                color={droneState === 'deploying' ? '#00ccff' : isScanning ? '#00ffdd' : '#33aaff'}
                transparent
                opacity={droneState === 'deploying' ? 0.08 : 0.12}
                side={THREE.DoubleSide}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            {/* Small point light under drone */}
            <pointLight
              position={[0, -1, 0]}
              color={droneState === 'deploying' ? '#00ccff' : '#33ddff'}
              intensity={droneState === 'deploying' ? 6 : 3}
              distance={12}
              decay={2}
            />
          </>
        )}
      </group>

      {/* ── DRONE NAV LIGHTS (red starboard, green port) — desktop only ── */}
      {deviceConfig.enableNavLights && !firstPerson && (
        <group position={[droneRef.current?.position.x ?? 0, (droneRef.current?.position.y ?? 6) + 0.6, droneRef.current?.position.z ?? 16]}>
          <pointLight
            position={[-1.3, 0, 0]}
            color="#ff2222"
            intensity={navBlink ? 4 : 0.5}
            distance={8}
            decay={2}
          />
          <pointLight
            position={[1.3, 0, 0]}
            color="#22ff44"
            intensity={navBlink ? 4 : 0.5}
            distance={8}
            decay={2}
          />
          {/* White strobe on top */}
          <pointLight
            position={[0, 0.5, 0]}
            color="#ffffff"
            intensity={navBlink ? 0 : 3}
            distance={12}
            decay={2}
          />
        </group>
      )}

      {/* ═══════════════════════════════════════════════════════════
         CINEMATIC LIDAR SCAN EFFECTS
         ═══════════════════════════════════════════════════════════ */}
      {isScanning && (
        <>
          {/* Rotating radar sweep line */}
          <RotatingRadarSweep droneRef={droneRef} />
          {/* Expanding radar pulse rings — desktop only */}
          {deviceConfig.enableRadarRings && <RadarRings droneRef={droneRef} />}
          {/* Scan wave sphere passing through buildings — desktop only */}
          {deviceConfig.enableScanWave && <ScanWaveSphere droneRef={droneRef} />}
          {/* Floating dust particles in scan light — desktop only */}
          {deviceConfig.enableLidarDust && <LidarDustParticles droneRef={droneRef} />}
          {/* Scanning grid on ground */}
          <ScanningGrid droneRef={droneRef} />
          {/* Enhanced LiDAR point cloud with raycasting */}
          <LidarPoints active={isScanning} droneRef={droneRef} scanKey={scanKey} worldGroup={worldRef.current} pointCloudRef={pointCloudRef} />
        </>
      )}

      {/* Scan progress HUD with status stages */}
      {isScanning && (
        <Html position={[0, 22, 0]} center>
          <div style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'rgba(0,8,16,0.85)',
            border: '1px solid rgba(50,240,255,0.5)',
            boxShadow: '0 0 20px rgba(0,200,255,0.2), inset 0 0 10px rgba(0,200,255,0.05)',
            color: '#71efff',
            fontSize: 12,
            fontFamily: 'monospace',
            textAlign: 'center',
            minWidth: 200,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
              LiDAR SCAN — {Math.round(scanVal.current)}%
            </div>
            <div style={{
              height: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
              marginBottom: 4,
            }}>
              <div style={{
                height: '100%',
                width: `${Math.round(scanVal.current)}%`,
                background: 'linear-gradient(90deg, #00aaff, #00ffcc)',
                borderRadius: 2,
                transition: 'width 0.1s linear',
                boxShadow: '0 0 8px #00ffcc',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#44ccaa', letterSpacing: 1 }}>
              {scanStatusText(Math.round(scanVal.current))}
            </div>
          </div>
        </Html>
      )}

      {/* ═══════════════════════════════════════════════════════════
         POINT CLOUD VIEW HUD
         ═══════════════════════════════════════════════════════════ */}
      {isPointCloud && (
        <Html position={[0, 22, 0]} center>
          <div style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'rgba(0,8,16,0.9)',
            border: '1px solid rgba(0,255,220,0.5)',
            boxShadow: '0 0 30px rgba(0,255,220,0.15), inset 0 0 15px rgba(0,255,220,0.05)',
            color: '#50ffdd',
            fontSize: 12,
            fontFamily: 'monospace',
            textAlign: 'center',
            minWidth: 220,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, marginBottom: 6, color: '#88ffee' }}>
              ● POINT CLOUD VIEW
            </div>
            <div style={{ fontSize: 11, color: '#44ccaa', letterSpacing: 1 }}>
              {Math.min(pointCloudRef.current.head, deviceConfig.lidarMaxPoints).toLocaleString()} points captured
            </div>
            <div style={{ fontSize: 9, color: '#336655', marginTop: 4, letterSpacing: 1 }}>
              RAW LiDAR DATA — Environment Hidden
            </div>
          </div>
        </Html>
      )}

      {/* ═══════════════════════════════════════════════════════════
         RECONSTRUCT HUD
         ═══════════════════════════════════════════════════════════ */}
      {isReconstruct && (
        <Html position={[0, 22, 0]} center>
          <div style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'rgba(0,8,16,0.9)',
            border: '1px solid rgba(50,255,200,0.5)',
            boxShadow: '0 0 30px rgba(50,255,200,0.15), inset 0 0 15px rgba(50,255,200,0.05)',
            color: '#66ffcc',
            fontSize: 12,
            fontFamily: 'monospace',
            textAlign: 'center',
            minWidth: 240,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, marginBottom: 6, color: '#66ffcc' }}>
              ◉ RECONSTRUCTING MAP
            </div>
            <div style={{
              height: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
              marginBottom: 4,
            }}>
              <div style={{
                height: '100%',
                width: `${Math.round(envOpacity.current * 100)}%`,
                background: 'linear-gradient(90deg, #00ffcc, #33ff99)',
                borderRadius: 2,
                transition: 'width 0.15s linear',
                boxShadow: '0 0 8px #33ffcc',
              }} />
            </div>
            <div style={{ fontSize: 10, color: '#44cc99', letterSpacing: 1 }}>
              Fusing point cloud → 3D mesh
            </div>
          </div>
        </Html>
      )}

      {/* Swarm drones */}
      {swarmDrones.map(d => (
        <group key={d.id} position={[d.pos.x, 10 + Math.sin((d.progress + d.pathIdx) * 0.12) * 0.35, d.pos.z]}>
          <mesh receiveShadow><capsuleGeometry args={[0.3, 1, 6, 12]} /><meshStandardMaterial color={d.color} metalness={0.5} roughness={0.4} emissive={d.color} emissiveIntensity={0.4} /></mesh>
          <Html position={[0, 2, 0]} center>
            <div style={{ background: 'rgba(0,0,0,0.7)', border: `1px solid ${d.color}55`, borderRadius: 4, padding: '2px 6px', fontSize: 9, color: d.color, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              {d.name} · {d.status}
            </div>
          </Html>
        </group>
      ))}
      {swarmDrones.map(d => {
        if (d.path.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(d.path.map((p) => new THREE.Vector3(p.x, 0.18, p.z)));
        const geo = new THREE.TubeGeometry(curve, 120, 0.045, 6, false);
        return (
          <mesh key={`path-${d.id}`} geometry={geo}>
            <meshBasicMaterial color={d.color} transparent opacity={0.22} />
          </mesh>
        );
      })}

      {/* Auto-search trail */}
      {isAutoSearch && autoSearchIdx > 1 && (() => {
        const visited = autoSearchPath.slice(0, autoSearchIdx + 1);
        if (visited.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(visited.map(p => new THREE.Vector3(p.x, 0.3, p.z)));
        const geo = new THREE.TubeGeometry(curve, visited.length * 3, 0.08, 6, false);
        return <mesh geometry={geo}><meshStandardMaterial color="#44ffaa" emissive="#44ffaa" emissiveIntensity={0.6} transparent opacity={0.5} /></mesh>;
      })()}

      {/* ═══════════════════════════════════════════════════════════
         CINEMATIC THERMAL VISION EFFECTS
         ═══════════════════════════════════════════════════════════ */}
      {thermalVision && deviceConfig.enableThermalShimmer && <ThermalHeatShimmer survivors={survivorsData} />}

      {showDangerZones &&
        dangerZones.map((z, i) => (
          <group key={`dz-${i}`}>
            <mesh ref={(m) => { if (m) dangerRefs.current[i] = m; }} position={[z.x, 0.05, z.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[5.5, deviceConfig.circleSegments]} />
              <meshBasicMaterial color="#cc0818" transparent opacity={thermalVision ? 0.1 : 0.22} depthWrite={false} />
            </mesh>
            <mesh position={[z.x, 0.051, z.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[4.2, 5.45, deviceConfig.circleSegments]} />
              <meshBasicMaterial color="#ff4444" transparent opacity={0.12} depthWrite={false} />
            </mesh>
            <points position={[0, 0, 0]} geometry={dangerParticleGeoms[i]}>
              <pointsMaterial color="#ff2a3a" size={0.14} transparent opacity={0.65} depthWrite={false} sizeAttenuation />
            </points>
            {/* Emissive glow light at each danger zone — desktop only for performance */}
            {deviceConfig.enableDangerZoneLights && <pointLight
              position={[z.x, 2.5, z.z]}
              color={thermalVision ? '#ff2200' : '#ff4422'}
              intensity={thermalVision ? 15 : 8}
              distance={12}
              decay={2}
            />}
          </group>
        ))}
      {showSafeZones && (
        <>
          <mesh position={[evacuationZone.x, 0.06, evacuationZone.z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[9, deviceConfig.circleSegments]} /><meshBasicMaterial color="#22ff88" transparent opacity={0.28} /></mesh>
          <mesh position={[helipadZone.x, 0.07, helipadZone.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.2, 3.2, deviceConfig.circleSegments]} /><meshBasicMaterial color="#66ff99" transparent opacity={0.45} /></mesh>
          <mesh position={[ambulancePickupZone.x, 0.07, ambulancePickupZone.z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.5, deviceConfig.circleSegments]} /><meshBasicMaterial color="#88ffcc" transparent opacity={0.35} /></mesh>
          <Html position={[evacuationZone.x, 2.5, evacuationZone.z]} center>
            <div style={{ color: '#66ff99', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, textShadow: '0 0 8px #000' }}>SAFE ZONE — EVAC</div>
          </Html>
        </>
      )}

      {missionState === 'AR' &&
        showRoutes3D &&
        balancedPath.slice(0, 20).map((p, i) => (
          <group key={`ar-wp-${i}`} position={[p.x, 0.12, p.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.35, 0.55, 20]} />
              <meshBasicMaterial color="#66ffcc" transparent opacity={0.75} />
            </mesh>
          </group>
        ))}

      {!hideLabels && survivorsRevealed && (!preScanFlight || thermalVision || showDetection) && survivorsData.map((s, i) => {
        const isVisible = !s.hidden || s.foundByLidar || s.foundByThermal || thermalVision;
        if (!isVisible) return null;
        const pos = survivorRefs.current[i]?.position ?? new THREE.Vector3(s.base.x, 0, s.base.z);
        const dist = Math.max(3, Math.round(pos.distanceTo(droneRef.current?.position ?? new THREE.Vector3())));
        const rescueTime = Math.round(dist * 0.8 + (100 - s.health) * 0.3);
        const heatColor = thermalVision ? (s.health < 35 ? '#ff2200' : s.health < 65 ? '#ff8800' : '#ffcc00') : pColor[s.priority];
        return (
          <group key={s.id} position={[pos.x, 0, pos.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.6, 2.45, deviceConfig.circleSegments]} /><meshBasicMaterial color={heatColor} transparent opacity={0.68} /></mesh>
            <mesh position={[0, 2.6, 0]}><cylinderGeometry args={[0.34, 0.34, 5.2, 10, 1, true]} /><meshBasicMaterial color={heatColor} transparent opacity={thermalVision ? 0.12 : 0.2} side={THREE.DoubleSide} /></mesh>
            <Html position={[0, 4.9, 0]} center>
              <div style={{ background: thermalVision ? 'rgba(30,0,0,0.85)' : 'rgba(0,0,0,0.75)', border: `1px solid ${thermalVision ? 'rgba(255,100,50,0.4)' : 'rgba(100,220,255,0.3)'}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, color: thermalVision ? '#ffaa66' : '#a3e8ff', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                <strong>Survivor #{s.id}</strong>{s.hidden && (s.foundByLidar || s.foundByThermal) ? ' 🔍' : ''}<br />
                HP: {Math.round(s.health)}% · {dist}m · <span style={{ color: heatColor }}>{s.priority}</span><br />
                <span style={{ fontSize: 9, color: thermalVision ? '#aa6633' : '#888' }}>
                  {thermalVision ? `TEMP: ${Math.round(36 + (100 - s.health) * 0.06)}°C` : `ETA: ~${rescueTime}s`}
                </span>
              </div>
            </Html>
          </group>
        );
      })}

      {!firstPerson && <OrbitControls ref={orbitRef} enablePan enableZoom enableRotate
        rotateSpeed={ORBIT_ROTATE_SPEED} zoomSpeed={ORBIT_ZOOM_SPEED} panSpeed={0.4}
        enableDamping dampingFactor={ORBIT_DAMPING}
        minPolarAngle={0} maxPolarAngle={Math.PI}
        maxDistance={200} minDistance={5} target={[0, 4, 0]} makeDefault
      />}
      {/* Double-click to inspect any point in 3D space (moves camera pivot only) */}
      {!firstPerson && <CameraInspector orbitRef={orbitRef} firstPerson={firstPerson} />}
      {deviceConfig.enablePostProcessing && <MissionBloom thermalVision={thermalVision} isScanning={isScanning} />}
      {deviceConfig.targetFPS > 0 && <FPSLimiter fps={deviceConfig.targetFPS} />}
    </>
  );
}

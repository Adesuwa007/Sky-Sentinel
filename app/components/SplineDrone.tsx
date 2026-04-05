'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SplineApp = any;

const Spline = dynamic(
  () => import('@splinetool/react-spline/next'),
  { ssr: false }
);

const SPLINE_URL = process.env.NEXT_PUBLIC_SPLINE_URL || '';

/* ── Fallback Drone SVG ── */
function FallbackDrone() {
  return (
    <div className="fallback-drone fallback-glow">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        {/* Main hexagonal body */}
        <polygon
          points="100,20 170,55 170,125 100,160 30,125 30,55"
          fill="none"
          stroke="rgba(0,255,200,0.4)"
          strokeWidth="1.5"
        />
        {/* Inner hexagon */}
        <polygon
          points="100,50 140,70 140,115 100,135 60,115 60,70"
          fill="rgba(0,255,200,0.03)"
          stroke="rgba(0,255,200,0.25)"
          strokeWidth="1"
        />
        {/* Center dot — "eye" */}
        <circle cx="100" cy="92" r="6" fill="rgba(0,255,200,0.5)">
          <animate
            attributeName="r"
            values="6;8;6"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.5;1;0.5"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        {/* Nav lights */}
        <circle cx="30" cy="55" r="3" fill="#ff3333">
          <animate
            attributeName="opacity"
            values="1;0.2;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="170" cy="55" r="3" fill="#33ff66">
          <animate
            attributeName="opacity"
            values="1;0.2;1"
            dur="1.5s"
            repeatCount="indefinite"
            begin="0.75s"
          />
        </circle>
        {/* Motor arms */}
        <line
          x1="100" y1="20" x2="60" y2="5"
          stroke="rgba(0,255,200,0.2)"
          strokeWidth="1"
        />
        <line
          x1="100" y1="20" x2="140" y2="5"
          stroke="rgba(0,255,200,0.2)"
          strokeWidth="1"
        />
        <line
          x1="100" y1="160" x2="60" y2="175"
          stroke="rgba(0,255,200,0.2)"
          strokeWidth="1"
        />
        <line
          x1="100" y1="160" x2="140" y2="175"
          stroke="rgba(0,255,200,0.2)"
          strokeWidth="1"
        />
        {/* Propeller circles */}
        <circle cx="60" cy="5" r="12" fill="none" stroke="rgba(0,255,200,0.15)" strokeWidth="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 5"
            to="360 60 5"
            dur="0.3s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="140" cy="5" r="12" fill="none" stroke="rgba(0,255,200,0.15)" strokeWidth="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 140 5"
            to="360 140 5"
            dur="0.25s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="60" cy="175" r="12" fill="none" stroke="rgba(0,255,200,0.15)" strokeWidth="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 60 175"
            to="360 60 175"
            dur="0.28s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="140" cy="175" r="12" fill="none" stroke="rgba(0,255,200,0.15)" strokeWidth="0.5">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 140 175"
            to="360 140 175"
            dur="0.32s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}

/* ── Loading Spinner ── */
function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="loading-rings">
        <div className="loading-ring" />
        <div className="loading-ring" />
        <div className="loading-ring" />
      </div>
      <div className="loading-text">INITIALIZING SKYSENTINEL...</div>
    </div>
  );
}

/* ── Main Spline Drone Component ── */
export default function SplineDrone({
  droneTarget,
}: {
  droneTarget: 'left' | 'right' | 'center';
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const splineRef = useRef<SplineApp | null>(null);
  const prevTarget = useRef(droneTarget);

  const onLoad = useCallback((spline: SplineApp) => {
    splineRef.current = spline;
    setIsLoaded(true);
  }, []);

  // Respond to card hover by shifting drone
  useEffect(() => {
    if (!splineRef.current || droneTarget === prevTarget.current) return;
    prevTarget.current = droneTarget;
    try {
      splineRef.current.setVariable('droneTarget', droneTarget);
    } catch {
      // Spline variables might not be set in the scene
    }
  }, [droneTarget]);

  // If no URL → show fallback
  if (!SPLINE_URL) {
    return <FallbackDrone />;
  }

  return (
    <div className="spline-layer">
      {!isLoaded && !hasFailed && <LoadingSpinner />}
      {hasFailed && <FallbackDrone />}
      {!hasFailed && (
        <Suspense fallback={<LoadingSpinner />}>
          <Spline
            scene={SPLINE_URL}
            onLoad={onLoad}
            onError={() => setHasFailed(true)}
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ParticleBackground from './ParticleBackground';
import SplineDrone from './SplineDrone';

type DroneTarget = 'left' | 'right' | 'center';

const COMMAND_FEATURES = [
  'Full 3D digital twin map',
  'LiDAR & thermal scanning',
  'All survivor intel',
  'Path planning & routing',
  'Complete drone control',
];

const RESCUE_FEATURES = [
  'Highest priority survivor',
  'Best route to target',
  'Survivor health status',
  'Live distance & ETA',
  'Live drone overhead view',
];

export default function LandingPage() {
  const router = useRouter();
  const [droneTarget, setDroneTarget] = useState<DroneTarget>('center');

  const handleCardHover = useCallback((target: DroneTarget) => {
    setDroneTarget(target);
  }, []);

  const handleCardLeave = useCallback(() => {
    setDroneTarget('center');
  }, []);

  return (
    <div className="landing-root">
      {/* Layer 1 — Background particles */}
      <ParticleBackground />

      {/* Layer 2 — 3D Drone */}
      <SplineDrone droneTarget={droneTarget} />

      {/* Layer 3 — UI overlay */}
      <div className="ui-layer">
        {/* Header */}
        <header className="landing-header">
          <div className="header-logo">
            <span className="hex-icon">⬡</span>
            SKYSENTINEL
          </div>
          <span className="header-version">VERSION 1.0</span>
        </header>

        {/* Hero Section */}
        <main className="hero-section">
          <p className="hero-label">DISASTER RESPONSE SYSTEM</p>
          <h1 className="hero-title">SkySentinel</h1>
          <p className="hero-subtitle">
            AI-Powered Drone Intelligence for First Responders
          </p>

          {/* Entry Cards */}
          <div className="cards-container">
            {/* Command Center Card */}
            <div
              className="entry-card entry-card--command"
              onMouseEnter={() => handleCardHover('left')}
              onMouseLeave={handleCardLeave}
              onClick={() => router.push('/command')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push('/command');
              }}
              id="card-command-center"
            >
              <div className="card-icon card-icon--command">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Radar / grid icon */}
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              </div>
              <div className="card-title card-title--command">
                COMMAND CENTER
              </div>
              <div className="card-description">
                Full mission control &amp; intelligence
              </div>
              <div className="card-divider card-divider--command" />
              <ul className="feature-list">
                {COMMAND_FEATURES.map((f) => (
                  <li key={f} className="feature-item">
                    <span className="feature-dot feature-dot--command" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="card-button card-button--command"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/command');
                }}
                id="btn-enter-command"
              >
                ENTER COMMAND CENTER →
              </button>
            </div>

            {/* Rescue Team Card */}
            <div
              className="entry-card entry-card--rescue"
              onMouseEnter={() => handleCardHover('right')}
              onMouseLeave={handleCardLeave}
              onClick={() => router.push('/rescue')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push('/rescue');
              }}
              id="card-rescue-team"
            >
              <div className="card-icon card-icon--rescue">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Alert/person icon */}
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="card-title card-title--rescue">RESCUE TEAM</div>
              <div className="card-description">
                Guided rescue &amp; survivor tracking
              </div>
              <div className="card-divider card-divider--rescue" />
              <ul className="feature-list">
                {RESCUE_FEATURES.map((f) => (
                  <li key={f} className="feature-item">
                    <span className="feature-dot feature-dot--rescue" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="card-button card-button--rescue"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/rescue');
                }}
                id="btn-enter-rescue"
              >
                ENTER RESCUE SYSTEM →
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="landing-footer">
          AI DISASTER RESPONSE · DIGITAL TWIN · DRONE SIMULATION
        </footer>
      </div>
    </div>
  );
}

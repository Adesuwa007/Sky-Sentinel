'use client';

import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  left: string;
  bottom: string;
  duration: string;
  delay: string;
  driftX: string;
}

export default function ParticleBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        bottom: `${-(Math.random() * 20)}%`,
        duration: `${8 + Math.random() * 7}s`,
        delay: `${Math.random() * 8}s`,
        driftX: `${(Math.random() - 0.5) * 60}px`,
      })),
    );
  }, []);

  return (
    <div className="bg-layer">
      {/* Dot grid */}
      <div className="dot-grid" />

      {/* Radial glow from center */}
      <div className="radial-glow" />

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            bottom: p.bottom,
            animationDuration: p.duration,
            animationDelay: p.delay,
            ['--drift-x' as string]: p.driftX,
          }}
        />
      ))}

      {/* Horizontal scan line */}
      <div className="scan-line" />
    </div>
  );
}

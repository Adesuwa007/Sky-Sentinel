import React, { useEffect, useState, useRef } from 'react';

export default function FPVReticle({ active }: { active: boolean }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Accumulate movement over time (simulates inertia)
      const damping = 0.6; 
      let newX = offsetRef.current.x + e.movementX * damping;
      let newY = offsetRef.current.y + e.movementY * damping;
      
      // Clamp values so it doesn't leave the center too far
      const maxDist = 45;
      const dist = Math.hypot(newX, newY);
      if (dist > maxDist) {
        newX = (newX / dist) * maxDist;
        newY = (newY / dist) * maxDist;
      }
      
      offsetRef.current = { x: newX, y: newY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    // Animation loop to spring it back to center smoothly
    let animationFrameId: number;
    const loop = () => {
      offsetRef.current.x += (0 - offsetRef.current.x) * 0.12;
      offsetRef.current.y += (0 - offsetRef.current.y) * 0.12;
      setOffset({ x: offsetRef.current.x, y: offsetRef.current.y });
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    // Overlay container - absolutely positioned to sit over the FPV camera feed
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
      <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, willChange: 'transform' }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-90 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]"
          style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))' }}
        >
          {/* Center Dot */}
          <circle cx="50" cy="50" r="1.5" fill="white" />

          {/* Symmetrical Tri-Bracket Reticle
            Uses a single path rotated at 0, 120, and 240 degrees for perfect alignment 
          */}
          <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* Top Bracket */}
            <path d="M 40 35 L 50 23 L 60 35" />
            
            {/* Bottom Right Bracket */}
            <path d="M 40 35 L 50 23 L 60 35" transform="rotate(120 50 50)" />
            
            {/* Bottom Left Bracket */}
            <path d="M 40 35 L 50 23 L 60 35" transform="rotate(240 50 50)" />
          </g>
        </svg>
      </div>
    </div>
  );
}

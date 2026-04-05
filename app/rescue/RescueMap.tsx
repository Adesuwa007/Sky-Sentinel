'use client';
import { useCallback, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════
   Rescue 2D Map — Canvas-based top-down view
   No Three.js, no Leaflet — pure canvas rendering
   ═══════════════════════════════════════════════════════════ */

export interface MapSurvivor { id: number; x: number; z: number; priority: string; found: boolean; }
export interface MapDanger { x: number; z: number; radius: number; }
export interface MapRoute { x: number; z: number; }

interface RescueMapProps {
  survivors: MapSurvivor[];
  dangerZones: MapDanger[];
  evacZone: { x: number; z: number; w: number; h: number };
  route: MapRoute[];
  dronePos: { x: number; z: number };
  myPos: { x: number; z: number };
  otherTeams: { callsign: string; x: number; z: number }[];
}

const GRID = 72; // half-size of world
const P_COLORS: Record<string, string> = { High: '#ff3b3b', Medium: '#ffd84f', Low: '#44ff90' };

/* Seeded random for stable building positions */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Generate stable building positions */
const rng = seededRandom(42);
const BUILDINGS: { x: number; z: number; w: number; h: number }[] = [];
for (let i = 0; i < 18; i++) {
  BUILDINGS.push({
    x: (rng() - 0.5) * GRID * 1.6,
    z: (rng() - 0.5) * GRID * 1.6,
    w: 4 + rng() * 8,
    h: 4 + rng() * 8,
  });
}

function toScreen(wx: number, wz: number, w: number): [number, number] {
  return [(wx + GRID) / (GRID * 2) * w, (wz + GRID) / (GRID * 2) * w];
}

export default function RescueMap({
  survivors, dangerZones, evacZone, route, dronePos, myPos, otherTeams,
}: RescueMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    canvas.width = w * dpr;
    canvas.height = w * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, w);

    /* ── Grid lines ── */
    ctx.strokeStyle = 'rgba(0,255,200,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID * 2; i += 20) {
      const s = (i / (GRID * 2)) * w;
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s, w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(w, s); ctx.stroke();
    }

    /* ── Buildings — dark gray rectangles ── */
    ctx.fillStyle = 'rgba(40,40,60,0.6)';
    ctx.strokeStyle = 'rgba(60,60,85,0.4)';
    ctx.lineWidth = 0.5;
    BUILDINGS.forEach(b => {
      const [bx, bz] = toScreen(b.x - b.w / 2, b.z - b.h / 2, w);
      const bw = (b.w / (GRID * 2)) * w;
      const bh = (b.h / (GRID * 2)) * w;
      ctx.fillRect(bx, bz, bw, bh);
      ctx.strokeRect(bx, bz, bw, bh);
    });

    /* ── Evacuation zone — green rectangle ── */
    const [ex, ez] = toScreen(evacZone.x - evacZone.w / 2, evacZone.z - evacZone.h / 2, w);
    const ew = (evacZone.w / (GRID * 2)) * w;
    const eh = (evacZone.h / (GRID * 2)) * w;
    ctx.fillStyle = 'rgba(0,255,136,0.15)';
    ctx.strokeStyle = 'rgba(0,255,136,0.3)';
    ctx.lineWidth = 1;
    ctx.fillRect(ex, ez, ew, eh);
    ctx.strokeRect(ex, ez, ew, eh);
    ctx.fillStyle = 'rgba(0,255,136,0.5)';
    ctx.font = '9px monospace';
    ctx.fillText('EVAC', ex + 3, ez + 12);

    /* ── Danger zones — red circles, pulsing opacity ── */
    const t = Date.now() * 0.002;
    dangerZones.forEach(dz => {
      const [dx, dy] = toScreen(dz.x, dz.z, w);
      const r = (dz.radius / (GRID * 2)) * w;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,51,51,${0.12 + Math.sin(t) * 0.06})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,51,51,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    /* ── Route — orange dashed line ── */
    if (route.length > 1) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      const [rx0, ry0] = toScreen(route[0].x, route[0].z, w);
      ctx.moveTo(rx0, ry0);
      route.forEach(p => {
        const [px, py] = toScreen(p.x, p.z, w);
        ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* ── Survivors — colored dots by priority ── */
    survivors.filter(s => s.found).forEach(s => {
      const [sx, sy] = toScreen(s.x, s.z, w);
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = P_COLORS[s.priority] || '#ffd84f';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '8px monospace';
      ctx.fillText(`S${s.id}`, sx + 7, sy + 3);
    });

    /* ── Drone — white triangle ── */
    const [dsx, dsy] = toScreen(dronePos.x, dronePos.z, w);
    ctx.beginPath();
    ctx.moveTo(dsx, dsy - 6);
    ctx.lineTo(dsx - 4, dsy + 4);
    ctx.lineTo(dsx + 4, dsy + 4);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '8px monospace';
    ctx.fillText('DRONE', dsx + 7, dsy + 3);

    /* ── Other teams — purple dots with callsign labels ── */
    otherTeams.forEach(tm => {
      const [tx, ty] = toScreen(tm.x, tm.z, w);
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#a78bfa';
      ctx.fill();
      ctx.fillStyle = 'rgba(167,139,250,0.5)';
      ctx.font = '7px monospace';
      ctx.fillText(tm.callsign, tx + 6, ty + 3);
    });

    /* ── ME — blue dot with pulsing ring + "YOU" label ── */
    const [mx, my] = toScreen(myPos.x, myPos.z, w);
    const pulse = Math.sin(t * 2) * 3 + 8;
    ctx.beginPath();
    ctx.arc(mx, my, pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59,130,246,0.15)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.fillStyle = 'rgba(59,130,246,0.6)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('YOU', mx + 8, my + 3);

    frameRef.current = requestAnimationFrame(draw);
  }, [survivors, dangerZones, evacZone, route, dronePos, myPos, otherTeams]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <div className="rescue-map-wrap">
      <canvas ref={canvasRef} className="rescue-map-canvas" style={{ width: '100%' }} />
      <div className="rescue-map-legend">
        {[
          { color: '#3b82f6', label: 'YOU' },
          { color: '#ffffff', label: 'DRONE' },
          { color: '#ffd84f', label: 'SURVIVOR' },
          { color: '#ff3333', label: 'DANGER' },
          { color: '#ff6600', label: 'ROUTE' },
        ].map(l => (
          <div key={l.label} className="rescue-legend-item">
            <div className="rescue-legend-dot" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

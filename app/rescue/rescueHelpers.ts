/* ═══════════════════════════════════════════════════
   Rescue Helpers — navigation, alerts, audio, etc.
   ═══════════════════════════════════════════════════ */

export interface Vector3D { x: number; z: number; }

export interface TurnInstruction {
  step: number;
  turn: 'straight' | 'left' | 'right' | 'sharp-left' | 'sharp-right' | 'arrive';
  distance: number;
  bearing: number;
  position: Vector3D;
  description: string;
}

export interface Alert {
  id: string;
  level: 1 | 2 | 3 | 4;
  message: string;
  timestamp: number;
  autoDismiss?: number;
  source: 'command' | 'system' | 'survivor' | 'team';
  survivorId?: string;
  requiresAction?: boolean;
}

export interface StatusReport {
  action: string;
  note: string;
  eta: string;
  flags: string[];
  timestamp: number;
}

export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function bearing(ax: number, az: number, bx: number, bz: number): number {
  return (Math.atan2(bx - ax, -(bz - az)) * 180 / Math.PI + 360) % 360;
}

export function dirLabel(deg: number): string {
  return DIRECTIONS[Math.round(deg / 45) % 8];
}

export function dirFull(d: string): string {
  const map: Record<string, string> = {
    N: 'NORTH', NE: 'NORTHEAST', E: 'EAST', SE: 'SOUTHEAST',
    S: 'SOUTH', SW: 'SOUTHWEST', W: 'WEST', NW: 'NORTHWEST',
  };
  return map[d] || d;
}

export function healthColor(h: number, vars = false): string {
  if (vars) return h < 35 ? 'var(--danger)' : h < 65 ? 'var(--warn)' : 'var(--safe)';
  return h < 35 ? '#ff3333' : h < 65 ? '#ffcc00' : '#00ff88';
}

export function calculateBearing(from: Vector3D, to: Vector3D): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
}

export function calculateDistance(a: Vector3D, b: Vector3D): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2));
}

export function generateTurnByTurn(path: Vector3D[], currentPosition: Vector3D): TurnInstruction[] {
  const instructions: TurnInstruction[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const next = path[i + 2];
    const b = calculateBearing(from, to);
    const distance = calculateDistance(from, to);
    let turn: TurnInstruction['turn'] = 'straight';
    if (next) {
      const nextBearing = calculateBearing(to, next);
      const angle = nextBearing - b;
      const normalized = ((angle + 540) % 360) - 180;
      if (Math.abs(normalized) < 20) turn = 'straight';
      else if (normalized > 20 && normalized <= 60) turn = 'right';
      else if (normalized > 60) turn = 'sharp-right';
      else if (normalized < -20 && normalized >= -60) turn = 'left';
      else turn = 'sharp-left';
    } else {
      turn = 'arrive';
    }
    instructions.push({
      step: i + 1, turn, distance: Math.round(distance),
      bearing: b, position: to,
      description: getTurnDescription(turn, Math.round(distance)),
    });
  }
  return instructions;
}

function getTurnDescription(turn: string, distance: number): string {
  const map: Record<string, string> = {
    'straight': `Continue straight for ${distance}m`,
    'left': `Turn left in ${distance}m`,
    'right': `Turn right in ${distance}m`,
    'sharp-left': `Sharp left in ${distance}m`,
    'sharp-right': `Sharp right in ${distance}m`,
    'arrive': `Target in ${distance}m`,
  };
  return map[turn] || `Continue for ${distance}m`;
}

export function estimateSurvivalMinutes(health: number): string {
  const minutesRemaining = health / 1.44;
  if (minutesRemaining > 60) return 'Stable (60+ min)';
  if (minutesRemaining < 1) return 'CRITICAL — SECONDS';
  return `~${Math.floor(minutesRemaining)} min remaining`;
}

export function survivalColor(health: number): string {
  const min = health / 1.44;
  if (min < 10) return 'var(--danger)';
  if (min < 30) return 'var(--warn)';
  return 'var(--safe)';
}

export function triggerVibration(level: 1 | 2 | 3 | 4) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const patterns: Record<number, number[]> = {
    1: [], 2: [100], 3: [200, 100, 200], 4: [300, 100, 300, 100, 300],
  };
  navigator.vibrate(patterns[level]);
}

let audioCtxRef: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!audioCtxRef) audioCtxRef = new AudioContext();
  if (audioCtxRef.state === 'suspended') audioCtxRef.resume();
  return audioCtxRef;
}

export function playAlertSound(level: 1 | 2 | 3 | 4) {
  try {
    const ctx = getAudioCtx();
    if (level === 1) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = 880; osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (level === 2) {
      [0, 0.25].forEach(delay => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.frequency.value = 660; osc.connect(gain); gain.connect(ctx.destination);
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
      });
    } else if (level === 3) {
      [0, 0.2, 0.4].forEach(delay => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = 780;
        osc.connect(gain); gain.connect(ctx.destination);
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
      });
    } else {
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 440 + (i * 80);
        osc.connect(gain); gain.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.4;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); osc.stop(t + 0.3);
      }
    }
  } catch { /* audio not available */ }
}

export function resumeAudioContext() {
  if (audioCtxRef && audioCtxRef.state === 'suspended') audioCtxRef.resume();
}

export const EVAC_ZONE = { x: 30, z: -30, w: 12, h: 12 };

export const TURN_ICONS: Record<string, string> = {
  'straight': '↑', 'left': '↰', 'right': '↱',
  'sharp-left': '⤸', 'sharp-right': '⤹', 'arrive': '⊙',
};

export const SUGGESTED_CALLSIGNS = ['ALPHA-1', 'BRAVO-2', 'CHARLIE-3', 'DELTA-4'];

export function getMedicalGuidance(health: number) {
  if (health > 65) return {
    level: 'stable' as const, icon: '✓', title: 'STABLE CONDITION',
    text: 'Survivor is conscious and stable. Approach via recommended route. Standard extraction protocol applies. No immediate medical intervention required.',
  };
  if (health > 35) return {
    level: 'moderate' as const, icon: '⚠', title: 'MODERATE CONDITION',
    text: 'Survivor showing signs of distress. Expedite extraction. Prepare basic first aid. Keep survivor calm and still during extraction. Monitor breathing on route to evac zone.',
  };
  if (health > 20) return {
    level: 'critical' as const, icon: '✕', title: 'CRITICAL — URGENT RESPONSE',
    text: 'Immediate extraction required. Have medical team at evacuation zone. Do NOT move survivor without spinal check. CPR may be required. Broadcast NEED BACKUP if alone.',
  };
  return {
    level: 'severe' as const, icon: '☠', title: 'SEVERE — MINUTES REMAINING',
    text: 'RESPOND IMMEDIATELY. Survivor has less than 15 minutes. Request air extraction if available. Begin life support on site. Do not wait for ground transport.',
  };
}

import { NextRequest, NextResponse } from 'next/server';

/* ─────────────────────────────────────────────────────────────────
   In-memory mission state store.
   GET  → returns current state
   POST → merges partial updates into the state
   ───────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let missionStore: Record<string, any> = {
  phase: 'STANDBY',
  disasterType: 'earthquake',
  battery: 100,
  signal: 85,
  timeRemaining: 720,
  scanProgress: 0,
  survivorsDetected: 0,
  totalSurvivors: 0,
  droneState: 'idle',
  thermalActive: false,
  swarmActive: false,
  missionSeed: 0,
  routesGenerated: false,
  rescueSimActive: false,
  missionComplete: false,
  aiAdvice: 'Awaiting mission start.',
  missionLog: [] as { time: string; text: string; type: string }[],
  survivors: [] as { id: number; health: number; priority: string; foundByLidar: boolean; foundByThermal: boolean; behavior: string; hidden: boolean; base: { x: number; z: number }; assignedTo?: string }[],
  dangerZones: [] as { x: number; z: number; type: string; radius: number }[],
  routes: { safest: [] as { x: number; z: number }[], fastest: [] as { x: number; z: number }[], balanced: [] as { x: number; z: number }[] },
  swarmDrones: [] as { id: string; name: string; color: string; role: string; status: string; progress: number }[],
  riskLevel: 'LOW',
  riskFactors: [] as string[],
  missionReport: null,
  lastUpdated: Date.now(),
};

export async function GET() {
  return NextResponse.json({
    ...missionStore,
    lastUpdated: Date.now(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    missionStore = {
      ...missionStore,
      ...body,
      lastUpdated: Date.now(),
    };
    return NextResponse.json({ ok: true, state: missionStore });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

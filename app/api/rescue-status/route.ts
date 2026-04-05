import { NextRequest, NextResponse } from 'next/server';

/* ─────────────────────────────────────────────────────────────────
   Rescue Status — field operatives report survivor interactions.
   POST { callsign, survivorId, action }
   Actions: ARRIVED, EXTRACTED, NEED_BACKUP, NEXT_TARGET

   For production: swap with Supabase or Redis for persistent storage.
   ───────────────────────────────────────────────────────────────── */

interface RescueEvent {
  callsign: string;
  survivorId: number;
  action: string;
  timestamp: number;
}

const rescueEvents: RescueEvent[] = [];
let urgentBackup: { callsign: string; survivorId: number; timestamp: number } | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callsign, survivorId, action } = body;
    if (!callsign || !action) {
      return NextResponse.json({ error: 'Missing callsign or action' }, { status: 400 });
    }
    const event: RescueEvent = {
      callsign,
      survivorId: survivorId ?? -1,
      action,
      timestamp: Date.now(),
    };
    rescueEvents.push(event);
    // Keep only last 200 events
    if (rescueEvents.length > 200) rescueEvents.shift();

    // Handle specific actions
    if (action === 'NEED_BACKUP') {
      urgentBackup = { callsign, survivorId, timestamp: Date.now() };
    }

    // EXTRACTED → update mission state to mark survivor rescued
    // Note: In a real system this would update a shared database
    if (action === 'EXTRACTED' && survivorId != null) {
      try {
        // Read current mission state and update
        const msRes = await fetch(new URL('/api/mission-state', request.url), { method: 'GET' });
        const ms = await msRes.json();
        if (ms.survivors && Array.isArray(ms.survivors)) {
          const updated = ms.survivors.map((s: { id: number; rescued?: boolean }) =>
            s.id === survivorId ? { ...s, rescued: true } : s,
          );
          await fetch(new URL('/api/mission-state', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ survivors: updated }),
          });
        }
      } catch {
        // Non-critical — the rescue app can still function
      }
    }

    return NextResponse.json({ ok: true, event });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    events: rescueEvents.slice(-20),
    urgentBackup,
  });
}

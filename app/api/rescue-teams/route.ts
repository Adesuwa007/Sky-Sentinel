import { NextRequest, NextResponse } from 'next/server';

/* ─────────────────────────────────────────────────────────────────
   Rescue Teams — in-memory store for connected rescue members.
   GET  → returns list of connected rescue team members
   POST → adds/updates a rescue team member (used by rescue app)
   ───────────────────────────────────────────────────────────────── */

export interface RescueTeamMember {
  callsign: string;
  status: 'EN ROUTE' | 'ON SITE' | 'EXTRACTED';
  assignedSurvivor: string | null;
  lastSeen: number; // timestamp
}

let rescueTeams: RescueTeamMember[] = [];

export async function GET() {
  // Auto-expire members not seen in 30 seconds
  const now = Date.now();
  rescueTeams = rescueTeams.filter((t) => now - t.lastSeen < 30000);
  return NextResponse.json({ teams: rescueTeams, count: rescueTeams.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callsign, status, assignedSurvivor } = body;
    if (!callsign) {
      return NextResponse.json({ error: 'Missing callsign' }, { status: 400 });
    }
    const existing = rescueTeams.find((t) => t.callsign === callsign);
    if (existing) {
      existing.status = status || existing.status;
      existing.assignedSurvivor = assignedSurvivor ?? existing.assignedSurvivor;
      existing.lastSeen = Date.now();
    } else {
      rescueTeams.push({
        callsign,
        status: status || 'EN ROUTE',
        assignedSurvivor: assignedSurvivor || null,
        lastSeen: Date.now(),
      });
    }
    return NextResponse.json({ ok: true, teams: rescueTeams });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

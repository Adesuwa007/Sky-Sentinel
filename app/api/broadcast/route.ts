import { NextRequest, NextResponse } from 'next/server';

/* ─────────────────────────────────────────────────────────────────
   Broadcast — command center sends alerts to all rescue teams.
   POST → stores the broadcast message
   GET  → returns latest broadcast (consumed by rescue app)
   ───────────────────────────────────────────────────────────────── */

interface Broadcast {
  message: string;
  timestamp: number;
  from: string;
}

let latestBroadcast: Broadcast | null = null;
const broadcastHistory: Broadcast[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }
    latestBroadcast = {
      message: message.trim(),
      timestamp: Date.now(),
      from: 'COMMAND CENTER',
    };
    broadcastHistory.push(latestBroadcast);
    // Keep only last 50 broadcasts
    if (broadcastHistory.length > 50) broadcastHistory.shift();
    return NextResponse.json({ ok: true, broadcast: latestBroadcast });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    latest: latestBroadcast,
    history: broadcastHistory.slice(-20),
  });
}

import { NextRequest, NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   SKY SENTINEL — CONCISE MISSION SUMMARY REPORT
   POST /api/report  →  compact JSON report
   GET  /api/report  →  schema info
   ═══════════════════════════════════════════════════════════════ */

export type ReportPayload = {
  disasterType: string;
  survivorsDetected: number;
  totalSurvivors: number;
  survivors: {
    id: number;
    health: number;
    priority: string;
    hidden: boolean;
    foundByLidar: boolean;
    foundByThermal: boolean;
    behavior: string;
    position: { x: number; z: number };
  }[];
  dangerZones: {
    x: number;
    z: number;
    type: string;   // 'fire' | 'collapse' | 'flood'
    radius: number;
  }[];
  routesSafest: number;
  routesFastest: number;
  routesBalanced: number;
  batteryRemaining: number;
  timeRemaining: number;
  totalMissionTime: number;
  scanComplete: boolean;
  swarmDeployed: boolean;
  thermalUsed: boolean;
  missionSeed: number;
};

export type SummaryReport = {
  total_survivors: number;
  rescued: number;
  danger_zones: number;
  risk_types: string[];
  avg_rescue_time: string;
  high_risk_zones: number;
  low_risk_zones: number;
  routes: string;
  mission_status: string;
};

function generateReport(data: ReportPayload): SummaryReport {
  // ── 1. Total survivors detected ──
  const totalSurvivors = data.totalSurvivors;

  // ── 2. Rescued = detected survivors (simulation treats detection as rescue-ready) ──
  const rescued = data.survivorsDetected;

  // ── 3. Danger zones count ──
  const dangerZoneCount = data.dangerZones.length;

  // ── 4. Risk types — deduplicate and map to human-readable labels ──
  const typeMap: Record<string, string> = {
    fire: 'Fire',
    collapse: 'Structural Damage',
    flood: 'Flood',
  };
  const rawTypes = new Set(data.dangerZones.map((d) => d.type));
  // Always include disaster type as a base risk
  const riskTypes: string[] = [];
  const disasterLabel =
    data.disasterType === 'earthquake' ? 'Seismic Activity'
      : data.disasterType === 'flood' ? 'Flood'
        : data.disasterType === 'fire' ? 'Fire' : data.disasterType;
  riskTypes.push(disasterLabel);
  for (const t of rawTypes) {
    const label = typeMap[t] || t;
    if (!riskTypes.includes(label)) riskTypes.push(label);
  }

  // ── 5. Average rescue time estimate ──
  // Based on: distance to evac zone + health penalty
  const evacZone = { x: -54, z: 0 };
  const rescueTimes = data.survivors
    .filter((s) => s.foundByLidar || s.foundByThermal)
    .map((s) => {
      const dist = Math.hypot(s.position.x - evacZone.x, s.position.z - evacZone.z);
      return Math.round(dist * 0.8 + (100 - s.health) * 0.3);
    });
  const avgTime =
    rescueTimes.length > 0
      ? Math.round(rescueTimes.reduce((a, b) => a + b, 0) / rescueTimes.length)
      : 0;
  const avgRescueTime = rescueTimes.length > 0 ? `~${avgTime}s per survivor` : 'N/A — no survivors detected';

  // ── 6. High-risk vs low-risk zones ──
  // High-risk: radius >= 5 or type is fire/collapse
  const highRisk = data.dangerZones.filter(
    (d) => d.radius >= 5 || d.type === 'fire' || d.type === 'collapse'
  ).length;
  const lowRisk = dangerZoneCount - highRisk;

  // ── 7. Safest evacuation route summary ──
  let routeSummary: string;
  if (data.routesSafest > 0 && data.routesFastest > 0 && data.routesBalanced > 0) {
    const recommended =
      highRisk > lowRisk ? 'Safest' : avgTime < 40 ? 'Fastest' : 'Balanced';
    routeSummary =
      `${recommended} route recommended. ` +
      `Safest: ${data.routesSafest} waypoints, ` +
      `Fastest: ${data.routesFastest} waypoints, ` +
      `Balanced: ${data.routesBalanced} waypoints. ` +
      `All routes lead to western evacuation corridor.`;
  } else {
    routeSummary = 'Routes not yet generated. Complete LiDAR scan and AI Planning first.';
  }

  // ── 8. Mission status ──
  const detectionRate = rescued / Math.max(1, totalSurvivors);
  const criticals = data.survivors.filter((s) => s.health < 30).length;
  let missionStatus: string;
  if (detectionRate >= 1 && data.scanComplete && data.routesSafest > 0) {
    missionStatus = 'Success';
  } else if (detectionRate >= 0.5 || data.scanComplete) {
    missionStatus = 'Partial';
  } else {
    missionStatus = 'Failed';
  }

  // Downgrade if critical conditions exist
  if (missionStatus === 'Success' && criticals >= 2) {
    missionStatus = 'Partial';
  }
  if (data.batteryRemaining < 10 && missionStatus !== 'Failed') {
    missionStatus = 'Partial';
  }

  return {
    total_survivors: totalSurvivors,
    rescued,
    danger_zones: dangerZoneCount,
    risk_types: riskTypes,
    avg_rescue_time: avgRescueTime,
    high_risk_zones: highRisk,
    low_risk_zones: lowRisk,
    routes: routeSummary,
    mission_status: missionStatus,
  };
}

// ──────── GET: schema info ────────
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/report',
    description: 'Sky Sentinel — Concise Mission Summary Report',
    method: 'POST',
    schema: {
      total_survivors: 'number — total survivors in disaster zone',
      rescued: 'number — survivors detected and rescue-ready',
      danger_zones: 'number — identified danger zones',
      risk_types: 'string[] — types of risks (Fire, Structural Damage, Flood, etc.)',
      avg_rescue_time: 'string — estimated average rescue time per survivor',
      high_risk_zones: 'number — zones classified as high risk',
      low_risk_zones: 'number — zones classified as low risk',
      routes: 'string — safest evacuation route summary',
      mission_status: 'string — Success / Partial / Failed',
    },
    timestamp: new Date().toISOString(),
  });
}

// ──────── POST: generate mission summary ────────
export async function POST(request: NextRequest) {
  try {
    const data: ReportPayload = await request.json();
    const report = generateReport(data);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

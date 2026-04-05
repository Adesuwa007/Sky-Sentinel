import { NextRequest, NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   SKY SENTINEL — MISSION REPORT API
   POST /api/mission  →  AI-analysed mission summary
   GET  /api/mission  →  system status
   ═══════════════════════════════════════════════════════════════ */

export type MissionPayload = {
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
  routesSafest: number;
  routesFastest: number;
  routesBalanced: number;
  batteryRemaining: number;
  timeRemaining: number;
  totalMissionTime: number;
  scanComplete: boolean;
  dangerZonesIdentified: number;
  swarmDeployed: boolean;
  thermalUsed: boolean;
};

export type MissionReport = {
  id: string;
  timestamp: string;
  status: 'success' | 'partial' | 'critical';
  overallScore: number;
  summary: string;
  aiRecommendations: string[];
  riskAssessment: {
    level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    factors: string[];
  };
  survivorAnalysis: {
    total: number;
    detected: number;
    criticalCount: number;
    avgHealth: number;
    estimatedSurvivalWindow: string;
  };
  routeAnalysis: {
    safestWaypoints: number;
    fastestWaypoints: number;
    balancedWaypoints: number;
    recommendedRoute: string;
    reason: string;
  };
  resourceStatus: {
    batteryEfficiency: string;
    timeEfficiency: string;
    scanCoverage: string;
  };
  missionGrade: string;
};

function generateMissionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SKY-${ts}-${rand}`;
}

function analyseRisk(data: MissionPayload): MissionReport['riskAssessment'] {
  const factors: string[] = [];
  let score = 0;

  const criticals = data.survivors.filter((s) => s.health < 30);
  if (criticals.length > 0) {
    factors.push(`${criticals.length} survivor(s) in critical condition (HP < 30%)`);
    score += criticals.length * 15;
  }

  const hiddenUnfound = data.survivors.filter((s) => s.hidden && !s.foundByLidar && !s.foundByThermal);
  if (hiddenUnfound.length > 0) {
    factors.push(`${hiddenUnfound.length} survivor(s) remain undetected`);
    score += hiddenUnfound.length * 20;
  }

  if (data.batteryRemaining < 20) {
    factors.push(`Drone battery critical at ${Math.round(data.batteryRemaining)}%`);
    score += 25;
  }

  if (data.timeRemaining < 120) {
    factors.push(`Less than 2 minutes remaining in mission window`);
    score += 20;
  }

  if (!data.scanComplete) {
    factors.push('LiDAR scan incomplete — map coverage is partial');
    score += 15;
  }

  if (data.dangerZonesIdentified > 2) {
    factors.push(`${data.dangerZonesIdentified} active danger zones in operational area`);
    score += 10;
  }

  if (factors.length === 0) factors.push('All operational parameters within acceptable range');

  const level = score >= 60 ? 'CRITICAL' : score >= 40 ? 'HIGH' : score >= 20 ? 'MODERATE' : 'LOW';
  return { level, factors };
}

function generateRecommendations(data: MissionPayload): string[] {
  const recs: string[] = [];
  const avgHealth = data.survivors.reduce((s, sv) => s + sv.health, 0) / Math.max(1, data.survivors.length);

  if (avgHealth < 40) {
    recs.push('URGENT: Average survivor health below 40%. Recommend immediate ground team deployment via balanced route.');
  }

  const criticals = data.survivors.filter((s) => s.health < 30);
  if (criticals.length > 0) {
    const ids = criticals.map((c) => `#${c.id}`).join(', ');
    recs.push(`Priority extraction needed for survivor(s) ${ids} — health critically low.`);
  }

  if (!data.thermalUsed) {
    recs.push('Thermal imaging was not utilized. Hidden survivors may remain undetected — recommend thermal sweep before ground entry.');
  }

  if (!data.swarmDeployed) {
    recs.push('Multi-drone swarm was not deployed. Swarm coverage would reduce scan time by approximately 60%.');
  }

  if (data.routesSafest > data.routesFastest * 1.8) {
    recs.push('Safest route is significantly longer than fastest. Consider balanced route for optimal time-safety trade-off.');
  } else if (data.routesFastest > 0) {
    recs.push('Route options are within acceptable variance. Balanced route recommended for initial team deployment.');
  }

  if (data.batteryRemaining < 30) {
    recs.push(`Battery at ${Math.round(data.batteryRemaining)}%. Plan for drone recall or battery swap before next sortie.`);
  }

  const hiddenFound = data.survivors.filter((s) => s.hidden && (s.foundByLidar || s.foundByThermal));
  if (hiddenFound.length > 0) {
    recs.push(`${hiddenFound.length} obstructed survivor(s) detected — ground team will need debris removal equipment.`);
  }

  if (recs.length === 0) {
    recs.push('All systems nominal. Mission executed within optimal parameters.');
  }

  return recs;
}

function computeGrade(data: MissionPayload): { grade: string; score: number } {
  let score = 50;
  // Detection bonus
  score += (data.survivorsDetected / Math.max(1, data.totalSurvivors)) * 20;
  // Scan completion
  if (data.scanComplete) score += 10;
  // Route generation
  if (data.routesSafest > 0 && data.routesFastest > 0 && data.routesBalanced > 0) score += 10;
  // Thermal usage
  if (data.thermalUsed) score += 5;
  // Swarm usage
  if (data.swarmDeployed) score += 5;
  // Time penalty
  if (data.timeRemaining < 60) score -= 10;
  // Battery penalty
  if (data.batteryRemaining < 15) score -= 10;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  return { grade, score };
}

function analyseMission(data: MissionPayload): MissionReport {
  const risk = analyseRisk(data);
  const recs = generateRecommendations(data);
  const { grade, score } = computeGrade(data);
  const avgHealth = data.survivors.reduce((s, sv) => s + sv.health, 0) / Math.max(1, data.survivors.length);
  const criticalCount = data.survivors.filter((s) => s.health < 30).length;
  const minsLeft = Math.floor(data.timeRemaining / 60);
  const survivalWindow = avgHealth > 60 ? '2-4 hours' : avgHealth > 35 ? '30-90 minutes' : '< 30 minutes';

  const detectionRate = Math.round((data.survivorsDetected / Math.max(1, data.totalSurvivors)) * 100);
  const status = detectionRate === 100 && data.scanComplete ? 'success' : detectionRate >= 50 ? 'partial' : 'critical';

  const disasterLabel = data.disasterType === 'earthquake' ? 'QUAKE' : data.disasterType.toUpperCase();
  const summaryParts: string[] = [];
  summaryParts.push(`${disasterLabel} disaster response mission ${status === 'success' ? 'completed successfully' : 'requires follow-up'}.`);
  summaryParts.push(`${data.survivorsDetected}/${data.totalSurvivors} survivors located with ${detectionRate}% detection rate.`);
  if (data.scanComplete) summaryParts.push('Full area scan completed.');
  summaryParts.push(`Risk level: ${risk.level}. Mission grade: ${grade}.`);

  const recommendedRoute =
    risk.level === 'CRITICAL' ? 'Fastest' : risk.level === 'HIGH' ? 'Balanced' : 'Safest';
  const routeReason =
    risk.level === 'CRITICAL'
      ? 'Critical survivor health — time is the decisive factor.'
      : risk.level === 'HIGH'
        ? 'Elevated risk requires balancing speed with safety.'
        : 'Acceptable risk level allows for maximum route safety.';

  const batteryEff = data.batteryRemaining > 50 ? 'Excellent' : data.batteryRemaining > 25 ? 'Good' : 'Poor';
  const timeUsed = data.totalMissionTime - data.timeRemaining;
  const timeEff = timeUsed < 300 ? 'Excellent' : timeUsed < 500 ? 'Good' : 'Needs improvement';

  return {
    id: generateMissionId(),
    timestamp: new Date().toISOString(),
    status,
    overallScore: score,
    summary: summaryParts.join(' '),
    aiRecommendations: recs,
    riskAssessment: risk,
    survivorAnalysis: {
      total: data.totalSurvivors,
      detected: data.survivorsDetected,
      criticalCount,
      avgHealth: Math.round(avgHealth),
      estimatedSurvivalWindow: survivalWindow,
    },
    routeAnalysis: {
      safestWaypoints: data.routesSafest,
      fastestWaypoints: data.routesFastest,
      balancedWaypoints: data.routesBalanced,
      recommendedRoute,
      reason: routeReason,
    },
    resourceStatus: {
      batteryEfficiency: batteryEff,
      timeEfficiency: timeEff,
      scanCoverage: data.scanComplete ? '100%' : 'Partial',
    },
    missionGrade: grade,
  };
}

// ──────── GET: system health check ────────
export async function GET() {
  return NextResponse.json({
    system: 'Sky Sentinel — AI Mission Analysis Engine',
    version: '1.0.0',
    status: 'online',
    capabilities: ['mission-analysis', 'risk-assessment', 'route-recommendation', 'survivor-triage'],
    timestamp: new Date().toISOString(),
  });
}

// ──────── POST: full mission analysis ────────
export async function POST(request: NextRequest) {
  try {
    const data: MissionPayload = await request.json();
    const report = analyseMission(data);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Invalid mission data payload' }, { status: 400 });
  }
}

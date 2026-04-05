'use client';
import { useEffect, useState } from 'react';

interface MissionCompleteProps {
  open: boolean;
  report: Record<string, unknown> | null;
  loading: boolean;
  missionSeed: number;
  battery: number;
  onContinue: () => void;
  onNewMission: () => void;
  onReplay: () => void;
  onExportPDF: () => void;
}

const GRADE_COLORS: Record<string, string> = {
  S: '#44ff90', A: '#00ccff', B: '#ffd84f', C: '#f97316', D: '#ef4444',
};

export default function CCMissionComplete({
  open, report, loading, missionSeed, battery,
  onContinue, onNewMission, onReplay, onExportPDF,
}: MissionCompleteProps) {
  const [typedText, setTypedText] = useState('');
  const summary = (report as { summary?: string })?.summary || '';

  useEffect(() => {
    if (!summary) { setTypedText(''); return; }
    let i = 0;
    setTypedText('');
    const timer = setInterval(() => {
      i++;
      setTypedText(summary.slice(0, i));
      if (i >= summary.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [summary]);

  if (!open) return null;

  const grade = (report as { missionGrade?: string })?.missionGrade || '?';
  const gradeColor = GRADE_COLORS[grade] || '#888';
  const r = report as Record<string, unknown> | null;
  const sa = r?.survivorAnalysis as { detected?: number; total?: number; avgHealth?: number; criticalCount?: number } | undefined;
  const recs = (r?.aiRecommendations || []) as string[];
  const risk = r?.riskAssessment as { level?: string; factors?: string[] } | undefined;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(5,0,16,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: 560, width: '90%', maxHeight: '88vh', overflowY: 'auto',
        padding: '28px 32px', borderRadius: 16,
        border: '1px solid rgba(0,255,200,0.15)',
        background: 'linear-gradient(165deg, rgba(10,10,40,0.95), rgba(5,0,16,0.98))',
        boxShadow: '0 0 60px rgba(0,255,200,0.08)',
      }}>
        {/* Header with grade */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(0,255,200,0.5)', fontFamily: 'var(--font-inter)' }}>MISSION COMPLETE</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#e0e0ff', fontFamily: 'var(--font-space-grotesk)' }}>Commander Briefing</h2>
          </div>
          {!loading && (
            <div style={{
              width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-jetbrains)',
              background: `${gradeColor}15`, border: `2px solid ${gradeColor}`, color: gradeColor,
            }}>{grade}</div>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(0,255,200,0.4)', fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}>
            <div style={{ marginBottom: 8 }}>Analysing mission data…</div>
            <div style={{ width: 120, height: 2, margin: '0 auto', background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #00ffc8, #3b82f6)', animation: 'loadPulse 1s ease-in-out infinite alternate' }} />
            </div>
          </div>
        )}

        {r && !loading && (
          <>
            {/* Typewriter summary */}
            <p style={{ margin: '0 0 16px', fontSize: 12, lineHeight: 1.7, color: 'rgba(200,200,255,0.6)', fontFamily: 'var(--font-inter)' }}>
              {typedText}<span style={{ opacity: typedText.length < summary.length ? 1 : 0, animation: 'blink 0.6s step-end infinite' }}>▌</span>
            </p>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'SURVIVORS', value: `${sa?.detected || 0}/${sa?.total || 0}`, color: '#44ff90' },
                { label: 'AVG HEALTH', value: `${sa?.avgHealth || 0}%`, color: (sa?.avgHealth || 0) < 40 ? '#ef4444' : '#00ffc8' },
                { label: 'BATTERY', value: `${Math.round(battery)}%`, color: battery < 25 ? '#ef4444' : '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(200,200,255,0.3)', letterSpacing: 1, fontFamily: 'var(--font-jetbrains)', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: 'var(--font-jetbrains)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* AI Recommendations */}
            {recs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: 'rgba(0,255,200,0.4)', letterSpacing: 1, fontFamily: 'var(--font-inter)', fontWeight: 500, marginBottom: 6 }}>AI RECOMMENDATIONS</div>
                {recs.map((rec, i) => (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.6, color: 'rgba(200,200,255,0.5)', marginBottom: 4, paddingLeft: 10, borderLeft: `2px solid ${i === 0 ? '#ff6644' : 'rgba(0,255,200,0.08)'}` }}>{rec}</div>
                ))}
              </div>
            )}

            {/* Risk */}
            {risk && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: 'rgba(0,255,200,0.4)', letterSpacing: 1, fontFamily: 'var(--font-inter)', fontWeight: 500, marginBottom: 4 }}>RISK FACTORS</div>
                {(risk.factors || []).map((f, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'rgba(200,200,255,0.35)', paddingLeft: 10, marginBottom: 2 }}>• {f}</div>
                ))}
              </div>
            )}

            {/* Seed */}
            <div style={{ fontSize: 9, color: 'rgba(200,200,255,0.15)', fontFamily: 'var(--font-jetbrains)', letterSpacing: 1, marginBottom: 16 }}>
              SEED {missionSeed} · {new Date().toLocaleString()}
            </div>
          </>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onContinue} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(0,255,200,0.25)', background: 'rgba(0,255,200,0.08)', color: '#00ffc8', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>CONTINUE</button>
          <button onClick={onNewMission} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>NEW MISSION</button>
          <button onClick={onExportPDF} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>EXPORT PDF</button>
        </div>
        <button onClick={onReplay} style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(200,200,255,0.3)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-jetbrains)' }}>
          ⟳ REPLAY SEED {missionSeed}
        </button>
      </div>
    </div>
  );
}

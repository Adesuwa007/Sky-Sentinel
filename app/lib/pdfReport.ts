'use client';

import { jsPDF } from 'jspdf';
import { getDisasterLabel } from './displayUtils';

export interface PDFReportData {
  total_survivors: number;
  rescued: number;
  danger_zones: number;
  risk_types: string[];
  avg_rescue_time: string;
  high_risk_zones: number;
  low_risk_zones: number;
  routes: string;
  mission_status: string;
}

export interface PDFReportMeta {
  disasterType: string;
  missionSeed: number;
  battery: number;
  timeRemaining: number;
  scanComplete: boolean;
  thermalUsed: boolean;
  swarmDeployed: boolean;
}

/* ═══════════════════════════════════════════════════════════
   Generate a professional PDF mission report using jsPDF
   ═══════════════════════════════════════════════════════════ */

export function generatePDFReport(data: PDFReportData, meta: PDFReportMeta): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ─── Color palette ───
  const cyan = [0, 200, 210] as const;
  const dark = [8, 18, 32] as const;
  const midGray = [100, 130, 150] as const;
  const lightGray = [170, 190, 210] as const;
  const white = [240, 248, 255] as const;
  const red = [255, 68, 68] as const;
  const green = [68, 255, 144] as const;
  const amber = [255, 200, 70] as const;

  // ══════════════════════════════════════════════════════════
  //  HEADER BAND
  // ══════════════════════════════════════════════════════════
  doc.setFillColor(...dark);
  doc.rect(0, 0, pageW, 52, 'F');

  // Accent line
  doc.setFillColor(...cyan);
  doc.rect(0, 52, pageW, 1.5, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...white);
  doc.text('SKY SENTINEL', margin, 22);

  doc.setFontSize(11);
  doc.setTextColor(...cyan);
  doc.text('AI DISASTER RESPONSE — MISSION SUMMARY REPORT', margin, 30);

  // Meta line
  doc.setFontSize(8);
  doc.setTextColor(...lightGray);
  const dateStr = new Date().toLocaleString();
  doc.text(`Generated: ${dateStr}  |  Seed: ${meta.missionSeed}  |  Disaster: ${getDisasterLabel(meta.disasterType).toUpperCase()}`, margin, 40);

  // Mission status badge
  const statusColor = data.mission_status === 'Success' ? green : data.mission_status === 'Partial' ? amber : red;
  const badgeW = 32;
  const badgeX = pageW - margin - badgeW;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(badgeX, 14, badgeW, 10, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text(data.mission_status.toUpperCase(), badgeX + badgeW / 2, 21, { align: 'center' });

  y = 62;

  // ══════════════════════════════════════════════════════════
  //  SECTION HELPER
  // ══════════════════════════════════════════════════════════
  function sectionTitle(title: string) {
    doc.setFillColor(15, 30, 50);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFillColor(...cyan);
    doc.rect(margin, y, 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cyan);
    doc.text(title, margin + 6, y + 5.5);
    y += 12;
  }

  function keyValue(key: string, value: string | number, valueColor?: readonly [number, number, number]) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...midGray);
    doc.text(key, margin + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(valueColor ?? white));
    doc.text(String(value), margin + 80, y);
    y += 7;
  }

  function divider() {
    doc.setDrawColor(30, 50, 70);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  }

  // ══════════════════════════════════════════════════════════
  //  1. MISSION OVERVIEW
  // ══════════════════════════════════════════════════════════
  sectionTitle('MISSION OVERVIEW');
  keyValue('Mission Status', data.mission_status,
    data.mission_status === 'Success' ? green : data.mission_status === 'Partial' ? amber : red);
  keyValue('Disaster Type', getDisasterLabel(meta.disasterType).toUpperCase(), white);
  keyValue('Scan Complete', meta.scanComplete ? 'YES' : 'NO', meta.scanComplete ? green : red);
  keyValue('Thermal Used', meta.thermalUsed ? 'YES' : 'NO', meta.thermalUsed ? green : amber);
  keyValue('Swarm Deployed', meta.swarmDeployed ? 'YES' : 'NO', meta.swarmDeployed ? green : amber);
  keyValue('Battery Remaining', `${Math.round(meta.battery)}%`,
    meta.battery > 50 ? green : meta.battery > 25 ? amber : red);
  const mins = Math.floor(meta.timeRemaining / 60);
  const secs = meta.timeRemaining % 60;
  keyValue('Time Remaining', `${mins}m ${secs}s`,
    meta.timeRemaining > 300 ? green : meta.timeRemaining > 120 ? amber : red);
  y += 4;

  // ══════════════════════════════════════════════════════════
  //  2. SURVIVOR ANALYSIS
  // ══════════════════════════════════════════════════════════
  sectionTitle('SURVIVOR ANALYSIS');
  keyValue('Total Survivors', data.total_survivors, white);
  keyValue('Rescued / Detected', data.rescued, data.rescued === data.total_survivors ? green : amber);
  keyValue('Detection Rate', `${Math.round((data.rescued / Math.max(1, data.total_survivors)) * 100)}%`,
    data.rescued === data.total_survivors ? green : amber);
  keyValue('Avg Rescue Time', data.avg_rescue_time, white);
  y += 4;

  // ══════════════════════════════════════════════════════════
  //  3. RISK ASSESSMENT
  // ══════════════════════════════════════════════════════════
  sectionTitle('RISK ASSESSMENT');
  keyValue('Danger Zones', data.danger_zones, red);
  keyValue('High Risk Zones', data.high_risk_zones, red);
  keyValue('Low Risk Zones', data.low_risk_zones, green);

  // Risk type pills
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...midGray);
  doc.text('Risk Types:', margin + 4, y);

  let pillX = margin + 80;
  data.risk_types.forEach((type) => {
    const textW = doc.getTextWidth(type) + 6;
    doc.setFillColor(50, 25, 15);
    doc.roundedRect(pillX, y - 4, textW, 6, 2, 2, 'F');
    doc.setDrawColor(255, 100, 60);
    doc.setLineWidth(0.3);
    doc.roundedRect(pillX, y - 4, textW, 6, 2, 2, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 136, 102);
    doc.text(type, pillX + 3, y - 0.5);
    pillX += textW + 3;
  });
  y += 10;

  // ══════════════════════════════════════════════════════════
  //  4. EVACUATION ROUTES
  // ══════════════════════════════════════════════════════════
  sectionTitle('EVACUATION ROUTES');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  const routeLines = doc.splitTextToSize(data.routes, contentW - 8);
  doc.text(routeLines, margin + 4, y);
  y += routeLines.length * 5 + 6;

  // ══════════════════════════════════════════════════════════
  //  5. RAW DATA (JSON)
  // ══════════════════════════════════════════════════════════
  divider();
  sectionTitle('RAW DATA');
  doc.setFillColor(10, 16, 28);
  const jsonStr = JSON.stringify(data, null, 2);
  const jsonLines = doc.splitTextToSize(jsonStr, contentW - 8);
  const jsonBlockH = Math.min(jsonLines.length * 4 + 6, 60);
  doc.rect(margin, y - 2, contentW, jsonBlockH, 'F');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(106, 154, 170);
  doc.text(jsonLines.slice(0, 14), margin + 4, y + 2);
  y += jsonBlockH + 6;

  // ══════════════════════════════════════════════════════════
  //  FOOTER
  // ══════════════════════════════════════════════════════════
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFillColor(...dark);
  doc.rect(0, footerY - 2, pageW, 14, 'F');
  doc.setFillColor(...cyan);
  doc.rect(0, footerY - 2, pageW, 0.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...midGray);
  doc.text('SKY SENTINEL — AI Disaster Response System  |  Digital Twin & Drone Simulation Platform', margin, footerY + 3);
  doc.text(`Report ID: SKY-${Date.now().toString(36).toUpperCase()}  |  ${dateStr}`, margin, footerY + 7);
  doc.setTextColor(...cyan);
  doc.text('CONFIDENTIAL — FOR AUTHORIZED PERSONNEL ONLY', pageW - margin, footerY + 3, { align: 'right' });

  // ─── Download ───
  doc.save(`SkySentinel_Mission_Report_${meta.missionSeed}.pdf`);
}

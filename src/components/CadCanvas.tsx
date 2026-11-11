import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import {
  distance2D,
  getPartRotateHandle,
  getSnapPoint,
  hitGizmo,
  hitPart,
  hitPivot,
  hitSlot,
  pivotWorldPos,
  rotate2D,
  screenToWorld,
  slotWorldCenter,
  worldToScreen,
} from '../engine/geometry';
import { Part, PartSlot, Pivot, Point2D } from '../types/mechanism';
import { createBar } from '../engine/presets';
import {
  calculateGearContact,
  calculateGearRadii,
  calculateMeshedRotation,
  generateGearOutline,
  getIdealMeshedPosition,
} from '../engine/gearGeometry';

interface CadCanvasProps {
  store: MechanismStore;
}

interface ConnectedBarInfo {
  partId: number;
  movingPivotId: number;
  isSecondPivot: boolean;
  anchorWorld: Point2D;
  extraPivots: { id: number; relRatio: number; perpDist: number }[];
}

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 168,
    parseInt(clean.slice(2, 4), 16) || 85,
    parseInt(clean.slice(4, 6), 16) || 247,
  ];
};

export const CadCanvas: React.FC<CadCanvasProps> = ({ store }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados locais de interação
  const [dragState, setDragState] = useState<{
    mode:
      | 'pan'
      | 'dragPart'
      | 'dragPivotCluster'
      | 'rotatePart'
      | 'endpointDrag'
      | 'drawLink'
      | 'drawShape';
    startScreen: Point2D;
    startWorld: Point2D;
    initialPartPos?: Point2D;
    initialPartRot?: number;
    targetPart?: Part;
    targetPivot?: Pivot;
    endpointIndex?: number;
    anchorWorld?: Point2D;
    curWorld: Point2D;
    clusterIds?: number[];
    connectedBars?: ConnectedBarInfo[];
    connectedOtherParts?: { partId: number; pivotId: number }[];
  } | null>(null);

  const [hoveredPivot, setHoveredPivot] = useState<{ part: Part; pivot: Pivot } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ part: Part; slot: PartSlot } | null>(null);
  const [hoveredPart, setHoveredPart] = useState<Part | null>(null);

  const {
    parts,
    joints,
    selection,
    setSelection,
    tool,
    setTool,
    camera,
    setCamera,
    simRunning,
    stepSim,
    trails,
    telemetryHoverPoint,
    recordSnapshot,
    addPart,
    updatePart,
    connectJoint,
    addSlotToPart,
    deleteSlot,
    connectPinToSlot,
    addGearPart,
    connectGears,
    pendingJointPivot,
    setPendingJointPivot,
    togglePivotGround,
    togglePivotMotor,
    togglePivotSlider,
    togglePivotTrace,
    deletePart,
    duplicateSelected,
    togglePartVisibility,
    showAllParts,
  } = store;

  // Render Loop & Simulação
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;

      if (simRunning) {
        stepSim(dt);
      }

      drawCanvas();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [simRunning, stepSim, parts, joints, camera, selection, trails, dragState, hoveredPivot, hoveredSlot, hoveredPart, pendingJointPivot, telemetryHoverPoint]);

  // Função Principal de Renderização
  const drawCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;

    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr;
      cv.height = h * dpr;
    }

    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Fundo técnico
    const isDark = document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgCol = isDark ? '#0f172a' : '#f8fafc';
    const gridMinorCol = isDark ? '#1e293b' : '#e2e8f0';
    const gridMajorCol = isDark ? '#334155' : '#cbd5e1';
    const axisCol = isDark ? '#475569' : '#94a3b8';
    const primaryCol = '#2563eb';

    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, w, h);

    // 1. Grade Adaptativa e Eixos
    const cx = w / 2;
    const cy = h / 2;
    const stepMm = camera.gridSize;
    const stepPx = stepMm * camera.zoom;

    if (stepPx > 6) {
      ctx.lineWidth = 1;
      const startX = ((camera.x * camera.zoom - cx) % stepPx);
      const startY = ((camera.y * camera.zoom - cy) % stepPx);

      for (let x = -startX; x < w; x += stepPx) {
        const worldX = Math.round(camera.x + (x - cx) / camera.zoom);
        const isMajor = Math.abs(worldX) % (stepMm * 5) < 1;
        ctx.strokeStyle = isMajor ? gridMajorCol : gridMinorCol;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }

      for (let y = -startY; y < h; y += stepPx) {
        const worldY = Math.round(camera.y + (y - cy) / camera.zoom);
        const isMajor = Math.abs(worldY) % (stepMm * 5) < 1;
        ctx.strokeStyle = isMajor ? gridMajorCol : gridMinorCol;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
    }

    // Eixos Centrais Mundo (0,0)
    const originScreen = worldToScreen({ x: 0, y: 0 }, camera, w, h);
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originScreen.x, 0);
    ctx.lineTo(originScreen.x, h);
    ctx.moveTo(0, originScreen.y);
    ctx.lineTo(w, originScreen.y);
    ctx.stroke();

    // 2. Trajetórias com Fade-Out Suave (Coupler Curves)
    if (camera.showTrails) {
      for (const pId in trails) {
        const pts = trails[pId];
        if (!pts || pts.length < 2) continue;

        const pivotOwner = parts.flatMap((p) => p.pivots).find((pv) => pv.id === Number(pId));
        const [r, g, b] = hexToRgb(pivotOwner?.traceColor || '#a855f7');
        const latestTime = pts[pts.length - 1].time;
        const duration =
          pivotOwner?.traceDuration !== undefined
            ? pivotOwner.traceDuration
            : camera.trailDuration;

        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (duration <= 0) {
          // Modo Permanente (Sem fade-out)
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
          ctx.beginPath();
          pts.forEach((pt, idx) => {
            const s = worldToScreen(pt, camera, w, h);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
        } else {
          // Desvanecimento Suave (Fade-Out temporal)
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const age = latestTime - p1.time;
            const alpha = Math.max(0.04, Math.min(0.95, 1 - age / duration));
            const s0 = worldToScreen(p0, camera, w, h);
            const s1 = worldToScreen(p1, camera, w, h);

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(s0.x, s0.y);
            ctx.lineTo(s1.x, s1.y);
            ctx.stroke();
          }
        }
      }
    }

    // 2.1 Ponto Sincronizado de Telemetria (Hover no Gráfico de Onda)
    if (telemetryHoverPoint) {
      const s = worldToScreen(telemetryHoverPoint, camera, w, h);
      ctx.save();
      // Anel duplo de destaque
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, 2 * Math.PI);
      ctx.fill();

      // Retícula de precisão
      ctx.beginPath();
      ctx.moveTo(s.x - 14, s.y);
      ctx.lineTo(s.x + 14, s.y);
      ctx.moveTo(s.x, s.y - 14);
      ctx.lineTo(s.x, s.y + 14);
      ctx.stroke();

      // Tooltip flutuante com dados cinemáticos
      const tipText = `${telemetryHoverPoint.label}: ${telemetryHoverPoint.value.toFixed(1)} @ ${telemetryHoverPoint.time.toFixed(2)}s`;
      ctx.font = 'bold 10px monospace';
      const tipW = ctx.measureText(tipText).width + 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(s.x - tipW / 2, s.y - 28, tipW, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText(tipText, s.x, s.y - 16);

      ctx.restore();
    }

    // 3. Trilhas de Guias Lineares (Sliders)
    parts.filter((p) => !p.hidden).forEach((p) => {
      p.pivots.forEach((pv) => {
        if (!pv.slider?.enabled) return;
        const wpos = pivotWorldPos(p, pv);
        const sCenter = worldToScreen(wpos, camera, w, h);
        const halfLen = (pv.slider.length / 2) * camera.zoom;
        const ang = pv.slider.angle;
        const dx = Math.cos(ang) * halfLen;
        const dy = Math.sin(ang) * halfLen;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(sCenter.x - dx, sCenter.y - dy);
        ctx.lineTo(sCenter.x + dx, sCenter.y + dy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Batentes visuais
        const nx = -Math.sin(ang) * 8;
        const ny = Math.cos(ang) * 8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sCenter.x - dx - nx, sCenter.y - dy - ny);
        ctx.lineTo(sCenter.x - dx + nx, sCenter.y - dy + ny);
        ctx.moveTo(sCenter.x + dx - nx, sCenter.y + dy - ny);
        ctx.lineTo(sCenter.x + dx + nx, sCenter.y + dy + ny);
        ctx.stroke();
      });
    });

    // 4. Desenho de Peças (Corpos Rígidos)
    parts.filter((p) => !p.hidden).forEach((p) => {
      const isSelected = selection.partId === p.id;
      const isHovered = hoveredPart?.id === p.id;
      const sCenter = worldToScreen({ x: p.x, y: p.y }, camera, w, h);
      const sw = p.w * camera.zoom;
      const sh = p.h * camera.zoom;

      ctx.save();
      ctx.translate(sCenter.x, sCenter.y);
      ctx.rotate(p.rot);

      ctx.beginPath();
      if (p.type === 'circle') {
        ctx.arc(0, 0, sw / 2, 0, 2 * Math.PI);
      } else if (p.type === 'tri') {
        ctx.moveTo(-sw / 2, sh / 2);
        ctx.lineTo(sw / 2, sh / 2);
        ctx.lineTo(0, -sh / 2);
        ctx.closePath();
      } else if (p.type === 'bar') {
        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, sh / 2);
      } else if (p.type === 'gear' && p.gear) {
        const outline = generateGearOutline(p.gear, { x: 0, y: 0 }, 0);
        if (outline.length > 0) {
          ctx.moveTo(outline[0].x * camera.zoom, outline[0].y * camera.zoom);
          for (let i = 1; i < outline.length; i++) {
            ctx.lineTo(outline[i].x * camera.zoom, outline[i].y * camera.zoom);
          }
          ctx.closePath();
        }
      } else {
        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 6);
      }

      // Preenchimento e contorno
      const baseFill = p.color || primaryCol;
      ctx.fillStyle = isSelected
        ? 'rgba(37, 99, 235, 0.28)'
        : isHovered
        ? 'rgba(37, 99, 235, 0.18)'
        : 'rgba(37, 99, 235, 0.10)';
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#2563eb' : baseFill;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      if (p.type === 'gear' && p.gear) {
        const radii = calculateGearRadii(p.gear.teeth, p.gear.module);
        // Circunferência primitiva ISO (tracejada)
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.7)' : 'rgba(2, 132, 199, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, radii.pitch * camera.zoom, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        // Furo do cubo central
        const hubR = Math.max(6, Math.min(16, radii.pitch * 0.25)) * camera.zoom;
        ctx.beginPath();
        ctx.arc(0, 0, hubR, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#2563eb' : (isDark ? '#475569' : '#94a3b8');
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Texto informativo no corpo da engrenagem
        if (radii.pitch * camera.zoom > 25) {
          ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`z=${p.gear.teeth} m=${p.gear.module}`, 0, (radii.dedendum * 0.55) * camera.zoom);
        }
      }

      // Cotas de Dimensão na peça selecionada
      if (camera.showDimensions && isSelected) {
        ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        if (p.type === 'gear' && p.gear) {
          const radii = calculateGearRadii(p.gear.teeth, p.gear.module);
          ctx.fillText(
            `z=${p.gear.teeth} | Dp=${(radii.pitch * 2).toFixed(1)}mm | ${(p.rot * (180 / Math.PI)).toFixed(1)}°`,
            0,
            -radii.addendum * camera.zoom - 10
          );
        } else {
          ctx.fillText(
            `${Math.round(p.w)} mm × ${(p.rot * (180 / Math.PI)).toFixed(1)}°`,
            0,
            -sh / 2 - 8
          );
        }
      }

      ctx.restore();
    });

    // 4.1 Fendas Mecânicas Internas (Slots)
    parts.filter((p) => !p.hidden).forEach((p) => {
      (p.slots || []).forEach((slot) => {
        const sCenter = worldToScreen(slotWorldCenter(p, slot), camera, w, h);
        const totalAngle = p.rot + (slot.angle || 0);
        const sw = slot.length * camera.zoom;
        const sh = (slot.width || 12) * camera.zoom;
        const isHovered = hoveredSlot?.slot.id === slot.id;

        ctx.save();
        ctx.translate(sCenter.x, sCenter.y);
        ctx.rotate(totalAngle);

        // Rasgo usinado (groove)
        ctx.beginPath();
        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, sh / 2);
        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(241, 245, 249, 0.9)';
        ctx.fill();

        ctx.strokeStyle = isHovered ? '#0ea5e9' : isDark ? '#64748b' : '#94a3b8';
        ctx.lineWidth = isHovered ? 2.5 : 1.8;
        ctx.stroke();

        // Linha de centro tracejada da fenda (norma técnica)
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-sw / 2 + sh / 4, 0);
        ctx.lineTo(sw / 2 - sh / 4, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Batentes de fim de curso (se closedEnds !== false)
        if (slot.closedEnds !== false) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-sw / 2, -sh / 2);
          ctx.lineTo(-sw / 2, sh / 2);
          ctx.moveTo(sw / 2, -sh / 2);
          ctx.lineTo(sw / 2, sh / 2);
          ctx.stroke();
        }

        // Rótulo da Fenda (ex: A-S1)
        const labelText = slot.label || `${p.letter || 'A'}-S`;
        ctx.font = 'bold 9px monospace';
        const labelW = ctx.measureText(labelText).width + 8;
        ctx.fillStyle = isHovered ? '#0284c7' : '#475569';
        ctx.beginPath();
        ctx.roundRect(-labelW / 2, -sh / 2 - 14, labelW, 12, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -sh / 2 - 5);

        ctx.restore();
      });
    });

    // 5. Juntas Conectadas (Indicadores Visuais Claros)
    joints.forEach((j) => {
      if (j.type === 'pin-in-slot' && j.slotId) {
        let pinPos: Point2D | null = null;
        let pinLabel = '';
        let slotCenter: Point2D | null = null;
        let slotLabel = '';
        let isHidden = false;

        for (const p of parts) {
          for (const pv of p.pivots) {
            if (pv.id === j.p1) {
              if (p.hidden) isHidden = true;
              pinPos = pivotWorldPos(p, pv);
              pinLabel = pv.label || 'P';
            }
          }
          if (p.slots) {
            for (const sl of p.slots) {
              if (sl.id === j.slotId) {
                if (p.hidden) isHidden = true;
                slotCenter = slotWorldCenter(p, sl);
                slotLabel = sl.label || 'S';
              }
            }
          }
        }

        if (isHidden || !pinPos || !slotCenter) return;

        const sPin = worldToScreen(pinPos, camera, w, h);
        const isJointHovered =
          hoveredPivot?.pivot.id === j.p1 ||
          hoveredSlot?.slot.id === j.slotId ||
          selection.pivotId === j.p1;

        // Halo distintivo pino-em-fenda (anel ciano / esmeralda)
        ctx.strokeStyle = isJointHovered ? '#10b981' : '#06b6d4';
        ctx.lineWidth = isJointHovered ? 2.5 : 1.8;
        ctx.beginPath();
        ctx.arc(sPin.x, sPin.y, 13, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = isJointHovered ? 'rgba(16, 185, 129, 0.25)' : 'rgba(6, 182, 212, 0.20)';
        ctx.beginPath();
        ctx.arc(sPin.x, sPin.y, 10, 0, 2 * Math.PI);
        ctx.fill();

        // Badge pino-em-fenda (ex: B1 ⟷ A-S1)
        const badgeText = `${pinLabel} ⟷ ${slotLabel}`;
        ctx.font = 'bold 9px monospace';
        const badgeWidth = Math.max(48, ctx.measureText(badgeText).width + 8);
        const badgeHeight = 15;
        const badgeX = sPin.x + 10;
        const badgeY = sPin.y - 18;

        ctx.fillStyle = isJointHovered ? '#059669' : '#0891b2';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 11);
        return;
      }

      const part1 = parts.find((p) => p.pivots.some((v) => v.id === j.p1));
      const part2 = parts.find((p) => p.pivots.some((v) => v.id === j.p2));
      if (part1?.hidden || part2?.hidden) return;

      let p1Pos: Point2D | null = null;
      let p2Pos: Point2D | null = null;
      let p1Label = '';
      let p2Label = '';

      for (const p of parts) {
        for (const pv of p.pivots) {
          if (pv.id === j.p1) {
            p1Pos = pivotWorldPos(p, pv);
            p1Label = pv.label || 'P1';
          }
          if (pv.id === j.p2) {
            p2Pos = pivotWorldPos(p, pv);
            p2Label = pv.label || 'P2';
          }
        }
      }

      if (p1Pos && p2Pos) {
        const s1 = worldToScreen(p1Pos, camera, w, h);
        const s2 = worldToScreen(p2Pos, camera, w, h);
        const d = distance2D(s1, s2);

        const isJointHovered =
          hoveredPivot?.pivot.id === j.p1 ||
          hoveredPivot?.pivot.id === j.p2 ||
          selection.pivotId === j.p1 ||
          selection.pivotId === j.p2;

        // Linha tracejada se houver folga
        if (d > 2) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Halo duplo de junta conectada
        ctx.strokeStyle = isJointHovered ? '#f59e0b' : '#3b82f6';
        ctx.lineWidth = isJointHovered ? 2.5 : 1.8;
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, 14, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = isJointHovered ? 'rgba(245, 158, 11, 0.25)' : 'rgba(37, 99, 235, 0.20)';
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, 11, 0, 2 * Math.PI);
        ctx.fill();

        // Badge de equivalência direta dos eixos unidos (ex: A2=B1)
        const badgeText = `${p1Label}=${p2Label}`;
        ctx.font = 'bold 9px monospace';
        const badgeWidth = Math.max(36, ctx.measureText(badgeText).width + 8);
        const badgeHeight = 15;
        const badgeX = s1.x + 10;
        const badgeY = s1.y - 18;

        ctx.fillStyle = isJointHovered ? '#f59e0b' : '#2563eb';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 11);
      }
    });

    // 5.1 Contatos de Engrenamento e Linha de Ação (Linha de Pressão a 20 graus ISO)
    if (camera.showGearContacts !== false) {
      const activeGears = parts.filter((p) => !p.hidden && p.type === 'gear' && p.gear);
      const drawnPairs = new Set<string>();

      for (let i = 0; i < activeGears.length; i++) {
        for (let j = i + 1; j < activeGears.length; j++) {
          const g1 = activeGears[i];
          const g2 = activeGears[j];
          if (!g1.gear || !g2.gear) continue;
          const pairKey = `${Math.min(g1.id, g2.id)}-${Math.max(g1.id, g2.id)}`;
          if (drawnPairs.has(pairKey)) continue;

          const contact = calculateGearContact(g1, g2);
          if (!contact || !contact.isMeshing) continue;
          drawnPairs.add(pairKey);

          const sPitch = worldToScreen(contact.pitchPoint, camera, w, h);
          const sContact = worldToScreen(contact.contactPoint, camera, w, h);
          const sLoaStart = worldToScreen(contact.lineOfActionStart, camera, w, h);
          const sLoaEnd = worldToScreen(contact.lineOfActionEnd, camera, w, h);

          ctx.save();

          // 1. Linha de Ação (tracejada em magenta/carmim)
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(sLoaStart.x, sLoaStart.y);
          ctx.lineTo(sLoaEnd.x, sLoaEnd.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // 2. Ponto Primitivo P (Pitch Point - Cruz e anel)
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sPitch.x, sPitch.y, 4, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sPitch.x - 6, sPitch.y);
          ctx.lineTo(sPitch.x + 6, sPitch.y);
          ctx.moveTo(sPitch.x, sPitch.y - 6);
          ctx.lineTo(sPitch.x, sPitch.y + 6);
          ctx.stroke();

          // Rótulo P
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#06b6d4';
          ctx.textAlign = 'left';
          ctx.fillText('P', sPitch.x + 7, sPitch.y - 4);

          // 3. Ponto Dinâmico de Contato Ativo (Pulsante em esmeralda)
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sContact.x, sContact.y, 6, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.beginPath();
          ctx.arc(sContact.x, sContact.y, 3.5, 0, 2 * Math.PI);
          ctx.fill();

          // 4. Vetor de Força Normal Fn (seta ao longo da linha de ação)
          const arrowLen = 22 * camera.zoom;
          const fnX = sContact.x + contact.normalVector.x * arrowLen;
          const fnY = sContact.y + contact.normalVector.y * arrowLen;

          ctx.strokeStyle = '#10b981';
          ctx.fillStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sContact.x, sContact.y);
          ctx.lineTo(fnX, fnY);
          ctx.stroke();

          // Ponta da seta
          const headLen = 6;
          const arrowAngle = Math.atan2(contact.normalVector.y, contact.normalVector.x);
          ctx.beginPath();
          ctx.moveTo(fnX, fnY);
          ctx.lineTo(
            fnX - headLen * Math.cos(arrowAngle - Math.PI / 6),
            fnY - headLen * Math.sin(arrowAngle - Math.PI / 6)
          );
          ctx.lineTo(
            fnX - headLen * Math.cos(arrowAngle + Math.PI / 6),
            fnY - headLen * Math.sin(arrowAngle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();

          // 5. Badge Informativo Flutuante de Engrenamento
          const badgeText = `Contato: 20° ISO (${g1.gear.teeth}:${g2.gear.teeth})`;
          ctx.font = 'bold 9px monospace';
          const bW = ctx.measureText(badgeText).width + 8;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(sPitch.x - bW / 2, sPitch.y + 10, bW, 14, 3);
          ctx.fill();

          ctx.fillStyle = '#f43f5e';
          ctx.textAlign = 'center';
          ctx.fillText(badgeText, sPitch.x, sPitch.y + 20);

          ctx.restore();
        }
      }
    }

    // 6. Eixos / Pivôs (Fixo, Motor, Slider, Rótulos de Identificação)
    parts.filter((p) => !p.hidden).forEach((p) => {
      p.pivots.forEach((pv, pvIdx) => {
        const wpos = pivotWorldPos(p, pv);
        const s = worldToScreen(wpos, camera, w, h);
        const isPivotSelected = selection.pivotId === pv.id;
        const isPivotHovered = hoveredPivot?.pivot.id === pv.id;

        // Apoio Fixo ao Plano (Símbolo ISO de terra/engastamento)
        if (pv.fixed || pv.motor) {
          ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 4);
          ctx.lineTo(s.x - 10, s.y + 18);
          ctx.lineTo(s.x + 10, s.y + 18);
          ctx.closePath();
          ctx.fill();

          // Hachuras na base do triângulo
          ctx.strokeStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x - 12, s.y + 18);
          ctx.lineTo(s.x + 12, s.y + 18);
          ctx.stroke();
        }

        // Círculo do Pino
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = pv.motor
          ? '#f59e0b'
          : pv.trace
          ? '#a855f7'
          : isDark
          ? '#1e293b'
          : '#ffffff';
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = pv.trace ? '#a855f7' : '#2563eb';
        ctx.stroke();

        // Ícone rotativo do motor
        if (pv.motor) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 14, 0, 1.5 * Math.PI);
          ctx.stroke();
        }

        // Rótulo de Identificação do Eixo (ex: A1, B2)
        const pInitial = p.name ? p.name.charAt(0).toUpperCase() : 'P';
        const axisLabel = pv.label || `${pInitial}${pvIdx + 1}`;

        ctx.save();
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        ctx.fillText(axisLabel, s.x, s.y - 12);
        ctx.restore();

        // Destaque de seleção / hover
        if (isPivotSelected || isPivotHovered) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 11, 0, 2 * Math.PI);
          ctx.stroke();
        }
      });
    });

    // 7. Gizmos de Transformação na Peça Selecionada
    if (selection.partId && !simRunning) {
      const selPart = parts.find((p) => p.id === selection.partId && !p.hidden);
      if (selPart) {
        // Handle de Rotação Superior
        const rotHandleWorld = getPartRotateHandle(selPart);
        const rotHandleScreen = worldToScreen(rotHandleWorld, camera, w, h);
        const centerScreen = worldToScreen({ x: selPart.x, y: selPart.y }, camera, w, h);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(centerScreen.x, centerScreen.y);
        ctx.lineTo(rotHandleScreen.x, rotHandleScreen.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(rotHandleScreen.x, rotHandleScreen.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 8. Linha de Conexão Pendente de Junta
    if (pendingJointPivot) {
      const p1Pos = pivotWorldPos(pendingJointPivot.part, pendingJointPivot.pivot);
      const s1 = worldToScreen(p1Pos, camera, w, h);
      const targetPos = hoveredPivot
        ? pivotWorldPos(hoveredPivot.part, hoveredPivot.pivot)
        : dragState?.curWorld;

      if (targetPos) {
        const s2 = worldToScreen(targetPos, camera, w, h);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 9. Preview Interativo de Desenho de Elo (MotionGen Link Tool)
    if (dragState?.mode === 'drawLink' && dragState.anchorWorld) {
      const s1 = worldToScreen(dragState.anchorWorld, camera, w, h);
      const s2 = worldToScreen(dragState.curWorld, camera, w, h);
      const len = distance2D(dragState.anchorWorld, dragState.curWorld);
      const ang = Math.atan2(
        dragState.curWorld.y - dragState.anchorWorld.y,
        dragState.curWorld.x - dragState.anchorWorld.x
      );

      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cota viva de comprimento e ângulo
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${Math.round(len)} mm | ${(ang * (180 / Math.PI)).toFixed(0)}°`,
        (s1.x + s2.x) / 2,
        (s1.y + s2.y) / 2 - 10
      );
      ctx.restore();
    }
  }, [camera, parts, joints, selection, trails, dragState, hoveredPivot, hoveredSlot, hoveredPart, pendingJointPivot, telemetryHoverPoint, simRunning]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.setPointerCapture(e.pointerId);

    const rect = cv.getBoundingClientRect();
    const screenPt: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = screenToWorld(screenPt, camera, cv.clientWidth, cv.clientHeight);

    // Botão do meio ou barra de espaço pressionada = Pan
    if (e.button === 1 || e.buttons === 4 || e.altKey || (e.shiftKey && e.button === 0 && tool === 'sel' && !hitPart(worldPt, parts))) {
      setDragState({
        mode: 'pan',
        startScreen: screenPt,
        startWorld: worldPt,
        curWorld: worldPt,
      });
      return;
    }

    if (simRunning && tool !== 'sel') return;

    // Ferramenta 1-Clique: Criar elo interativo clicando e arrastando (MotionGen style)
    if (tool === 'bar') {
      const snap = getSnapPoint(worldPt, parts, camera);
      setDragState({
        mode: 'drawLink',
        startScreen: screenPt,
        startWorld: snap.point,
        anchorWorld: snap.point,
        curWorld: snap.point,
      });
      return;
    }

    // Ferramenta 1-Clique: Inserir Retângulo, Círculo ou Triângulo
    if (tool === 'rect' || tool === 'circle' || tool === 'tri') {
      recordSnapshot();
      const snap = getSnapPoint(worldPt, parts, camera);
      const newPartId = Date.now();
      const w = tool === 'circle' ? 80 : tool === 'tri' ? 100 : 120;
      const h = tool === 'circle' ? 80 : tool === 'tri' ? 80 : 60;

      let pivots: Pivot[] = [];
      if (tool === 'rect') {
        const a = w / 2 - 12;
        const b = h / 2 - 12;
        pivots = [
          { id: Date.now() + 1, label: 'R1', lx: -a, ly: -b },
          { id: Date.now() + 2, label: 'R2', lx: a, ly: -b },
          { id: Date.now() + 3, label: 'R3', lx: a, ly: b },
          { id: Date.now() + 4, label: 'R4', lx: -a, ly: b },
        ];
      } else if (tool === 'circle') {
        pivots = [
          { id: Date.now() + 1, label: 'C1', lx: 0, ly: 0 },
          { id: Date.now() + 2, label: 'C2', lx: w / 2 - 12, ly: 0 },
        ];
      } else {
        pivots = [
          { id: Date.now() + 1, label: 'T1', lx: -0.36 * w, ly: 0.36 * h },
          { id: Date.now() + 2, label: 'T2', lx: 0.36 * w, ly: 0.36 * h },
          { id: Date.now() + 3, label: 'T3', lx: 0, ly: -0.36 * h },
        ];
      }

      const p: Part = {
        id: newPartId,
        name: tool === 'rect' ? 'Retângulo' : tool === 'circle' ? 'Disco' : 'Triângulo',
        type: tool,
        x: snap.point.x,
        y: snap.point.y,
        rot: 0,
        w,
        h,
        pivots,
      };

      addPart(p);
      setTool('sel');
      return;
    }

    // Ferramenta 1-Clique: Inserir Engrenagem
    if (tool === 'gear') {
      recordSnapshot();
      const snap = getSnapPoint(worldPt, parts, camera);
      addGearPart(snap.point.x, snap.point.y, 20, 4, 'involute');
      setTool('sel');
      return;
    }

    // Ferramentas de Aplicação Rápida em Eixos:
    const visibleParts = parts.filter((p) => !p.hidden);
    const clickedPivot = hitPivot(worldPt, visibleParts, camera);
    const clickedSlot = hitSlot(worldPt, visibleParts, camera);
    const clickedPart = hitPart(worldPt, visibleParts);

    if (tool === 'motor') {
      if (clickedPivot) togglePivotMotor(clickedPivot.pivot.id);
      return;
    }
    if (tool === 'ground') {
      if (clickedPivot) togglePivotGround(clickedPivot.pivot.id);
      return;
    }
    if (tool === 'slider') {
      if (clickedPivot) togglePivotSlider(clickedPivot.pivot.id);
      return;
    }
    if (tool === 'trace') {
      if (clickedPivot) togglePivotTrace(clickedPivot.pivot.id);
      return;
    }

    // Ferramenta Adicionar Fenda (+ Slot)
    if (tool === 'slot') {
      if (clickedPart) {
        recordSnapshot();
        const [rawLx, rawLy] = rotate2D(worldPt.x - clickedPart.x, worldPt.y - clickedPart.y, -clickedPart.rot);
        const ly = clickedPart.type === 'bar' ? 0 : rawLy;
        const maxSlotLen = Math.min(80, Math.max(20, Math.round(clickedPart.w - 24)));
        const halfLen = maxSlotLen / 2;
        const lx = Math.max(-clickedPart.w / 2 + halfLen + 4, Math.min(clickedPart.w / 2 - halfLen - 4, rawLx));
        addSlotToPart(clickedPart.id, maxSlotLen, 0, true, lx, ly);
        setSelection({ partId: clickedPart.id });
        setTool('sel');
      }
      return;
    }

    // Ferramenta Adicionar Eixo (+ Axis)
    if (tool === 'axis') {
      if (clickedPart) {
        recordSnapshot();
        let [lx, ly] = rotate2D(worldPt.x - clickedPart.x, worldPt.y - clickedPart.y, -clickedPart.rot);
        if (clickedPart.type === 'bar' && Math.abs(ly) < 12) {
          ly = 0; // snap automático ao centro da barra
        }
        const newPivotId = Date.now();
        const initial = clickedPart.name.charAt(0).toUpperCase();
        const newLabel = `${initial}${clickedPart.pivots.length + 1}`;

        updatePart(clickedPart.id, (p) => ({
          ...p,
          pivots: [...p.pivots, { id: newPivotId, label: newLabel, lx, ly }],
        }));
        setSelection({ partId: clickedPart.id, pivotId: newPivotId });
      }
      return;
    }

    // Ferramenta Conectar Junta
    if (tool === 'joint') {
      if (clickedPivot) {
        if (!pendingJointPivot) {
          setPendingJointPivot(clickedPivot);
        } else {
          if (
            pendingJointPivot.part.type === 'gear' &&
            clickedPivot.part.type === 'gear' &&
            pendingJointPivot.part.id !== clickedPivot.part.id
          ) {
            connectGears(pendingJointPivot.part, clickedPivot.part);
          } else {
            connectJoint(pendingJointPivot, clickedPivot);
          }
          setPendingJointPivot(null);
        }
      } else if (clickedSlot && pendingJointPivot) {
        connectPinToSlot(pendingJointPivot, clickedSlot);
        setPendingJointPivot(null);
      } else if (clickedPart && clickedPart.type === 'gear') {
        if (
          pendingJointPivot &&
          pendingJointPivot.part.type === 'gear' &&
          pendingJointPivot.part.id !== clickedPart.id
        ) {
          connectGears(pendingJointPivot.part, clickedPart);
          setPendingJointPivot(null);
        } else if (clickedPart.pivots[0]) {
          setPendingJointPivot({ part: clickedPart, pivot: clickedPart.pivots[0] });
        }
      }
      return;
    }

    // Ferramenta Excluir
    if (tool === 'del') {
      if (clickedPivot) {
        store.deletePivot(clickedPivot.part.id, clickedPivot.pivot.id);
      } else if (clickedSlot) {
        deleteSlot(clickedSlot.part.id, clickedSlot.slot.id);
      } else if (clickedPart) {
        deletePart(clickedPart.id);
      }
      return;
    }

    // Ferramenta Seleção & Manipulação Direta (CAD)
    if (tool === 'sel') {
      // 1. Verificar se clicou no Gizmo de Rotação da peça selecionada
      if (selection.partId) {
        const selPart = parts.find((p) => p.id === selection.partId);
        if (selPart) {
          const gizmoHit = hitGizmo(worldPt, selPart, camera);
          if (gizmoHit?.type === 'rotate') {
            recordSnapshot();
            setDragState({
              mode: 'rotatePart',
              startScreen: screenPt,
              startWorld: worldPt,
              targetPart: selPart,
              initialPartRot: selPart.rot,
              curWorld: worldPt,
            });
            return;
          }
        }
      }

      // 2. Clicou em um pivô existente? (Redimensiona barra(s) conectadas - MotionGen!)
      if (clickedPivot) {
        recordSnapshot();
        setSelection({ partId: clickedPivot.part.id, pivotId: clickedPivot.pivot.id });

        if (!simRunning) {
          // Encontrar cluster de todos os pivôs conectados a este por juntas
          const cluster = new Set<number>([clickedPivot.pivot.id]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const j of joints) {
              if (j.p2 !== undefined) {
                if (cluster.has(j.p1) && !cluster.has(j.p2)) {
                  cluster.add(j.p2);
                  changed = true;
                } else if (cluster.has(j.p2) && !cluster.has(j.p1)) {
                  cluster.add(j.p1);
                  changed = true;
                }
              }
            }
          }

          const connectedBars: ConnectedBarInfo[] = [];
          const connectedOtherParts: { partId: number; pivotId: number }[] = [];

          for (const p of parts) {
            const matchPv = p.pivots.find((v) => cluster.has(v.id));
            if (!matchPv) continue;

            if (p.type === 'bar' && p.pivots.length >= 2) {
              const pvIdx = p.pivots.findIndex((v) => v.id === matchPv.id);
              if (pvIdx === 0 || pvIdx === 1) {
                const isSecond = pvIdx === 1;
                const anchorPv = isSecond ? p.pivots[0] : p.pivots[1];
                const anchorWorld = pivotWorldPos(p, anchorPv);

                // Preserva proporção de pivôs intermediários/acopladores
                const extraPivots: ConnectedBarInfo['extraPivots'] = [];
                const origLen = Math.hypot(p.pivots[1].lx - p.pivots[0].lx, p.pivots[1].ly - p.pivots[0].ly) || 1;
                for (let i = 2; i < p.pivots.length; i++) {
                  const ep = p.pivots[i];
                  extraPivots.push({
                    id: ep.id,
                    relRatio: (ep.lx - p.pivots[0].lx) / origLen,
                    perpDist: ep.ly,
                  });
                }

                connectedBars.push({
                  partId: p.id,
                  movingPivotId: matchPv.id,
                  isSecondPivot: isSecond,
                  anchorWorld,
                  extraPivots,
                });
              } else {
                connectedOtherParts.push({ partId: p.id, pivotId: matchPv.id });
              }
            } else {
              connectedOtherParts.push({ partId: p.id, pivotId: matchPv.id });
            }
          }

          setDragState({
            mode: 'dragPivotCluster',
            startScreen: screenPt,
            startWorld: worldPt,
            curWorld: worldPt,
            clusterIds: Array.from(cluster),
            connectedBars,
            connectedOtherParts,
          });
        }
        return;
      }

      // 3. Clicou em uma peça existente?
      if (clickedPart) {
        recordSnapshot();
        setSelection({ partId: clickedPart.id });
        if (!simRunning) {
          setDragState({
            mode: 'dragPart',
            startScreen: screenPt,
            startWorld: worldPt,
            targetPart: clickedPart,
            initialPartPos: { x: clickedPart.x, y: clickedPart.y },
            curWorld: worldPt,
          });
        }
        return;
      }

      // 4. Clicou no espaço vazio = desmarcar ou iniciar Pan
      setSelection({});
      setDragState({
        mode: 'pan',
        startScreen: screenPt,
        startWorld: worldPt,
        curWorld: worldPt,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;

    const rect = cv.getBoundingClientRect();
    const screenPt: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const rawWorld = screenToWorld(screenPt, camera, cv.clientWidth, cv.clientHeight);

    // Atualizar Hover states
    const visibleParts = parts.filter((p) => !p.hidden);
    setHoveredPivot(hitPivot(rawWorld, visibleParts, camera));
    setHoveredSlot(hitSlot(rawWorld, visibleParts, camera));
    setHoveredPart(hitPart(rawWorld, visibleParts));

    if (!dragState) return;

    // Pan do Canvas
    if (dragState.mode === 'pan') {
      const dx = (screenPt.x - dragState.startScreen.x) / camera.zoom;
      const dy = (screenPt.y - dragState.startScreen.y) / camera.zoom;
      setCamera((c) => ({
        ...c,
        x: c.x - dx,
        y: c.y - dy,
      }));
      setDragState((prev) => (prev ? { ...prev, startScreen: screenPt } : null));
      return;
    }

    // Desenhar Barra / Elo (MotionGen Drag-to-Create)
    if (dragState.mode === 'drawLink' && dragState.anchorWorld) {
      const snap = getSnapPoint(rawWorld, parts, camera);
      setDragState((prev) => (prev ? { ...prev, curWorld: snap.point } : null));
      return;
    }

    // Rotacionar Peça via Gizmo
    if (dragState.mode === 'rotatePart' && dragState.targetPart) {
      const part = dragState.targetPart;
      const currentAng = Math.atan2(rawWorld.y - part.y, rawWorld.x - part.x);
      const startAng = Math.atan2(dragState.startWorld.y - part.y, dragState.startWorld.x - part.x);
      let newRot = (dragState.initialPartRot ?? 0) + (currentAng - startAng);

      // Snap angular com Shift (15 graus)
      if (e.shiftKey) {
        const step = (15 * Math.PI) / 180;
        newRot = Math.round(newRot / step) * step;
      }

      updatePart(part.id, (p) => ({ ...p, rot: newRot }));
      setDragState((prev) => (prev ? { ...prev, curWorld: rawWorld } : null));
      return;
    }

    // Arrastar Eixo / Nó Conectado: Redimensiona e Rotaciona Todas as Barras Conectadas!
    if (dragState.mode === 'dragPivotCluster' && dragState.connectedBars) {
      const snap = getSnapPoint(rawWorld, parts, camera, dragState.clusterIds?.[0]);
      const targetPos = snap.point;

      // 1. Atualizar todas as barras conectadas ao nó
      dragState.connectedBars.forEach((bInfo) => {
        const anchor = bInfo.anchorWorld;
        const len = Math.max(15, distance2D(anchor, targetPos));
        const ang = bInfo.isSecondPivot
          ? Math.atan2(targetPos.y - anchor.y, targetPos.x - anchor.x)
          : Math.atan2(anchor.y - targetPos.y, anchor.x - targetPos.x);

        const cx = (anchor.x + targetPos.x) / 2;
        const cy = (anchor.y + targetPos.y) / 2;

        updatePart(bInfo.partId, (p) => {
          const newPivots = p.pivots.map((pv, idx) => {
            if (idx === 0) return { ...pv, lx: -len / 2, ly: 0 };
            if (idx === 1) return { ...pv, lx: len / 2, ly: 0 };
            const ep = bInfo.extraPivots.find((x) => x.id === pv.id);
            if (ep) {
              return {
                ...pv,
                lx: -len / 2 + ep.relRatio * len,
                ly: ep.perpDist,
              };
            }
            return pv;
          });

          return {
            ...p,
            w: len + p.h,
            rot: ang,
            x: cx,
            y: cy,
            pivots: newPivots,
          };
        });
      });

      // 2. Para outras peças que não são barras ou pivôs adicionais
      if (dragState.connectedOtherParts) {
        dragState.connectedOtherParts.forEach((op) => {
          updatePart(op.partId, (p) => {
            const pv = p.pivots.find((v) => v.id === op.pivotId);
            if (!pv) return p;

            // Se for barra e for um pivô intermediário (A3+), ajusta sua posição local (lx, ly)
            if (p.type === 'bar' && p.pivots.indexOf(pv) >= 2) {
              const [relX, rawRelY] = rotate2D(targetPos.x - p.x, targetPos.y - p.y, -p.rot);
              const relY = Math.abs(rawRelY) < 8 ? 0 : rawRelY;
              return {
                ...p,
                pivots: p.pivots.map((v) => (v.id === op.pivotId ? { ...v, lx: relX, ly: relY } : v)),
              };
            }

            // Se a peça tiver um pivô fixo ao terra (e não for o que está sendo arrastado):
            const fixedPv = p.pivots.find((v) => (v.fixed || v.motor) && v.id !== op.pivotId);
            if (fixedPv) {
              const origAngle = Math.atan2(pv.ly - fixedPv.ly, pv.lx - fixedPv.lx);
              const fixedWorld = pivotWorldPos(p, fixedPv);
              const newAngle = Math.atan2(targetPos.y - fixedWorld.y, targetPos.x - fixedWorld.x);
              return {
                ...p,
                rot: newAngle - origAngle,
              };
            }

            const [rx, ry] = rotate2D(pv.lx, pv.ly, p.rot);
            return {
              ...p,
              x: targetPos.x - rx,
              y: targetPos.y - ry,
            };
          });
        });
      }

      setDragState((prev) => (prev ? { ...prev, curWorld: targetPos } : null));
      return;
    }

    // Mover Peça Inteira
    if (dragState.mode === 'dragPart' && dragState.targetPart && dragState.initialPartPos) {
      const dx = rawWorld.x - dragState.startWorld.x;
      const dy = rawWorld.y - dragState.startWorld.y;
      let newX = dragState.initialPartPos.x + dx;
      let newY = dragState.initialPartPos.y + dy;

      if (camera.snapToGrid) {
        newX = Math.round(newX / camera.gridSize) * camera.gridSize;
        newY = Math.round(newY / camera.gridSize) * camera.gridSize;
      }

      // Auto-snap magnético para engrenagens com alinhamento de fase de dentes
      let newRot = dragState.targetPart.rot;
      if (dragState.targetPart.type === 'gear' && dragState.targetPart.gear) {
        const otherGears = parts.filter(
          (op) => op.id !== dragState.targetPart!.id && op.type === 'gear' && op.gear && !op.hidden
        );
        for (const og of otherGears) {
          const testPart: Part = { ...dragState.targetPart, x: newX, y: newY };
          const contact = calculateGearContact(og, testPart);
          if (contact) {
            const idealPos = getIdealMeshedPosition(og, testPart);
            const distToIdeal = Math.hypot(newX - idealPos.x, newY - idealPos.y);
            if (distToIdeal < 18) {
              newX = idealPos.x;
              newY = idealPos.y;
              newRot = calculateMeshedRotation(og, testPart, idealPos);
              break;
            }
          }
        }
      }

      updatePart(dragState.targetPart.id, (p) => ({ ...p, x: newX, y: newY, rot: newRot }));
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (cv) cv.releasePointerCapture(e.pointerId);

    // Finalizar Criação de Elo Ponto-a-Ponto (MotionGen style)
    if (dragState?.mode === 'drawLink' && dragState.anchorWorld) {
      const len = distance2D(dragState.anchorWorld, dragState.curWorld);
      if (len > 20) {
        recordSnapshot();
        const p1Snap = getSnapPoint(dragState.anchorWorld, parts, camera);
        const p2Snap = getSnapPoint(dragState.curWorld, parts, camera);

        const newBar = createBar(
          dragState.anchorWorld.x,
          dragState.anchorWorld.y,
          dragState.curWorld.x,
          dragState.curWorld.y,
          `Barra ${parts.length + 1}`
        );

        addPart(newBar);

        // Se iniciou sobre um pivô existente, unir automaticamente!
        if (p1Snap.snappedTo === 'pivot' && p1Snap.targetPivot) {
          connectJoint(
            { part: newBar, pivot: newBar.pivots[0] },
            p1Snap.targetPivot
          );
        }

        // Se terminou sobre um pivô existente, unir automaticamente!
        if (p2Snap.snappedTo === 'pivot' && p2Snap.targetPivot) {
          connectJoint(
            { part: newBar, pivot: newBar.pivots[1] },
            p2Snap.targetPivot
          );
        }

        setTool('sel');
      }
    }

    setDragState(null);
  };

  // Zoom no Cursor com a Roda do Mouse
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cv = canvasRef.current;
    if (!cv) return;

    const rect = cv.getBoundingClientRect();
    const screenPt: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldBefore = screenToWorld(screenPt, camera, cv.clientWidth, cv.clientHeight);

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(5.0, Math.max(0.2, camera.zoom * zoomFactor));

    // Mantém o ponto do mundo fixo sob o cursor
    const cx = cv.clientWidth / 2;
    const cy = cv.clientHeight / 2;
    const newCameraX = worldBefore.x - (screenPt.x - cx) / newZoom;
    const newCameraY = worldBefore.y - (screenPt.y - cy) / newZoom;

    setCamera((c) => ({
      ...c,
      zoom: newZoom,
      x: newCameraX,
      y: newCameraY,
    }));
  };

  // Elemento selecionado para Floating Quick Actions
  const selectedPart = parts.find((p) => p.id === selection.partId);
  const selectedPivot = selectedPart?.pivots.find((v) => v.id === selection.pivotId);

  return (
    <div className="relative flex-1 w-full h-full min-w-0 min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-900 select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair touch-none"
        style={{ cursor: tool === 'sel' ? (dragState?.mode === 'pan' ? 'grabbing' : 'default') : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Quick Action Bar (Próxima à seleção) */}
      {selectedPart && !simRunning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 z-10 transition-all">
          <span className="font-semibold mr-1">{selectedPart.name}:</span>
          {selectedPivot ? (
            <>
              <button
                onClick={() => togglePivotGround(selectedPivot.id)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedPivot.fixed ? 'bg-amber-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Apoio Fixo ao Plano"
              >
                ▲ Fixo
              </button>
              <button
                onClick={() => togglePivotMotor(selectedPivot.id)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedPivot.motor ? 'bg-amber-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Motor Rotativo Acionador"
              >
                ⚙ Motor
              </button>
              <button
                onClick={() => togglePivotSlider(selectedPivot.id)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedPivot.slider?.enabled ? 'bg-cyan-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Guia Linear Prismática (Slider)"
              >
                ⇄ Slider
              </button>
              <button
                onClick={() => togglePivotTrace(selectedPivot.id)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedPivot.trace ? 'bg-purple-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Traçar Trajetória (Coupler Curve)"
              >
                ✎ Traçar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => togglePartVisibility(selectedPart.id)}
                className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Ocultar Peça e Eixos (H)"
              >
                Ocultar
              </button>
              <button
                onClick={duplicateSelected}
                className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Duplicar Peça (Ctrl+D)"
              >
                Duplicar
              </button>
              <button
                onClick={() => deletePart(selectedPart.id)}
                className="px-2 py-1 rounded hover:bg-red-50 text-red-600 dark:hover:bg-red-950/50 transition-colors"
                title="Excluir Peça (Del)"
              >
                Excluir
              </button>
            </>
          )}
        </div>
      )}

      {/* Botão para Reexibir Peças Ocultas */}
      {parts.some((p) => p.hidden) && (
        <button
          onClick={showAllParts}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg text-xs font-semibold z-10 transition-all cursor-pointer"
          title="Reexibir todas as peças ocultas"
        >
          <span>👁 Mostrar Ocultas ({parts.filter((p) => p.hidden).length})</span>
        </button>
      )}

      {/* Dica de Teclado no Rodapé */}
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 pointer-events-none">
        {tool === 'bar'
          ? 'Clique e arraste para desenhar uma barra (conecta automaticamente se soltar sobre eixos).'
          : tool === 'sel'
          ? 'Arraste qualquer eixo/junta para ajustar o comprimento e rotação da barra em tempo real.'
          : tool === 'joint'
          ? 'Clique em dois eixos de peças distintas para uni-los por junta revoluta.'
          : 'Clique sobre a peça ou eixo desejado.'}
      </div>
    </div>
  );
};

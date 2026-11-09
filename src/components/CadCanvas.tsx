import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import {
  distance2D,
  getPartRotateHandle,
  getSnapPoint,
  hitGizmo,
  hitPart,
  hitPivot,
  pivotWorldPos,
  rotate2D,
  screenToWorld,
  worldToScreen,
} from '../engine/geometry';
import { Part, Pivot, Point2D } from '../types/mechanism';
import { createBar } from '../engine/presets';

interface CadCanvasProps {
  store: MechanismStore;
}

export const CadCanvas: React.FC<CadCanvasProps> = ({ store }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados locais de interação
  const [dragState, setDragState] = useState<{
    mode:
      | 'pan'
      | 'dragPart'
      | 'dragPivot'
      | 'rotatePart'
      | 'endpointDrag'
      | 'drawLink'
      | 'drawShape';
    startScreen: Point2D;
    startWorld: Point2D;
    initialPartPos?: Point2D;
    initialPartRot?: number;
    initialPivotPos?: Point2D;
    targetPart?: Part;
    targetPivot?: Pivot;
    endpointIndex?: number;
    anchorWorld?: Point2D;
    curWorld: Point2D;
  } | null>(null);

  const [hoveredPivot, setHoveredPivot] = useState<{ part: Part; pivot: Pivot } | null>(null);
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
    recordSnapshot,
    addPart,
    updatePart,
    connectJoint,
    pendingJointPivot,
    setPendingJointPivot,
    togglePivotGround,
    togglePivotMotor,
    togglePivotSlider,
    togglePivotTrace,
    deletePart,
    duplicateSelected,
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
  }, [simRunning, stepSim, parts, joints, camera, selection, trails, dragState, hoveredPivot, hoveredPart, pendingJointPivot]);

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

    // 2. Trajetórias (Coupler Curves)
    if (camera.showTrails) {
      for (const pId in trails) {
        const pts = trails[pId];
        if (!pts || pts.length < 2) continue;

        const pivotOwner = parts.flatMap((p) => p.pivots).find((pv) => pv.id === Number(pId));
        ctx.strokeStyle = pivotOwner?.traceColor || '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach((pt, idx) => {
          const s = worldToScreen(pt, camera, w, h);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
      }
    }

    // 3. Trilhas de Guias Lineares (Sliders)
    parts.forEach((p) => {
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
    parts.forEach((p) => {
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

      // Cotas de Dimensão na peça selecionada
      if (camera.showDimensions && isSelected) {
        ctx.fillStyle = isDark ? '#93c5fd' : '#1d4ed8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${Math.round(p.w)} mm × ${(p.rot * (180 / Math.PI)).toFixed(1)}°`,
          0,
          -sh / 2 - 8
        );
      }

      ctx.restore();
    });

    // 5. Juntas Conectadas
    joints.forEach((j) => {
      let p1Pos: Point2D | null = null;
      let p2Pos: Point2D | null = null;

      for (const p of parts) {
        for (const pv of p.pivots) {
          if (pv.id === j.p1) p1Pos = pivotWorldPos(p, pv);
          if (pv.id === j.p2) p2Pos = pivotWorldPos(p, pv);
        }
      }

      if (p1Pos && p2Pos) {
        const s1 = worldToScreen(p1Pos, camera, w, h);
        const s2 = worldToScreen(p2Pos, camera, w, h);
        const d = distance2D(s1, s2);

        // Se houver desalinhamento residual durante solver, mostrar linha tracejada de advertência
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

        // Círculo concêntrico da junta
        ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, 11, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // 6. Eixos / Pivôs (Fixo, Motor, Slider, Normal)
    parts.forEach((p) => {
      p.pivots.forEach((pv) => {
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
      const selPart = parts.find((p) => p.id === selection.partId);
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
  }, [camera, parts, joints, selection, trails, dragState, hoveredPivot, hoveredPart, pendingJointPivot, simRunning]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.setPointerCapture(e.pointerId);

    const rect = cv.getBoundingClientRect();
    const screenPt: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPt = screenToWorld(screenPt, camera, cv.clientWidth, cv.clientHeight);

    // Botão do meio ou barra de espaço pressionada = Pan
    if (e.button === 1 || e.buttons === 4 || e.altKey || e.shiftKey && e.button === 0 && tool === 'sel' && !hitPart(worldPt, parts)) {
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
          { id: Date.now() + 1, lx: -a, ly: -b },
          { id: Date.now() + 2, lx: a, ly: -b },
          { id: Date.now() + 3, lx: a, ly: b },
          { id: Date.now() + 4, lx: -a, ly: b },
        ];
      } else if (tool === 'circle') {
        pivots = [
          { id: Date.now() + 1, lx: 0, ly: 0 },
          { id: Date.now() + 2, lx: w / 2 - 12, ly: 0 },
        ];
      } else {
        pivots = [
          { id: Date.now() + 1, lx: -0.36 * w, ly: 0.36 * h },
          { id: Date.now() + 2, lx: 0.36 * w, ly: 0.36 * h },
          { id: Date.now() + 3, lx: 0, ly: -0.36 * h },
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

    // Ferramentas de Aplicação Rápida em Eixos:
    const clickedPivot = hitPivot(worldPt, parts, camera);
    const clickedPart = hitPart(worldPt, parts);

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

    // Ferramenta Adicionar Eixo (+ Axis)
    if (tool === 'axis') {
      if (clickedPart) {
        recordSnapshot();
        const [lx, ly] = rotate2D(worldPt.x - clickedPart.x, worldPt.y - clickedPart.y, -clickedPart.rot);
        const newPivotId = Date.now();
        updatePart(clickedPart.id, (p) => ({
          ...p,
          pivots: [...p.pivots, { id: newPivotId, lx, ly }],
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
          connectJoint(pendingJointPivot, clickedPivot);
          setPendingJointPivot(null);
        }
      }
      return;
    }

    // Ferramenta Excluir
    if (tool === 'del') {
      if (clickedPivot) {
        store.deletePivot(clickedPivot.part.id, clickedPivot.pivot.id);
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
          if (gizmoHit?.type === 'endpoint-start' || gizmoHit?.type === 'endpoint-end') {
            recordSnapshot();
            const endpointIndex = gizmoHit.type === 'endpoint-start' ? 0 : 1;
            const otherIndex = endpointIndex === 0 ? 1 : 0;
            const otherPivot = selPart.pivots[otherIndex];
            const anchor = pivotWorldPos(selPart, otherPivot);

            setDragState({
              mode: 'endpointDrag',
              startScreen: screenPt,
              startWorld: worldPt,
              targetPart: selPart,
              endpointIndex,
              anchorWorld: anchor,
              curWorld: worldPt,
            });
            return;
          }
        }
      }

      // 2. Clicou em um pivô existente?
      if (clickedPivot) {
        recordSnapshot();
        setSelection({ partId: clickedPivot.part.id, pivotId: clickedPivot.pivot.id });
        if (!simRunning) {
          setDragState({
            mode: 'dragPivot',
            startScreen: screenPt,
            startWorld: worldPt,
            targetPart: clickedPivot.part,
            targetPivot: clickedPivot.pivot,
            initialPivotPos: { x: clickedPivot.pivot.lx, y: clickedPivot.pivot.ly },
            curWorld: worldPt,
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
    setHoveredPivot(hitPivot(rawWorld, parts, camera));
    setHoveredPart(hitPart(rawWorld, parts));

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

    // Arrastar Extremidade da Barra (Endpoint Drag / Stretch)
    if (dragState.mode === 'endpointDrag' && dragState.targetPart && dragState.anchorWorld) {
      const snap = getSnapPoint(rawWorld, parts, camera);
      const anchor = dragState.anchorWorld;
      const cur = snap.point;
      const len = Math.max(20, distance2D(anchor, cur));
      const ang = Math.atan2(cur.y - anchor.y, cur.x - anchor.x);
      const cx = (anchor.x + cur.x) / 2;
      const cy = (anchor.y + cur.y) / 2;

      updatePart(dragState.targetPart.id, (p) => {
        const p0 = p.pivots[0];
        const p1 = p.pivots[1];
        if (!p0 || !p1) return p;

        return {
          ...p,
          x: cx,
          y: cy,
          rot: ang,
          w: len + 20,
          pivots: [
            { ...p0, lx: -len / 2, ly: 0 },
            { ...p1, lx: len / 2, ly: 0 },
          ],
        };
      });

      setDragState((prev) => (prev ? { ...prev, curWorld: cur } : null));
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

      updatePart(dragState.targetPart.id, (p) => ({ ...p, x: newX, y: newY }));
      return;
    }

    // Mover Eixo / Pivô dentro da Peça
    if (dragState.mode === 'dragPivot' && dragState.targetPart && dragState.targetPivot) {
      const p = dragState.targetPart;
      const [lx, ly] = rotate2D(rawWorld.x - p.x, rawWorld.y - p.y, -p.rot);

      updatePart(p.id, (part) => ({
        ...part,
        pivots: part.pivots.map((pv) => (pv.id === dragState.targetPivot?.id ? { ...pv, lx, ly } : pv)),
      }));
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

      {/* Dica de Teclado no Rodapé */}
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 pointer-events-none">
        {tool === 'bar'
          ? 'Clique e arraste para desenhar uma barra (conecta automaticamente se soltar sobre eixos).'
          : tool === 'sel'
          ? 'Clique e arraste para mover peças ou eixos. Alça azul gira a peça. Barra de espaço + arraste faz Pan.'
          : tool === 'joint'
          ? 'Clique em dois eixos de peças distintas para uni-los por junta revoluta.'
          : 'Clique sobre a peça ou eixo desejado.'}
      </div>
    </div>
  );
};

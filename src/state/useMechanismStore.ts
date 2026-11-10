import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Camera,
  Joint,
  MechanismAnalysis,
  Part,
  PartSlot,
  Pivot,
  Point2D,
  SelectionState,
  TelemetrySample,
  ToolType,
} from '../types/mechanism';
import { analyzeMechanism, createSimulation, stepSimulation, SimulationInstance } from '../engine/kinematics';
import { PRESETS } from '../engine/presets';
import { pivotWorldPos, slotWorldCenter } from '../engine/geometry';
import { syncPartsAndPivots } from '../engine/naming';

export interface MechanismStateSnapshot {
  parts: Part[];
  joints: Joint[];
}

export const useMechanismStore = () => {
  // Inicializa com o preset 4-barras
  const initialPreset = PRESETS.fourBar();
  const [parts, setParts] = useState<Part[]>(initialPreset.parts);
  const [joints, setJoints] = useState<Joint[]>(initialPreset.joints);

  const [selection, setSelection] = useState<SelectionState>({ partId: initialPreset.parts[0]?.id });
  const [tool, setTool] = useState<ToolType>('sel');
  const [pendingJointPivot, setPendingJointPivot] = useState<{ part: Part; pivot: Pivot } | null>(null);

  // Câmera e visualização
  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    zoom: 1.2,
    gridSize: 20,
    snapToGrid: true,
    snapToPivots: true,
    showDimensions: true,
    showTrails: true,
    showVectors: false,
  });

  // Simulação
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(60); // RPM
  const [simDir, setSimDir] = useState<1 | -1>(1);
  const [simLockedUp, setSimLockedUp] = useState<boolean>(false);

  // Trajetórias e telemetria
  const [trails, setTrails] = useState<Record<number, Point2D[]>>({});
  const [telemetry, setTelemetry] = useState<Record<number, TelemetrySample[]>>({});

  // Análise mecânica (DOF, Grashof)
  const [analysis, setAnalysis] = useState<MechanismAnalysis>(() =>
    analyzeMechanism(initialPreset.parts, initialPreset.joints)
  );

  // Pilhas de Undo / Redo
  const undoStack = useRef<MechanismStateSnapshot[]>([]);
  const redoStack = useRef<MechanismStateSnapshot[]>([]);

  // Instância ativa de simulação e snapshot de restauração
  const simInstanceRef = useRef<SimulationInstance | null>(null);
  const simSnapshotRef = useRef<MechanismStateSnapshot | null>(null);

  // Recalcular análise sempre que partes ou juntas mudarem
  useEffect(() => {
    setAnalysis(analyzeMechanism(parts, joints));
  }, [parts, joints]);

  const recordSnapshot = useCallback(() => {
    const snap: MechanismStateSnapshot = {
      parts: JSON.parse(JSON.stringify(parts)),
      joints: JSON.parse(JSON.stringify(joints)),
    };
    undoStack.current.push(snap);
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
  }, [parts, joints]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const currentSnap: MechanismStateSnapshot = {
      parts: JSON.parse(JSON.stringify(parts)),
      joints: JSON.parse(JSON.stringify(joints)),
    };
    redoStack.current.push(currentSnap);

    const prev = undoStack.current.pop()!;
    setParts(prev.parts);
    setJoints(prev.joints);
    setTrails({});
    setTelemetry({});
    setSelection({});
  }, [parts, joints]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const currentSnap: MechanismStateSnapshot = {
      parts: JSON.parse(JSON.stringify(parts)),
      joints: JSON.parse(JSON.stringify(joints)),
    };
    undoStack.current.push(currentSnap);

    const next = redoStack.current.pop()!;
    setParts(next.parts);
    setJoints(next.joints);
    setTrails({});
    setTelemetry({});
    setSelection({});
  }, [parts, joints]);

  // Controles de Simulação
  const startSimulation = useCallback(() => {
    if (simRunning) return;
    simSnapshotRef.current = {
      parts: JSON.parse(JSON.stringify(parts)),
      joints: JSON.parse(JSON.stringify(joints)),
    };
    simInstanceRef.current = createSimulation(parts, joints);
    setSimRunning(true);
  }, [parts, joints, simRunning]);

  const pauseSimulation = useCallback(() => {
    setSimRunning(false);
  }, []);

  const resetSimulation = useCallback(() => {
    setSimRunning(false);
    if (simSnapshotRef.current) {
      setParts(JSON.parse(JSON.stringify(simSnapshotRef.current.parts)));
      setJoints(JSON.parse(JSON.stringify(simSnapshotRef.current.joints)));
    }
    simInstanceRef.current = null;
    setTrails({});
    setTelemetry({});
    setSimLockedUp(false);
  }, []);

  // Passo de simulação (chamado pelo loop de animação do Canvas)
  const stepSim = useCallback(
    (dt: number) => {
      if (!simInstanceRef.current) {
        simInstanceRef.current = createSimulation(parts, joints);
      }
      stepSimulation(
        simInstanceRef.current,
        parts,
        dt,
        simSpeed,
        simDir,
        trails,
        telemetry
      );
      setSimLockedUp(simInstanceRef.current.lockedUp);
    },
    [parts, joints, simSpeed, simDir, trails, telemetry]
  );

  // Ações de Peças e Juntas
  const addPart = useCallback(
    (newPart: Part) => {
      recordSnapshot();
      setParts((prev) => syncPartsAndPivots([...prev, newPart]));
      setSelection({ partId: newPart.id });
    },
    [recordSnapshot]
  );

  const updatePart = useCallback(
    (partId: number, updater: (p: Part) => Part) => {
      setParts((prev) => prev.map((p) => (p.id === partId ? updater(p) : p)));
    },
    []
  );

  const deletePart = useCallback(
    (partId: number) => {
      recordSnapshot();
      const target = parts.find((p) => p.id === partId);
      if (!target) return;
      const pivotIds = target.pivots.map((v) => v.id);

      setParts((prev) => syncPartsAndPivots(prev.filter((p) => p.id !== partId)));
      setJoints((prev) =>
        prev.filter((j) => !pivotIds.includes(j.p1) && (j.p2 === undefined || !pivotIds.includes(j.p2)))
      );
      setSelection({});
    },
    [parts, recordSnapshot]
  );

  const addPivotToPart = useCallback(
    (partId: number, lx: number, ly: number) => {
      recordSnapshot();
      const newPivotId = Date.now() + Math.floor(Math.random() * 1000);
      setParts((prev) =>
        syncPartsAndPivots(
          prev.map((p) => {
            if (p.id !== partId) return p;
            return {
              ...p,
              pivots: [...p.pivots, { id: newPivotId, lx, ly }],
            };
          })
        )
      );
      setSelection({ partId, pivotId: newPivotId });
    },
    [recordSnapshot]
  );

  const deletePivot = useCallback(
    (partId: number, pivotId: number) => {
      recordSnapshot();
      setParts((prev) =>
        syncPartsAndPivots(
          prev.map((p) => {
            if (p.id !== partId) return p;
            if (p.pivots.length <= 1) return p;
            return {
              ...p,
              pivots: p.pivots.filter((v) => v.id !== pivotId),
            };
          })
        )
      );
      setJoints((prev) => prev.filter((j) => j.p1 !== pivotId && j.p2 !== pivotId));
      setSelection({ partId });
    },
    [recordSnapshot]
  );

  const connectJoint = useCallback(
    (p1: { part: Part; pivot: Pivot }, p2: { part: Part; pivot: Pivot }) => {
      if (p1.pivot.id === p2.pivot.id || p1.part.id === p2.part.id) return;
      recordSnapshot();

      // Mover a peça 2 para que os pivôs fiquem exatamente coincidentes
      const pos1 = pivotWorldPos(p1.part, p1.pivot);
      const pos2 = pivotWorldPos(p2.part, p2.pivot);
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;

      setParts((prev) =>
        prev.map((p) => (p.id === p2.part.id ? { ...p, x: p.x + dx, y: p.y + dy } : p))
      );

      const newJoint: Joint = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        p1: p1.pivot.id,
        p2: p2.pivot.id,
        type: 'revolute',
      };

      setJoints((prev) => [...prev, newJoint]);
      setPendingJointPivot(null);
    },
    [recordSnapshot]
  );

  const disconnectJoint = useCallback(
    (jointId: number) => {
      recordSnapshot();
      setJoints((prev) => prev.filter((j) => j.id !== jointId));
    },
    [recordSnapshot]
  );

  // Gestão de Fendas (Slots)
  const addSlotToPart = useCallback(
    (partId: number, length = 80, angle = 0, closedEnds = true, lx = 0, ly = 0) => {
      recordSnapshot();
      setParts((prev) =>
        syncPartsAndPivots(
          prev.map((p) => {
            if (p.id !== partId) return p;
            const newSlot: PartSlot = {
              id: Date.now() + Math.floor(Math.random() * 1000),
              lx,
              ly,
              length,
              angle,
              width: 12,
              closedEnds,
            };
            return {
              ...p,
              slots: [...(p.slots || []), newSlot],
            };
          })
        )
      );
    },
    [recordSnapshot]
  );

  const updateSlot = useCallback(
    (partId: number, slotId: number, updater: Partial<PartSlot> | ((s: PartSlot) => PartSlot)) => {
      recordSnapshot();
      setParts((prev) =>
        syncPartsAndPivots(
          prev.map((p) => {
            if (p.id !== partId || !p.slots) return p;
            return {
              ...p,
              slots: p.slots.map((s) => {
                if (s.id !== slotId) return s;
                return typeof updater === 'function' ? updater(s) : { ...s, ...updater };
              }),
            };
          })
        )
      );
    },
    [recordSnapshot]
  );

  const deleteSlot = useCallback(
    (partId: number, slotId: number) => {
      recordSnapshot();
      setParts((prev) =>
        syncPartsAndPivots(
          prev.map((p) => {
            if (p.id !== partId || !p.slots) return p;
            return {
              ...p,
              slots: p.slots.filter((s) => s.id !== slotId),
            };
          })
        )
      );
      setJoints((prev) => prev.filter((j) => j.slotId !== slotId));
    },
    [recordSnapshot]
  );

  const connectPinToSlot = useCallback(
    (pivotRef: { part: Part; pivot: Pivot }, slotRef: { part: Part; slot: PartSlot }) => {
      if (pivotRef.part.id === slotRef.part.id) return;
      recordSnapshot();

      const sCenter = slotWorldCenter(slotRef.part, slotRef.slot);
      const pinPos = pivotWorldPos(pivotRef.part, pivotRef.pivot);
      const dx = sCenter.x - pinPos.x;
      const dy = sCenter.y - pinPos.y;

      if (!pivotRef.pivot.fixed && !pivotRef.pivot.motor) {
        setParts((prev) =>
          prev.map((p) => (p.id === pivotRef.part.id ? { ...p, x: p.x + dx, y: p.y + dy } : p))
        );
      }

      const newJoint: Joint = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        p1: pivotRef.pivot.id,
        slotId: slotRef.slot.id,
        type: 'pin-in-slot',
      };

      setJoints((prev) => [...prev, newJoint]);
      setPendingJointPivot(null);
    },
    [recordSnapshot]
  );

  // Toggles Rápidos no Inspetor / Floating Bar
  const togglePivotGround = useCallback(
    (pivotId: number) => {
      recordSnapshot();
      setParts((prev) =>
        prev.map((p) => ({
          ...p,
          pivots: p.pivots.map((v) => {
            if (v.id !== pivotId) return v;
            const willFix = !v.fixed;
            return {
              ...v,
              fixed: willFix,
              motor: willFix ? v.motor : false, // se desafixar, desliga motor
            };
          }),
        }))
      );
      setTrails({});
    },
    [recordSnapshot]
  );

  const togglePivotMotor = useCallback(
    (pivotId: number) => {
      recordSnapshot();
      setParts((prev) =>
        prev.map((p) => ({
          ...p,
          pivots: p.pivots.map((v) => {
            if (v.id !== pivotId) return v;
            const willMotor = !v.motor;
            return {
              ...v,
              motor: willMotor,
              fixed: willMotor ? true : v.fixed, // motor exige fixação ao terra
            };
          }),
        }))
      );
      setTrails({});
    },
    [recordSnapshot]
  );

  const togglePivotSlider = useCallback(
    (pivotId: number) => {
      recordSnapshot();
      setParts((prev) =>
        prev.map((p) => ({
          ...p,
          pivots: p.pivots.map((v) => {
            if (v.id !== pivotId) return v;
            const current = v.slider?.enabled;
            return {
              ...v,
              slider: current
                ? undefined
                : {
                    enabled: true,
                    angle: 0,
                    length: 180,
                  },
            };
          }),
        }))
      );
    },
    [recordSnapshot]
  );

  const togglePivotTrace = useCallback(
    (pivotId: number) => {
      recordSnapshot();
      setParts((prev) =>
        prev.map((p) => ({
          ...p,
          pivots: p.pivots.map((v) => {
            if (v.id !== pivotId) return v;
            return {
              ...v,
              trace: !v.trace,
              traceColor: v.traceColor || '#a855f7',
            };
          }),
        }))
      );
    },
    [recordSnapshot]
  );

  // Duplicar Peça
  const duplicateSelected = useCallback(() => {
    if (!selection.partId) return;
    const target = parts.find((p) => p.id === selection.partId);
    if (!target) return;
    recordSnapshot();

    const clone: Part = JSON.parse(JSON.stringify(target));
    clone.id = Date.now() + Math.floor(Math.random() * 1000);
    clone.name = `${target.name} (Cópia)`;
    clone.x += 25;
    clone.y += 25;
    clone.pivots.forEach((pv) => {
      pv.id = Date.now() + Math.floor(Math.random() * 1000);
      pv.fixed = false;
      pv.motor = false;
    });

    setParts((prev) => syncPartsAndPivots([...prev, clone]));
    setSelection({ partId: clone.id });
  }, [selection.partId, parts, recordSnapshot]);

  // Ocultar / Exibir Peças
  const togglePartVisibility = useCallback(
    (partId: number) => {
      recordSnapshot();
      setParts((prev) =>
        prev.map((p) => (p.id === partId ? { ...p, hidden: !p.hidden } : p))
      );
      setSelection((sel) => (sel.partId === partId ? {} : sel));
    },
    [recordSnapshot]
  );

  const showAllParts = useCallback(() => {
    recordSnapshot();
    setParts((prev) => prev.map((p) => ({ ...p, hidden: false })));
  }, [recordSnapshot]);

  // Carregar Preset
  const loadPreset = useCallback(
    (presetKey: keyof typeof PRESETS) => {
      resetSimulation();
      recordSnapshot();
      const p = PRESETS[presetKey]();
      setParts(p.parts);
      setJoints(p.joints);
      setTrails({});
      setTelemetry({});
      setSelection({ partId: p.parts[0]?.id });
      setCamera((c) => ({ ...c, x: 0, y: 0, zoom: 1.2 }));
    },
    [resetSimulation, recordSnapshot]
  );

  // Limpar Tudo
  const clearAll = useCallback(() => {
    resetSimulation();
    recordSnapshot();
    setParts([]);
    setJoints([]);
    setTrails({});
    setTelemetry({});
    setSelection({});
  }, [resetSimulation, recordSnapshot]);

  // Exportar / Importar JSON
  const exportJson = useCallback(() => {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      parts,
      joints,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mecanismo-${new Date().toISOString().slice(0, 10)}.mecadraw.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [parts, joints]);

  const importJson = useCallback(
    (jsonString: string) => {
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed.parts) && Array.isArray(parsed.joints)) {
          resetSimulation();
          recordSnapshot();
          setParts(parsed.parts);
          setJoints(parsed.joints);
          setTrails({});
          setTelemetry({});
          setSelection({});
        } else {
          alert('Arquivo JSON inválido para MecaDraw.');
        }
      } catch (err) {
        alert('Erro ao carregar arquivo JSON.');
      }
    },
    [resetSimulation, recordSnapshot]
  );

  // Exportar Trajetória CSV
  const exportCsv = useCallback(
    (pivotId: number) => {
      const data = telemetry[pivotId];
      if (!data || data.length === 0) {
        alert('Nenhum dado de telemetria gravado para este ponto. Execute a simulação.');
        return;
      }
      let csv = 'Tempo (s),X (mm),Y (mm),Vx (mm/s),Vy (mm/s),Velocidade (mm/s),Ax (mm/s2),Ay (mm/s2),Aceleracao (mm/s2)\n';
      data.forEach((row) => {
        csv += `${row.time.toFixed(4)},${row.x.toFixed(2)},${row.y.toFixed(2)},${row.vx.toFixed(2)},${row.vy.toFixed(2)},${row.speed.toFixed(2)},${row.ax.toFixed(2)},${row.ay.toFixed(2)},${row.accel.toFixed(2)}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trajetoria-pivo-${pivotId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [telemetry]
  );

  // Exportar Vetorial SVG (CAD)
  const exportSvg = useCallback(() => {
    const width = 1200;
    const height = 800;
    const cx = width / 2;
    const cy = height / 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
    svg += `  <rect width="100%" height="100%" fill="#ffffff"/>\n`;

    // Trajetórias
    for (const pId in trails) {
      const pts = trails[pId];
      if (!pts || pts.length < 2) continue;
      const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${(cx + pt.x).toFixed(1)} ${(cy + pt.y).toFixed(1)}`).join(' ');
      svg += `  <path d="${d}" fill="none" stroke="#a855f7" stroke-width="2.5"/>\n`;
    }

    // Peças
    parts.forEach((p) => {
      const px = cx + p.x;
      const py = cy + p.y;
      const deg = (p.rot * 180) / Math.PI;
      svg += `  <g transform="translate(${px.toFixed(1)}, ${py.toFixed(1)}) rotate(${deg.toFixed(1)})">\n`;
      if (p.type === 'circle') {
        svg += `    <circle cx="0" cy="0" r="${(p.w / 2).toFixed(1)}" fill="rgba(37,99,235,0.12)" stroke="#2563eb" stroke-width="2"/>\n`;
      } else {
        svg += `    <rect x="${(-p.w / 2).toFixed(1)}" y="${(-p.h / 2).toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" rx="${p.type === 'bar' ? (p.h / 2).toFixed(1) : 4}" fill="rgba(37,99,235,0.12)" stroke="#2563eb" stroke-width="2"/>\n`;
      }
      svg += `  </g>\n`;
    });

    // Eixos
    parts.forEach((p) => {
      p.pivots.forEach((pv) => {
        const wpos = pivotWorldPos(p, pv);
        svg += `  <circle cx="${(cx + wpos.x).toFixed(1)}" cy="${(cy + wpos.y).toFixed(1)}" r="5" fill="${pv.motor ? '#f59e0b' : '#ffffff'}" stroke="#2563eb" stroke-width="2"/>\n`;
      });
    });

    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mecanismo-${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [parts, trails]);

  return {
    parts,
    setParts,
    joints,
    setJoints,
    selection,
    setSelection,
    tool,
    setTool,
    pendingJointPivot,
    setPendingJointPivot,
    camera,
    setCamera,
    simRunning,
    simSpeed,
    setSimSpeed,
    simDir,
    setSimDir,
    simLockedUp,
    trails,
    telemetry,
    analysis,
    undoStackCount: undoStack.current.length,
    redoStackCount: redoStack.current.length,
    recordSnapshot,
    undo,
    redo,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    stepSim,
    addPart,
    updatePart,
    deletePart,
    addPivotToPart,
    deletePivot,
    connectJoint,
    disconnectJoint,
    addSlotToPart,
    updateSlot,
    deleteSlot,
    connectPinToSlot,
    togglePivotGround,
    togglePivotMotor,
    togglePivotSlider,
    togglePivotTrace,
    duplicateSelected,
    togglePartVisibility,
    showAllParts,
    loadPreset,
    clearAll,
    exportJson,
    importJson,
    exportCsv,
    exportSvg,
  };
};

export type MechanismStore = ReturnType<typeof useMechanismStore>;

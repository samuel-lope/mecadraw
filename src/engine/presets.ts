import { Joint, Part } from '../types/mechanism';
import { syncPartsAndPivots } from './naming';

let nextId = 100;

export const createBar = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  name = 'Barra',
  thickness = 16,
  labelPrefix?: string
): Part => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const p1Id = ++nextId;
  const p2Id = ++nextId;
  const prefix = labelPrefix || name.charAt(0).toUpperCase();

  return {
    id: ++nextId,
    name,
    type: 'bar',
    x: cx,
    y: cy,
    rot: ang,
    w: len + thickness,
    h: thickness,
    pivots: [
      { id: p1Id, label: `${prefix}1`, lx: -len / 2, ly: 0 },
      { id: p2Id, label: `${prefix}2`, lx: len / 2, ly: 0 },
    ],
  };
};

export interface PresetData {
  name: string;
  description: string;
  parts: Part[];
  joints: Joint[];
}

export const PRESETS: Record<string, () => PresetData> = {
  fourBar: () => {
    // Mecanismo clássico de 4 barras (Manivela-Balancim / Crank-Rocker)
    const A = { x: -100, y: 50 };
    const B = { x: -100, y: -20 };
    const D = { x: 100, y: 50 };

    // Posição de C calculada por interseção de círculos (r1=190, r2=150)
    const dx = D.x - B.x;
    const dy = D.y - B.y;
    const d = Math.hypot(dx, dy);
    const r1 = 190;
    const r2 = 140;
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const px = B.x + (a * dx) / d;
    const py = B.y + (a * dy) / d;
    const C = { x: px + (h * dy) / d, y: py - (h * dx) / d };

    const crank = createBar(A.x, A.y, B.x, B.y, 'Manivela (Crank)', 16, 'M');
    crank.pivots[0].fixed = true;
    crank.pivots[0].motor = true;

    const coupler = createBar(B.x, B.y, C.x, C.y, 'Biela/Acoplador (Coupler)', 16, 'A');
    // Adicionar ponto traçador na biela
    const tracePivotId = ++nextId;
    coupler.pivots.push({
      id: tracePivotId,
      label: 'A3',
      lx: 0,
      ly: -45,
      trace: true,
      traceColor: '#a855f7',
    });

    const rocker = createBar(D.x, D.y, C.x, C.y, 'Balancim (Rocker)', 16, 'B');
    rocker.pivots[0].fixed = true;

    const joints: Joint[] = [
      { id: ++nextId, p1: crank.pivots[1].id, p2: coupler.pivots[0].id },
      { id: ++nextId, p1: coupler.pivots[1].id, p2: rocker.pivots[1].id },
    ];

    return {
      name: '4-Barras (Crank-Rocker)',
      description: 'Mecanismo clássico de Grashof com manivela motora contínua e balancim oscilante com curva de acoplamento.',
      parts: syncPartsAndPivots([crank, coupler, rocker]),
      joints,
    };
  },

  sliderCrank: () => {
    // Mecanismo Biela-Manivela (Motor de Combustão / Compressor)
    const A = { x: -120, y: 0 };
    const B = { x: -60, y: -50 };
    const C = { x: 120, y: 0 }; // Pistão no eixo Y = 0

    const crank = createBar(A.x, A.y, B.x, B.y, 'Manivela');
    crank.pivots[0].fixed = true;
    crank.pivots[0].motor = true;

    const rod = createBar(B.x, B.y, C.x, C.y, 'Biela');
    // Adicionar ponto médio na biela com trace
    rod.pivots.push({
      id: ++nextId,
      lx: 0,
      ly: 0,
      trace: true,
      traceColor: '#06b6d4',
    });

    // Pistão (Slider / Guia Linear)
    const pistonId = ++nextId;
    const pistonPivotId = ++nextId;
    const piston: Part = {
      id: pistonId,
      name: 'Pistão (Slider)',
      type: 'rect',
      x: C.x,
      y: C.y,
      rot: 0,
      w: 60,
      h: 36,
      pivots: [
        {
          id: pistonPivotId,
          lx: 0,
          ly: 0,
          trace: true,
          traceColor: '#f59e0b',
          slider: {
            enabled: true,
            angle: 0, // Guia horizontal
            length: 220,
          },
        },
      ],
    };

    const joints: Joint[] = [
      { id: ++nextId, p1: crank.pivots[1].id, p2: rod.pivots[0].id },
      { id: ++nextId, p1: rod.pivots[1].id, p2: pistonPivotId },
    ];

    return {
      name: 'Biela-Manivela (Slider-Crank)',
      description: 'Converte movimento rotativo contínuo em movimento linear alternativo via guia prismática (slider).',
      parts: syncPartsAndPivots([crank, rod, piston]),
      joints,
    };
  },

  chebyshev: () => {
    // Ligação Lambda de Chebyshev (Gerador de movimento retilíneo)
    const A = { x: -80, y: 60 };
    const D = { x: 80, y: 60 };
    const B = { x: -80, y: -40 };
    const C = { x: 80, y: -40 };

    const link1 = createBar(A.x, A.y, B.x, B.y, 'Manivela 1');
    link1.pivots[0].fixed = true;
    link1.pivots[0].motor = true;

    const coupler = createBar(B.x, B.y, C.x, C.y, 'Acoplador Lambda');
    const tipId = ++nextId;
    coupler.pivots.push({
      id: tipId,
      lx: 0,
      ly: -70,
      trace: true,
      traceColor: '#10b981',
    });

    const link2 = createBar(D.x, D.y, C.x, C.y, 'Balancim 2');
    link2.pivots[0].fixed = true;

    const joints: Joint[] = [
      { id: ++nextId, p1: link1.pivots[1].id, p2: coupler.pivots[0].id },
      { id: ++nextId, p1: coupler.pivots[1].id, p2: link2.pivots[1].id },
    ];

    return {
      name: 'Ligação Lambda de Chebyshev',
      description: 'Mecanismo de 4 barras sintetizado para produzir um traço quase perfeitamente retilíneo.',
      parts: syncPartsAndPivots([link1, coupler, link2]),
      joints,
    };
  },

  pantograph: () => {
    // Pantógrafo mecânico (Mecanismo de ampliação de movimento)
    const O = { x: -140, y: 40 };
    const A = { x: -60, y: 40 };
    const B = { x: -20, y: -20 };
    const C = { x: -100, y: -20 };
    const D = { x: 60, y: -80 };

    const barOA = createBar(O.x, O.y, A.x, A.y, 'Elo Fixo O-A');
    barOA.pivots[0].fixed = true;
    barOA.pivots[0].motor = true;

    const barAB = createBar(A.x, A.y, B.x, B.y, 'Elo A-B');
    const barBC = createBar(B.x, B.y, C.x, C.y, 'Elo B-C');
    const barBD = createBar(B.x, B.y, D.x, D.y, 'Elo B-D (Ponteiro)');
    barBD.pivots[1].trace = true;
    barBD.pivots[1].traceColor = '#ec4899';

    const joints: Joint[] = [
      { id: ++nextId, p1: barOA.pivots[1].id, p2: barAB.pivots[0].id },
      { id: ++nextId, p1: barAB.pivots[1].id, p2: barBC.pivots[0].id },
      { id: ++nextId, p1: barAB.pivots[1].id, p2: barBD.pivots[0].id },
    ];

    return {
      name: 'Pantógrafo / Duplo Paralelogramo',
      description: 'Mecanismo pantográfico para cópia proporcional e escalonamento de curvas geométricas.',
      parts: syncPartsAndPivots([barOA, barAB, barBC, barBD]),
      joints,
    };
  },

  quickReturn: () => {
    // Mecanismo de Retorno Rápido (Shaper / Plaina Limadora)
    const O2 = { x: -80, y: 0 };
    const A = { x: -80, y: -45 };
    const O4 = { x: -80, y: 70 };
    const B = { x: -40, y: -100 };
    const C = { x: 80, y: -100 };

    const crank = createBar(O2.x, O2.y, A.x, A.y, 'Manivela Motora');
    crank.pivots[0].fixed = true;
    crank.pivots[0].motor = true;

    const slottedArm = createBar(O4.x, O4.y, B.x, B.y, 'Braço Oscilante');
    slottedArm.pivots[0].fixed = true;
    const slotId = ++nextId;
    slottedArm.slots = [
      {
        id: slotId,
        lx: 0,
        ly: 0,
        length: 160,
        angle: 0,
        width: 14,
        closedEnds: false,
      },
    ];

    const coupler = createBar(B.x, B.y, C.x, C.y, 'Biela de Saída');
    coupler.pivots[1].trace = true;
    coupler.pivots[1].traceColor = '#ef4444';

    const ramId = ++nextId;
    const ramPivotId = ++nextId;
    const ram: Part = {
      id: ramId,
      name: 'Cabeçote / Ferramenta',
      type: 'rect',
      x: C.x,
      y: C.y,
      rot: 0,
      w: 60,
      h: 30,
      pivots: [
        {
          id: ramPivotId,
          lx: 0,
          ly: 0,
          slider: { enabled: true, angle: 0, length: 360 },
        },
      ],
    };

    const joints: Joint[] = [
      { id: ++nextId, p1: crank.pivots[1].id, slotId, type: 'pin-in-slot' },
      { id: ++nextId, p1: slottedArm.pivots[1].id, p2: coupler.pivots[0].id },
      { id: ++nextId, p1: coupler.pivots[1].id, p2: ramPivotId },
    ];

    return {
      name: 'Retorno Rápido (Quick-Return)',
      description: 'Mecanismo de curso de trabalho lento e retorno veloz usado em plainas limadoras.',
      parts: syncPartsAndPivots([crank, slottedArm, coupler, ram]),
      joints,
    };
  },

  gearTrain: () => {
    // Trem de engrenagens de 3 estágios (Transmissão de Potência / Redutor)
    const m = 4;
    const z1 = 16;
    const z2 = 24;
    const z3 = 32;

    const r1 = (m * z1) / 2;
    const r2 = (m * z2) / 2;
    const r3 = (m * z3) / 2;

    const x1 = -96;
    const y1 = 0;
    const x2 = x1 + r1 + r2;
    const y2 = 0;
    const x3 = x2 + r2 + r3;
    const y3 = 0;

    const g1Id = ++nextId;
    const p1Id = ++nextId;
    const gear1: Part = {
      id: g1Id,
      name: 'Engrenagem Motora (Z=16)',
      type: 'gear',
      x: x1,
      y: y1,
      rot: 0,
      w: (r1 + m) * 2,
      h: (r1 + m) * 2,
      gear: { teeth: z1, module: m, profile: 'involute', pressureAngle: 20 * (Math.PI / 180) },
      pivots: [
        { id: p1Id, label: 'G1', lx: 0, ly: 0, fixed: true, motor: true },
      ],
    };

    const g2Id = ++nextId;
    const p2Id = ++nextId;
    const gear2: Part = {
      id: g2Id,
      name: 'Engrenagem Intermediária (Z=24)',
      type: 'gear',
      x: x2,
      y: y2,
      rot: Math.PI / z2,
      w: (r2 + m) * 2,
      h: (r2 + m) * 2,
      gear: { teeth: z2, module: m, profile: 'involute', pressureAngle: 20 * (Math.PI / 180) },
      pivots: [
        { id: p2Id, label: 'G2', lx: 0, ly: 0, fixed: true },
      ],
    };

    const g3Id = ++nextId;
    const p3Id = ++nextId;
    const tracePivId = ++nextId;
    const gear3: Part = {
      id: g3Id,
      name: 'Engrenagem Movida (Z=32)',
      type: 'gear',
      x: x3,
      y: y3,
      rot: 0,
      w: (r3 + m) * 2,
      h: (r3 + m) * 2,
      gear: { teeth: z3, module: m, profile: 'involute', pressureAngle: 20 * (Math.PI / 180) },
      pivots: [
        { id: p3Id, label: 'G3', lx: 0, ly: 0, fixed: true },
        { id: tracePivId, label: 'T1', lx: r3 * 0.75, ly: 0, trace: true, traceColor: '#10b981' },
      ],
    };

    const joints: Joint[] = [
      {
        id: ++nextId,
        type: 'gear',
        p1: p1Id,
        p2: p2Id,
        part1Id: g1Id,
        part2Id: g2Id,
        gearRatio: z1 / z2,
      },
      {
        id: ++nextId,
        type: 'gear',
        p1: p2Id,
        p2: p3Id,
        part1Id: g2Id,
        part2Id: g3Id,
        gearRatio: z2 / z3,
      },
    ];

    return {
      name: 'Trem de Engrenagens (3 Estágios)',
      description: 'Trem de engrenagens cilíndricas com transmissão de torque, inversão de rotação e cálculo de linha de ação a 20° ISO.',
      parts: syncPartsAndPivots([gear1, gear2, gear3]),
      joints,
    };
  },

  jansenLeg: () => {
    // Perna de Theo Jansen (Mecanismo de Marcha / Strandbeest)
    const O = { x: 0, y: 0 };
    const A = { x: 0, y: -25 };
    const B = { x: -40, y: -60 };
    const C = { x: -70, y: 10 };
    const D = { x: -30, y: 80 };

    const crank = createBar(O.x, O.y, A.x, A.y, 'Manivela Central');
    crank.pivots[0].fixed = true;
    crank.pivots[0].motor = true;

    const link1 = createBar(A.x, A.y, B.x, B.y, 'Elo Intermediário 1');
    const link2 = createBar(B.x, B.y, C.x, C.y, 'Triângulo Superior');
    const legTip = createBar(C.x, C.y, D.x, D.y, 'Perna / Pé (Passada)');
    legTip.pivots[1].trace = true;
    legTip.pivots[1].traceColor = '#10b981';

    const joints: Joint[] = [
      { id: ++nextId, p1: crank.pivots[1].id, p2: link1.pivots[0].id },
      { id: ++nextId, p1: link1.pivots[1].id, p2: link2.pivots[0].id },
      { id: ++nextId, p1: link2.pivots[1].id, p2: legTip.pivots[0].id },
    ];

    return {
      name: 'Perna de Theo Jansen (Strandbeest)',
      description: 'Mecanismo cinemático de 8 barras projetado para marcha suave e contato plano com o solo.',
      parts: syncPartsAndPivots([crank, link1, link2, legTip]),
      joints,
    };
  },
};

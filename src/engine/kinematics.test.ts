import { describe, expect, it } from 'vitest';
import { analyzeMechanism, createSimulation, stepSimulation, stepPausedTrails } from './kinematics';
import { createBar, PRESETS } from './presets';
import { pivotWorldPos } from './geometry';
import { Joint, Part, TrailPoint } from '../types/mechanism';

describe('Kinematics Engine', () => {
  it('correctly calculates DOF and Grashof for a four-bar linkage', () => {
    const { parts, joints } = PRESETS.fourBar();
    const analysis = analyzeMechanism(parts, joints);

    expect(analysis.links).toBe(4); // 3 móveis + 1 terra
    expect(analysis.joints1).toBe(4); // 2 juntas + 2 fixas
    expect(analysis.dof).toBe(1); // 1 Grau de liberdade!
    expect(analysis.hasMotor).toBe(true);
    expect(analysis.isOverconstrained).toBe(false);

    expect(analysis.details).toBeDefined();
    expect(analysis.details?.movingLinksCount).toBe(3);
    expect(analysis.details?.hasGround).toBe(true);
    expect(analysis.details?.revoluteCount).toBe(2);
    expect(analysis.details?.groundPivotsCount).toBe(2);
    expect(analysis.details?.motorCount).toBe(1);
  });

  it('initializes and steps four-bar simulation without exploding', () => {
    const { parts, joints } = PRESETS.fourBar();
    const sim = createSimulation(parts, joints);
    const trails: Record<number, TrailPoint[]> = {};
    const telemetry = {};

    expect(sim.motors.length).toBe(1);
    expect(sim.distanceConstraints.length).toBeGreaterThan(0);

    // Dar 10 passos de simulação
    for (let i = 0; i < 10; i++) {
      stepSimulation(sim, parts, 0.016, 60, 1, trails, telemetry);
      expect(sim.lockedUp).toBe(false);
      expect(sim.errorResidual).toBeLessThan(5.0);
    }
  });

  it('runs slider-crank mechanism with prismatic joint correctly', () => {
    const { parts, joints } = PRESETS.sliderCrank();
    const analysis = analyzeMechanism(parts, joints);

    expect(analysis.dof).toBe(1); // Biela-manivela tem 1 DOF

    const sim = createSimulation(parts, joints);
    const trails = {};
    const telemetry = {};

    for (let i = 0; i < 20; i++) {
      stepSimulation(sim, parts, 0.016, 60, 1, trails, telemetry);
      expect(sim.lockedUp).toBe(false);
    }

    // O pistão deve permanecer no eixo Y = 0 (ou com erro desprezível < 0.1)
    const piston = parts.find(p => p.type === 'rect')!;
    expect(Math.abs(piston.y)).toBeLessThan(0.1);
  });

  it('supports dynamic motor speed adjustment smoothly during simulation', () => {
    const { parts, joints } = PRESETS.fourBar();
    const sim = createSimulation(parts, joints);
    const trails: Record<number, TrailPoint[]> = {};
    const telemetry = {};

    // 10 passos a 60 RPM
    for (let i = 0; i < 10; i++) {
      stepSimulation(sim, parts, 0.016, 60, 1, trails, telemetry);
    }
    const angle1 = sim.motors[0].currentAngle;

    // Aumentar para 180 RPM dinamicamente
    for (let i = 0; i < 10; i++) {
      stepSimulation(sim, parts, 0.016, 180, 1, trails, telemetry);
    }
    const angle2 = sim.motors[0].currentAngle;

    expect(angle2).toBeGreaterThan(angle1);
    expect(sim.lockedUp).toBe(false);
  });

  it('solves pin-in-slot kinematic constraint accurately', () => {
    // Peça A: barra com 1 pivô fixo na base e 1 fenda ao longo do seu comprimento
    const slottedBar = {
      id: 101,
      letter: 'A',
      name: 'Barra com Fenda',
      type: 'bar' as const,
      x: 0,
      y: 0,
      rot: Math.PI / 2, // Apontando para cima ao longo do eixo Y
      w: 160,
      h: 20,
      pivots: [
        { id: 1001, label: 'A1', lx: -60, ly: 0, fixed: true }, // Pivot fixo em (0, -60) no mundo
        { id: 1002, label: 'A2', lx: 60, ly: 0 }, // Extremidade livre da barra
      ],
      slots: [
        {
          id: 501,
          label: 'A-S1',
          lx: 20,
          ly: 0,
          length: 120,
          angle: 0,
          width: 12,
          closedEnds: true,
        },
      ],
    };

    // Peça B: manivela com motor acionador
    const crank = {
      id: 102,
      letter: 'B',
      name: 'Manivela',
      type: 'bar' as const,
      x: 0,
      y: 0,
      rot: 0,
      w: 60,
      h: 16,
      pivots: [
        { id: 2001, label: 'B1', lx: -25, ly: 0, fixed: true, motor: true, motorRpm: 60 },
        { id: 2002, label: 'B2', lx: 25, ly: 0 }, // Pino móvel acionado pelo motor
      ],
    };

    // Junta Pino-em-Fenda conectando B2 à fenda A-S1
    const joints = [
      {
        id: 901,
        p1: 2002,
        slotId: 501,
        type: 'pin-in-slot' as const,
      },
    ];

    const parts = [slottedBar, crank];
    const analysis = analyzeMechanism(parts, joints);
    expect(analysis.joints2).toBe(1); // 1 junta de ordem superior (J2)

    const sim = createSimulation(parts, joints);
    expect(sim.pinInSlots.length).toBe(1);

    const trails = {};
    const telemetry = {};

    // Executar 30 passos
    for (let i = 0; i < 30; i++) {
      stepSimulation(sim, parts, 0.016, 60, 1, trails, telemetry);
      expect(sim.lockedUp).toBe(false);
      expect(sim.errorResidual).toBeLessThan(1.0);
    }
  });

  it('aligns bar end pivots strictly with fillet centers (w = L + h)', () => {
    const bar = createBar(0, 0, 100, 0, 'Barra Teste', 20);

    const L = Math.hypot(bar.pivots[1].lx - bar.pivots[0].lx, bar.pivots[1].ly - bar.pivots[0].ly);
    expect(L).toBe(100);
    expect(bar.h).toBe(20);
    // Comprimento total da barra é exatamente L + h
    expect(bar.w).toBe(L + bar.h);

    // Centros geométricos dos fillets de raio h/2 nas duas pontas:
    const leftFilletCenter = -bar.w / 2 + bar.h / 2;
    const rightFilletCenter = bar.w / 2 - bar.h / 2;

    expect(bar.pivots[0].lx).toBe(leftFilletCenter);
    expect(bar.pivots[1].lx).toBe(rightFilletCenter);
    expect(bar.pivots[0].ly).toBe(0);
    expect(bar.pivots[1].ly).toBe(0);
  });

  it('runs quick-return preset with genuine pin-in-slot linkage', () => {
    const { parts, joints } = PRESETS.quickReturn();
    const sim = createSimulation(parts, joints);

    expect(sim.pinInSlots.length).toBe(1);

    const trails = {};
    const telemetry = {};

    for (let i = 0; i < 40; i++) {
      stepSimulation(sim, parts, 0.016, 60, 1, trails, telemetry);
      expect(sim.lockedUp).toBe(false);
      expect(sim.errorResidual).toBeLessThan(1.0);
    }
  });

  it('manages temporary trail lifespan according to configured duration', () => {
    const { parts, joints } = PRESETS.fourBar();
    const sim = createSimulation(parts, joints);
    const trails: Record<number, TrailPoint[]> = {};
    const telemetry = {};

    const dt = 0.05;
    const trailDuration = 1.0;

    for (let i = 0; i < 40; i++) {
      stepSimulation(sim, parts, dt, 60, 1, trails, telemetry, trailDuration);
    }

    const tracedPivotId = parts.flatMap((p) => p.pivots).find((pv) => pv.trace)?.id;
    expect(tracedPivotId).toBeDefined();

    const pts = trails[tracedPivotId!];
    expect(pts.length).toBeGreaterThan(5);

    const oldest = pts[0];
    const newest = pts[pts.length - 1];
    expect(newest.time - oldest.time).toBeLessThanOrEqual(trailDuration + dt * 2);
  });

  it('enforces travel limits (end stops) on linear slider guides', () => {
    const sliderPart: Part = {
      id: 1,
      name: 'Slider Block',
      type: 'rect',
      x: 0,
      y: 0,
      rot: 0,
      w: 40,
      h: 20,
      pivots: [
        {
          id: 10,
          label: 'S1',
          lx: 0,
          ly: 0,
          slider: { enabled: true, angle: 0, length: 100 }, // [-50, +50]
        },
      ],
    };

    const parts = [sliderPart];
    const sim = createSimulation(parts, []);

    // Deslocar partícula além do limite máximo (ex: x = 120)
    sim.particles[10].x = 120;
    stepSimulation(sim, parts, 0.016, 60, 1, {}, {});

    // Deve ser contida pelo batente em x = 50
    expect(sim.particles[10].x).toBeCloseTo(50, 1);
  });

  it('fades and prunes temporary trails during simulation pause until they disappear', () => {
    const { parts, joints } = PRESETS.fourBar();
    const sim = createSimulation(parts, joints);
    const trails: Record<number, TrailPoint[]> = {};
    const telemetry = {};

    const dt = 0.05;
    const trailDuration = 1.0;

    // Simulate for 2 seconds
    for (let i = 0; i < 40; i++) {
      stepSimulation(sim, parts, dt, 60, 1, trails, telemetry, trailDuration);
    }

    const tracedPivotId = parts.flatMap((p) => p.pivots).find((pv) => pv.trace)?.id!;
    expect(trails[tracedPivotId].length).toBeGreaterThan(0);

    // Pause simulation and step paused trails for 0.5s (partially faded)
    for (let i = 0; i < 10; i++) {
      stepPausedTrails(sim, parts, dt, trails, trailDuration);
    }
    expect(trails[tracedPivotId].length).toBeGreaterThan(0);

    // Continue paused trails until full trailDuration has passed (1.5s total pause)
    for (let i = 0; i < 20; i++) {
      stepPausedTrails(sim, parts, dt, trails, trailDuration);
    }

    // Trail should have completely faded and disappeared
    expect(trails[tracedPivotId].length).toBe(0);
  });

  it('resumes simulation smoothly after pause without resetting time or teleporting parts', () => {
    const { parts, joints } = PRESETS.fourBar();
    const sim = createSimulation(parts, joints);
    const trails: Record<number, TrailPoint[]> = {};
    const telemetry = {};

    // Run for 1.0s
    for (let i = 0; i < 20; i++) {
      stepSimulation(sim, parts, 0.05, 60, 1, trails, telemetry, 1.0);
    }
    const timeAtPause = sim.time;
    const crankPivot = parts[0].pivots[1];
    const posAtPause = { ...pivotWorldPos(parts[0], crankPivot) };

    // Pause for 0.5s
    for (let i = 0; i < 10; i++) {
      stepPausedTrails(sim, parts, 0.05, trails, 1.0);
    }

    // Parts did not move during pause
    const posDuringPause = pivotWorldPos(parts[0], crankPivot);
    expect(posDuringPause.x).toBeCloseTo(posAtPause.x, 3);
    expect(posDuringPause.y).toBeCloseTo(posAtPause.y, 3);

    // Resume simulation for 1 step
    stepSimulation(sim, parts, 0.05, 60, 1, trails, telemetry, 1.0);
    expect(sim.time).toBeGreaterThan(timeAtPause);
    expect(sim.lockedUp).toBe(false);
  });

  it('transmite rotação sincronizada à distância via Correia Dentada (mesmo sentido)', () => {
    const m = 4;
    // G1: z=10, motor a 60 RPM, centro em x=0, y=0
    const g1: Part = {
      id: 1,
      name: 'Polia Motora',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 48,
      h: 48,
      gear: { teeth: 10, module: m },
      pivots: [{ id: 10, label: 'A1', lx: 0, ly: 0, fixed: true, motor: true, motorRpm: 60 }],
    };

    // G2: z=20, movida, centro em x=250, y=0
    const g2: Part = {
      id: 2,
      name: 'Polia Movida',
      type: 'gear',
      x: 250,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: m },
      pivots: [{ id: 20, label: 'B1', lx: 0, ly: 0, fixed: true }],
    };

    const parts = [g1, g2];
    const joints: Joint[] = [
      {
        id: 101,
        type: 'belt',
        p1: 10,
        p2: 20,
        part1Id: 1,
        part2Id: 2,
        gearRatio: 10 / 20,
      },
    ];

    const sim = createSimulation(parts, joints);
    expect(sim.belts.length).toBe(1);

    // Passo de 0.1s a 60 RPM
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    expect(sim.lockedUp).toBe(false);
    expect(sim.errorResidual).toBeLessThan(0.5);

    // G1 gira 2*pi * (60/60) * 0.1 = 0.2*pi rad
    const expected1 = 2 * Math.PI * 0.1;
    expect(g1.rot).toBeCloseTo(expected1, 2);

    // G2 gira no MESMO SENTIDO (correia aberta) com metade da velocidade angular (z1/z2 = 10/20 = 0.5)
    const expected2 = expected1 * (10 / 20);
    expect(g2.rot).toBeCloseTo(expected2, 2);
  });

  it('decompõe corretamente DOF para engrenagem fixa com engrenagem livre (DOF=3) vs ambas fixas (DOF=1)', () => {
    const g1: Part = {
      id: 1,
      name: 'G1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 80,
      h: 80,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 10, label: 'A1', lx: 0, ly: 0, fixed: true, motor: true }],
    };

    const g2Floating: Part = {
      id: 2,
      name: 'G2',
      type: 'gear',
      x: 66,
      y: 0,
      rot: 0,
      w: 52,
      h: 52,
      gear: { teeth: 13, module: 4 },
      pivots: [{ id: 20, label: 'B1', lx: 0, ly: 0, fixed: false }], // Solta no espaço
    };

    const joints: Joint[] = [
      {
        id: 100,
        type: 'gear',
        p1: 10,
        p2: 20,
        part1Id: 1,
        part2Id: 2,
        gearRatio: 20 / 13,
      },
    ];

    // Caso 1: G1 com motor/fixo, G2 livre -> L=3 (G1, G2, Terra), J1=1 (G1 fixed), J2=1 (mesh)
    // M = 3(3 - 1) - 2(1) - 1 = 6 - 2 - 1 = 3 DOF!
    const analysisFloating = analyzeMechanism([g1, g2Floating], joints);
    expect(analysisFloating.links).toBe(3);
    expect(analysisFloating.joints1).toBe(1);
    expect(analysisFloating.joints2).toBe(1);
    expect(analysisFloating.dof).toBe(3);
    expect(analysisFloating.details?.groundPivotsCount).toBe(1);
    expect(analysisFloating.details?.gearMeshesCount).toBe(1);
    expect(analysisFloating.details?.motorCount).toBe(1);

    // Caso 2: G2 também fixada ao solo -> L=3, J1=2, J2=1
    // M = 3(3 - 1) - 2(2) - 1 = 6 - 4 - 1 = 1 DOF!
    const g2Fixed: Part = {
      ...g2Floating,
      pivots: [{ id: 20, label: 'B1', lx: 0, ly: 0, fixed: true }],
    };
    const analysisFixed = analyzeMechanism([g1, g2Fixed], joints);
    expect(analysisFixed.links).toBe(3);
    expect(analysisFixed.joints1).toBe(2);
    expect(analysisFixed.joints2).toBe(1);
    expect(analysisFixed.dof).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeMechanism, createSimulation, stepSimulation } from './kinematics';
import { createBar, PRESETS } from './presets';

describe('Kinematics Engine', () => {
  it('correctly calculates DOF and Grashof for a four-bar linkage', () => {
    const { parts, joints } = PRESETS.fourBar();
    const analysis = analyzeMechanism(parts, joints);

    expect(analysis.links).toBe(4); // 3 móveis + 1 terra
    expect(analysis.joints1).toBe(4); // 2 juntas + 2 fixas
    expect(analysis.dof).toBe(1); // 1 Grau de liberdade!
    expect(analysis.hasMotor).toBe(true);
    expect(analysis.isOverconstrained).toBe(false);
  });

  it('initializes and steps four-bar simulation without exploding', () => {
    const { parts, joints } = PRESETS.fourBar();
    const sim = createSimulation(parts, joints);
    const trails = {};
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
    const trails = {};
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
});

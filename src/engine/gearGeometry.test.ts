import { describe, it, expect } from 'vitest';
import {
  calculateGearRadii,
  generateGearOutline,
  calculateGearContact,
  getIdealMeshedPosition,
  calculateMeshedRotation,
  DEFAULT_PRESSURE_ANGLE,
} from './gearGeometry';
import { Joint, Part } from '../types/mechanism';
import { createSimulation, stepSimulation } from './kinematics';

describe('gearGeometry', () => {
  it('calculates correct ISO radii for standard cylindrical spur gear', () => {
    const z = 20;
    const m = 4;
    const radii = calculateGearRadii(z, m);

    expect(radii.pitch).toBe(40); // (4 * 20) / 2
    expect(radii.addendum).toBe(44); // 40 + 4
    expect(radii.dedendum).toBe(35); // 40 - 1.25 * 4
    expect(radii.base).toBeCloseTo(40 * Math.cos(DEFAULT_PRESSURE_ANGLE), 4);
    expect(radii.circularPitch).toBeCloseTo(Math.PI * 4, 4);
  });

  it('generates outline for involute, trapezoidal and cycloidal profiles', () => {
    const gearInvolute = { teeth: 12, module: 3, profile: 'involute' as const };
    const gearTrap = { teeth: 12, module: 3, profile: 'trapezoidal' as const };
    const gearCyc = { teeth: 12, module: 3, profile: 'cycloidal' as const };

    const ptsInvolute = generateGearOutline(gearInvolute, { x: 0, y: 0 }, 0);
    const ptsTrap = generateGearOutline(gearTrap, { x: 0, y: 0 }, 0);
    const ptsCyc = generateGearOutline(gearCyc, { x: 0, y: 0 }, 0);

    expect(ptsInvolute.length).toBe(12 * 8);
    expect(ptsTrap.length).toBe(12 * 4);
    expect(ptsCyc.length).toBe(12 * 5);
  });

  it('calculates contact point, pitch point and normal along line of action', () => {
    const gear1: Part = {
      id: 1,
      name: 'G1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: 4, profile: 'involute' },
      pivots: [{ id: 10, label: 'P1', lx: 0, ly: 0 }],
    };

    const gear2: Part = {
      id: 2,
      name: 'G2',
      type: 'gear',
      x: 120, // Rp1 = 40, Rp2 = 80 => dist = 120
      y: 0,
      rot: 0,
      w: 168,
      h: 168,
      gear: { teeth: 40, module: 4, profile: 'involute' },
      pivots: [{ id: 20, label: 'P2', lx: 0, ly: 0 }],
    };

    const contact = calculateGearContact(gear1, gear2);
    expect(contact).not.toBeNull();
    if (!contact) return;

    expect(contact.isMeshing).toBe(true);
    expect(contact.pitchPoint.x).toBeCloseTo(40, 2);
    expect(contact.pitchPoint.y).toBeCloseTo(0, 2);
    expect(contact.idealDistance).toBe(120);

    // Normal vector direction
    const normalLen = Math.hypot(contact.normalVector.x, contact.normalVector.y);
    expect(normalLen).toBeCloseTo(1, 4);
  });

  it('snaps gear to ideal meshing position', () => {
    const gear1: Part = {
      id: 1,
      name: 'G1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 80,
      h: 80,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 10, label: 'P1', lx: 0, ly: 0 }],
    };

    const gear2: Part = {
      id: 2,
      name: 'G2',
      type: 'gear',
      x: 100, // Slightly off
      y: 0,
      rot: 0,
      w: 80,
      h: 80,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 20, label: 'P2', lx: 0, ly: 0 }],
    };

    const ideal = getIdealMeshedPosition(gear1, gear2);
    expect(ideal.x).toBeCloseTo(80, 2); // Rp1 + Rp2 = 40 + 40 = 80
    expect(ideal.y).toBeCloseTo(0, 2);
  });

  it('transmits kinematic motion with correct gear ratio and inverted direction', () => {
    // Gear 1 has 20 teeth, Motor at 60 RPM (2*PI rad/s)
    const gear1: Part = {
      id: 1,
      name: 'G1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 10, label: 'P1', lx: 0, ly: 0, fixed: true, motor: true }],
    };

    // Gear 2 has 40 teeth (ratio 20/40 = 0.5)
    const gear2: Part = {
      id: 2,
      name: 'G2',
      type: 'gear',
      x: 120,
      y: 0,
      rot: 0,
      w: 168,
      h: 168,
      gear: { teeth: 40, module: 4 },
      pivots: [{ id: 20, label: 'P2', lx: 0, ly: 0, fixed: true }],
    };

    const parts = [gear1, gear2];
    const sim = createSimulation(parts, [
      {
        id: 100,
        type: 'gear',
        p1: 10,
        p2: 20,
        part1Id: 1,
        part2Id: 2,
        gearRatio: 20 / 40,
      },
    ]);

    // Step simulation by 0.1s at 60 RPM
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    const g1 = parts.find((p) => p.id === 1)!;
    const g2 = parts.find((p) => p.id === 2)!;

    // G1 rotated by omega * dt
    const expectedDTheta1 = 2 * Math.PI * 0.1;
    expect(g1.rot).toBeCloseTo(expectedDTheta1, 2);

    // G2 rotated in opposite direction by ratio * expectedDTheta1
    const expectedDTheta2 = -expectedDTheta1 * 0.5;
    expect(g2.rot).toBeCloseTo(expectedDTheta2, 2);
  });

  it('calculates meshed rotation phase aligning tooth to gap', () => {
    const gear1: Part = {
      id: 1,
      name: 'G1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 80,
      h: 80,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 10, label: 'P1', lx: 0, ly: 0 }],
    };

    const gear2: Part = {
      id: 2,
      name: 'G2',
      type: 'gear',
      x: 80,
      y: 0,
      rot: 0,
      w: 80,
      h: 80,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 20, label: 'P2', lx: 0, ly: 0 }],
    };

    const rot2 = calculateMeshedRotation(gear1, gear2);
    // Should be offset by half tooth pitch angle
    const pitchAngle = (2 * Math.PI) / 20;
    const diff = Math.abs(rot2 % pitchAngle);
    expect(diff).toBeCloseTo(pitchAngle / 2, 4);
  });

  it('simulates gear transmission correctly when motor is placed on gear2 (driven gear)', () => {
    // Gear 1 has 20 teeth, no motor
    const gear1: Part = {
      id: 1,
      name: 'G1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 10, label: 'P1', lx: 0, ly: 0, fixed: true, motor: false }],
    };

    // Gear 2 has 40 teeth (ratio 20/40 = 0.5), has motor
    const gear2: Part = {
      id: 2,
      name: 'G2',
      type: 'gear',
      x: 120,
      y: 0,
      rot: 0,
      w: 168,
      h: 168,
      gear: { teeth: 40, module: 4 },
      pivots: [{ id: 20, label: 'P2', lx: 0, ly: 0, fixed: true, motor: true }],
    };

    const parts = [gear1, gear2];
    const sim = createSimulation(parts, [
      {
        id: 100,
        type: 'gear',
        p1: 10,
        p2: 20,
        part1Id: 1,
        part2Id: 2,
        gearRatio: 20 / 40,
      },
    ]);

    // Step simulation by 0.1s at 60 RPM
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    expect(sim.lockedUp).toBe(false);
    expect(sim.errorResidual).toBeLessThan(1.0);

    const g1 = parts.find((p) => p.id === 1)!;
    const g2 = parts.find((p) => p.id === 2)!;

    // G2 rotated by omega * dt
    const expectedDTheta2 = 2 * Math.PI * 0.1;
    expect(g2.rot).toBeCloseTo(expectedDTheta2, 2);

    // G1 rotated in opposite direction by expectedDTheta2 / ratio = expectedDTheta2 / 0.5 = 2 * expectedDTheta2
    const expectedDTheta1 = -expectedDTheta2 / 0.5;
    expect(g1.rot).toBeCloseTo(expectedDTheta1, 2);
  });

  it('accurately simulates compound gear reduction with coaxial welded gears (32:1 reduction)', () => {
    const m = 4;
    // G1: Pinhão de entrada (z=10, Rp=20)
    const gear1: Part = {
      id: 1,
      name: 'Pinhao Motor (Z=10)',
      type: 'gear',
      x: -180,
      y: 0,
      rot: 0,
      w: 48,
      h: 48,
      gear: { teeth: 10, module: m },
      pivots: [{ id: 10, label: 'P1', lx: 0, ly: 0, fixed: true, motor: true, motorRpm: 60 }],
    };

    // G2: Engrenagem grande intermediária (z=80, Rp=160, Centro em x=0, y=0)
    const gear2: Part = {
      id: 2,
      name: 'Coroa Intermediaria (Z=80)',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 328,
      h: 328,
      gear: { teeth: 80, module: m },
      pivots: [{ id: 20, label: 'P2', lx: 0, ly: 0, fixed: true }],
    };

    // G3: Pinhão menor solidário no mesmo eixo de G2 (z=20, Rp=40, Centro em x=0, y=0)
    const gear3: Part = {
      id: 3,
      name: 'Pinhao Solidario (Z=20)',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: m },
      pivots: [{ id: 30, label: 'P3', lx: 0, ly: 0, fixed: true }],
    };

    // G4: Engrenagem grande de saída (z=80, Rp=160, Centro em x=200, y=0)
    const gear4: Part = {
      id: 4,
      name: 'Coroa de Saida (Z=80)',
      type: 'gear',
      x: 200,
      y: 0,
      rot: 0,
      w: 328,
      h: 328,
      gear: { teeth: 80, module: m },
      pivots: [{ id: 40, label: 'P4', lx: 0, ly: 0, fixed: true }],
    };

    const parts = [gear1, gear2, gear3, gear4];
    const joints: Joint[] = [
      // Estágio 1: G1 aciona G2 (i = 10/80 = 1/8)
      { id: 101, type: 'gear', p1: 10, p2: 20, part1Id: 1, part2Id: 2, gearRatio: 10 / 80 },
      // Eixo Composto: G2 é solidária a G3 (weld 1:1)
      { id: 102, type: 'weld', p1: 20, p2: 30, part1Id: 2, part2Id: 3 },
      // Estágio 2: G3 aciona G4 (i = 20/80 = 1/4)
      { id: 103, type: 'gear', p1: 30, p2: 40, part1Id: 3, part2Id: 4, gearRatio: 20 / 80 },
    ];

    const sim = createSimulation(parts, joints);
    expect(sim.welds.length).toBe(1);

    // Passo de simulação de 0.1s a 60 RPM
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    expect(sim.lockedUp).toBe(false);
    expect(sim.errorResidual).toBeLessThan(1.0);

    const g1 = parts.find((p) => p.id === 1)!;
    const g2 = parts.find((p) => p.id === 2)!;
    const g3 = parts.find((p) => p.id === 3)!;
    const g4 = parts.find((p) => p.id === 4)!;

    // G1 gira 0.2*PI
    const expected1 = 2 * Math.PI * 0.1;
    expect(g1.rot).toBeCloseTo(expected1, 2);

    // G2 gira oposto reduzido em 8x
    const expected2 = -expected1 * (10 / 80);
    expect(g2.rot).toBeCloseTo(expected2, 2);

    // G3 é solidária no mesmo eixo (gira exatamente junto com G2)
    expect(g3.rot).toBeCloseTo(g2.rot, 4);

    // G4 gira oposto a G3 reduzido em 4x (redução total 32x)
    const expected4 = expected1 / 32;
    expect(g4.rot).toBeCloseTo(expected4, 2);
  });

  it('permite mover peças durante a pausa e continuar a simulação sem retroceder à posição anterior', () => {
    const m = 4;
    const g1: Part = {
      id: 1,
      name: 'Pinhão Motor',
      type: 'gear',
      x: -180,
      y: 0,
      rot: 0,
      w: 48,
      h: 48,
      gear: { teeth: 10, module: m },
      pivots: [{ id: 10, label: 'A1', lx: 0, ly: 0, fixed: true, motor: true, motorRpm: 60 }],
    };
    const g2: Part = {
      id: 2,
      name: 'Coroa 80T',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 328,
      h: 328,
      gear: { teeth: 80, module: m },
      pivots: [{ id: 20, label: 'B1', lx: 0, ly: 0, fixed: true }],
    };

    const parts = [g1, g2];
    const joints: Joint[] = [
      { id: 101, type: 'gear', p1: 10, p2: 20, part1Id: 1, part2Id: 2, gearRatio: 10 / 80 },
    ];

    // Simula 0.1s
    let sim = createSimulation(parts, joints);
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    // Usuário pausa e move o conjunto 50px para cima (y = 50)
    g1.y = 50;
    g2.y = 50;

    // Novo ciclo de simulação a partir do estado movido
    sim = createSimulation(parts, joints);
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    expect(sim.lockedUp).toBe(false);
    expect(parts[0].y).toBe(50);
    expect(parts[1].y).toBe(50);
  });

  it('não trava com erro de Ponto Morto quando pinhão aciona par coaxial soldado montado em terra', () => {
    const m = 4;
    // Pinhão A1 (z=10, motor, ground)
    const pinion: Part = {
      id: 1,
      name: 'A1',
      type: 'gear',
      x: -180,
      y: 0,
      rot: 0,
      w: 48,
      h: 48,
      gear: { teeth: 10, module: m },
      pivots: [{ id: 10, label: 'A1', lx: 0, ly: 0, fixed: true, motor: true, motorRpm: 60 }],
    };
    // Coroa grande (z=80, ground)
    const bigGear: Part = {
      id: 2,
      name: 'Coroa 80T',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 328,
      h: 328,
      gear: { teeth: 80, module: m },
      pivots: [{ id: 20, label: 'Center', lx: 0, ly: 0, fixed: true }],
    };
    // Engrenagem menor coaxial B1 (z=20, ground)
    const smallGear: Part = {
      id: 3,
      name: 'B1',
      type: 'gear',
      x: 0,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: m },
      pivots: [{ id: 30, label: 'B1', lx: 0, ly: 0, fixed: true }],
    };

    const parts = [pinion, bigGear, smallGear];
    const joints: Joint[] = [
      { id: 101, type: 'gear', p1: 10, p2: 20, part1Id: 1, part2Id: 2, gearRatio: 10 / 80 },
      { id: 102, type: 'weld', p1: 20, p2: 30, part1Id: 2, part2Id: 3 },
    ];

    const sim = createSimulation(parts, joints);
    stepSimulation(sim, parts, 0.1, 60, 1, {}, {});

    expect(sim.lockedUp).toBe(false);
    expect(sim.errorResidual).toBeLessThan(0.5);
    expect(bigGear.rot).toBeCloseTo(smallGear.rot, 4);
  });
});

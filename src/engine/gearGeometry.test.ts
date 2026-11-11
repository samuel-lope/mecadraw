import { describe, it, expect } from 'vitest';
import {
  calculateGearRadii,
  generateGearOutline,
  calculateGearContact,
  getIdealMeshedPosition,
  calculateMeshedRotation,
  DEFAULT_PRESSURE_ANGLE,
} from './gearGeometry';
import { Part } from '../types/mechanism';
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
});

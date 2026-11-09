import { describe, expect, it } from 'vitest';
import { analyzeMechanism, createSimulation, stepSimulation } from './kinematics';
import { PRESETS } from './presets';

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
});

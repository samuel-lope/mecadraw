import {
  Joint,
  MechanismAnalysis,
  Part,
  PartSlot,
  Point2D,
  TelemetrySample,
  TrailPoint,
} from '../types/mechanism';
import { distance2D, pivotWorldPos, rotate2D } from './geometry';

export interface SimParticle {
  x: number;
  y: number;
  fixed: boolean;
  slider?: {
    origin: Point2D;
    dir: Point2D;
    normal: Point2D;
    halfLength?: number;
  };
}

export interface SimMotor {
  center: Point2D;
  targetId: number;
  radius: number;
  currentAngle: number;
  rpm: number;
  dir: 1 | -1;
}

export interface DistanceConstraint {
  p1: number;
  p2: number;
  length: number;
}

export interface SimPinInSlot {
  pinId: number;
  partId: number;
  slotId: number;
  slot: PartSlot;
}

export interface SimGear {
  part1Id: number;
  part2Id: number;
  ratio: number; // z1 / z2
  initialDiff: number; // diferenca angular de fase
}

export interface SimulationInstance {
  particles: Record<number, SimParticle>;
  distanceConstraints: DistanceConstraint[];
  joints: [number, number][];
  pinInSlots: SimPinInSlot[];
  gears: SimGear[];
  motors: SimMotor[];
  time: number;
  errorResidual: number;
  lockedUp: boolean;
}

export const createSimulation = (parts: Part[], joints: Joint[]): SimulationInstance => {
  const particles: Record<number, SimParticle> = {};
  const distanceConstraints: DistanceConstraint[] = [];
  const simJoints: [number, number][] = [];
  const simPinInSlots: SimPinInSlot[] = [];
  const simGears: SimGear[] = [];
  const motors: SimMotor[] = [];

  // 1. Inicializar partículas a partir dos pivôs das peças
  for (const part of parts) {
    for (const pivot of part.pivots) {
      const wpos = pivotWorldPos(part, pivot);
      const isFixed = Boolean(pivot.fixed || pivot.motor);

      let sliderData: SimParticle['slider'] | undefined;
      if (pivot.slider && pivot.slider.enabled) {
        const ang = pivot.slider.angle;
        sliderData = {
          origin: { ...wpos },
          dir: { x: Math.cos(ang), y: Math.sin(ang) },
          normal: { x: -Math.sin(ang), y: Math.cos(ang) },
          halfLength: (pivot.slider.length || 180) / 2,
        };
      }

      particles[pivot.id] = {
        x: wpos.x,
        y: wpos.y,
        fixed: isFixed,
        slider: sliderData,
      };
    }

    // 2. Restrições rígidas entre pivôs do mesmo corpo
    const pCount = part.pivots.length;
    for (let i = 0; i < pCount; i++) {
      for (let j = i + 1; j < pCount; j++) {
        const pv1 = part.pivots[i];
        const pv2 = part.pivots[j];
        const dist = Math.hypot(pv1.lx - pv2.lx, pv1.ly - pv2.ly);
        distanceConstraints.push({
          p1: pv1.id,
          p2: pv2.id,
          length: dist,
        });
      }
    }

    // 3. Configurar motores
    const motorPivots = part.pivots.filter(p => p.motor);
    for (const mPivot of motorPivots) {
      const otherPivot = part.pivots.find(p => p.id !== mPivot.id);
      if (otherPivot) {
        const cPos = pivotWorldPos(part, mPivot);
        const qPos = pivotWorldPos(part, otherPivot);
        const r = distance2D(cPos, qPos);
        const a0 = Math.atan2(qPos.y - cPos.y, qPos.x - cPos.x);

        motors.push({
          center: { x: cPos.x, y: cPos.y },
          targetId: otherPivot.id,
          radius: r,
          currentAngle: a0,
          rpm: mPivot.motorRpm || 0, // 0 = usa globalSpeedRpm do slider
          dir: mPivot.motorDir ?? 1,
        });
      }
    }
  }

  // 4. Juntas coincidentes entre peças, pino-em-fenda ou engrenamento
  const pairedGears = new Set<string>();

  for (const j of joints) {
    if (j.type === 'pin-in-slot' && j.slotId !== undefined) {
      const partWithSlot = parts.find((p) => p.slots?.some((s) => s.id === j.slotId));
      const slot = partWithSlot?.slots?.find((s) => s.id === j.slotId);
      if (partWithSlot && slot && particles[j.p1]) {
        simPinInSlots.push({
          pinId: j.p1,
          partId: partWithSlot.id,
          slotId: slot.id,
          slot,
        });
      }
    } else if (j.type === 'gear' && j.part1Id && j.part2Id) {
      const g1 = parts.find((p) => p.id === j.part1Id);
      const g2 = parts.find((p) => p.id === j.part2Id);
      if (g1?.gear && g2?.gear) {
        const key = [g1.id, g2.id].sort().join('-');
        pairedGears.add(key);
        const ratio = g1.gear.teeth / g2.gear.teeth;
        const initialDiff = g2.rot - (-ratio * g1.rot);
        simGears.push({ part1Id: g1.id, part2Id: g2.id, ratio, initialDiff });
      }
    } else if (j.p2 !== undefined && particles[j.p1] && particles[j.p2]) {
      simJoints.push([j.p1, j.p2]);
    }
  }

  // 5. Engrenagens geometricamente acopladas por proximidade
  const gearParts = parts.filter((p) => p.type === 'gear' && p.gear);
  for (let i = 0; i < gearParts.length; i++) {
    for (let k = i + 1; k < gearParts.length; k++) {
      const g1 = gearParts[i];
      const g2 = gearParts[k];
      const key = [g1.id, g2.id].sort().join('-');
      if (pairedGears.has(key)) continue;

      const d = Math.hypot(g2.x - g1.x, g2.y - g1.y);
      const rp1 = ((g1.gear!.module) * g1.gear!.teeth) / 2;
      const rp2 = ((g2.gear!.module) * g2.gear!.teeth) / 2;
      const idealDist = rp1 + rp2;

      if (Math.abs(d - idealDist) <= Math.max(10, g1.gear!.module * 1.8)) {
        pairedGears.add(key);
        const ratio = g1.gear!.teeth / g2.gear!.teeth;
        const initialDiff = g2.rot - (-ratio * g1.rot);
        simGears.push({ part1Id: g1.id, part2Id: g2.id, ratio, initialDiff });
      }
    }
  }

  return {
    particles,
    distanceConstraints,
    joints: simJoints,
    pinInSlots: simPinInSlots,
    gears: simGears,
    motors,
    time: 0,
    errorResidual: 0,
    lockedUp: false,
  };
};

export const computePartPose = (
  part: Part,
  particles: Record<number, SimParticle>
): { x: number; y: number; rot: number } => {
  if (part.pivots.length === 0) return { x: part.x, y: part.y, rot: part.rot };
  if (part.pivots.length === 1) {
    const p = part.pivots[0];
    const sp = particles[p.id];
    if (!sp) return { x: part.x, y: part.y, rot: part.rot };
    const [rx, ry] = rotate2D(p.lx, p.ly, part.rot);
    return { x: sp.x - rx, y: sp.y - ry, rot: part.rot };
  }
  const [pv0, pv1] = part.pivots;
  const s0 = particles[pv0.id];
  const s1 = particles[pv1.id];
  if (s0 && s1) {
    const simAng = Math.atan2(s1.y - s0.y, s1.x - s0.x);
    const localAng = Math.atan2(pv1.ly - pv0.ly, pv1.lx - pv0.lx);
    const rot = simAng - localAng;
    const [rx, ry] = rotate2D(pv0.lx, pv0.ly, rot);
    return { x: s0.x - rx, y: s0.y - ry, rot };
  }
  return { x: part.x, y: part.y, rot: part.rot };
};

export const stepSimulation = (
  sim: SimulationInstance,
  parts: Part[],
  dt: number,
  globalSpeedRpm: number,
  globalDir: 1 | -1,
  trails: Record<number, TrailPoint[]>,
  telemetryHistory: Record<number, TelemetrySample[]>,
  defaultTrailDuration = 3.0
): void => {
  sim.time += dt;

  // 1. Atualizar partículas acionadas por motor com integração incremental suave
  for (const motor of sim.motors) {
    const rpm = motor.rpm > 0 ? motor.rpm : globalSpeedRpm;
    const omega = ((rpm * 2 * Math.PI) / 60) * motor.dir * globalDir;
    motor.currentAngle += omega * dt;

    const targetPart = sim.particles[motor.targetId];
    if (targetPart) {
      targetPart.x = motor.center.x + motor.radius * Math.cos(motor.currentAngle);
      targetPart.y = motor.center.y + motor.radius * Math.sin(motor.currentAngle);
      targetPart.fixed = true; // Fixa como mestre durante a iteração de relaxação
    }
  }

  // 1.1 Atualizar rotação angular direta para peças de 1 pivô com motor (ex: Engrenagens motoras)
  for (const part of parts) {
    if (part.pivots.length === 1 && part.pivots[0].motor) {
      const mPivot = part.pivots[0];
      const rpm = mPivot.motorRpm && mPivot.motorRpm > 0 ? mPivot.motorRpm : globalSpeedRpm;
      const omega = ((rpm * 2 * Math.PI) / 60) * (mPivot.motorDir ?? 1) * globalDir;
      part.rot += omega * dt;
    }
  }

  // 2. Resolução Iterativa de Restrições (Gauss-Seidel PBD)
  const iterations = 80;
  let maxResidual = 0;

  for (let it = 0; it < iterations; it++) {
    maxResidual = 0;

    // A. Restrições de Distância Rígida
    for (const c of sim.distanceConstraints) {
      const a = sim.particles[c.p1];
      const b = sim.particles[c.p2];
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const error = dist - c.length;
      maxResidual = Math.max(maxResidual, Math.abs(error));

      const w1 = a.fixed ? 0 : 1;
      const w2 = b.fixed ? 0 : 1;
      const totalWeight = w1 + w2;
      if (totalWeight === 0) continue;

      const correction = error / (dist * totalWeight);
      a.x += dx * correction * w1;
      a.y += dy * correction * w1;
      b.x -= dx * correction * w2;
      b.y -= dy * correction * w2;
    }

    // B. Restrições de Guia Linear (Slider Prismático)
    for (const pId in sim.particles) {
      const part = sim.particles[pId];
      if (part.slider) {
        // Projeta partícula na linha da guia
        const dx = part.x - part.slider.origin.x;
        const dy = part.y - part.slider.origin.y;
        const perpDist = dx * part.slider.normal.x + dy * part.slider.normal.y;
        maxResidual = Math.max(maxResidual, Math.abs(perpDist));

        part.x -= perpDist * part.slider.normal.x;
        part.y -= perpDist * part.slider.normal.y;

        // Limite de curso (batentes de extremidade)
        if (part.slider.halfLength !== undefined) {
          const proj = dx * part.slider.dir.x + dy * part.slider.dir.y;
          if (proj > part.slider.halfLength) {
            const excess = proj - part.slider.halfLength;
            part.x -= excess * part.slider.dir.x;
            part.y -= excess * part.slider.dir.y;
            maxResidual = Math.max(maxResidual, excess);
          } else if (proj < -part.slider.halfLength) {
            const excess = proj - (-part.slider.halfLength);
            part.x -= excess * part.slider.dir.x;
            part.y -= excess * part.slider.dir.y;
            maxResidual = Math.max(maxResidual, Math.abs(excess));
          }
        }
      }
    }

    // C. Restrições de Juntas Coincidentes (Revolutas)
    for (const [id1, id2] of sim.joints) {
      const a = sim.particles[id1];
      const b = sim.particles[id2];
      if (!a || !b) continue;

      const jDist = distance2D(a, b);
      maxResidual = Math.max(maxResidual, jDist);

      if (a.fixed && b.fixed) continue;
      if (a.fixed) {
        b.x = a.x;
        b.y = a.y;
      } else if (b.fixed) {
        a.x = b.x;
        a.y = b.y;
      } else {
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        a.x = b.x = mx;
        a.y = b.y = my;
      }
    }

    // D. Restrições de Pino em Fenda (Pin-in-Slot)
    for (const pis of sim.pinInSlots) {
      const pin = sim.particles[pis.pinId];
      const part = parts.find((p) => p.id === pis.partId);
      if (!pin || !part) continue;

      const pose = computePartPose(part, sim.particles);
      const [csx, csy] = rotate2D(pis.slot.lx, pis.slot.ly, pose.rot);
      const slotCenterX = pose.x + csx;
      const slotCenterY = pose.y + csy;

      const totalAngle = pose.rot + (pis.slot.angle || 0);
      const dirX = Math.cos(totalAngle);
      const dirY = Math.sin(totalAngle);
      const normX = -Math.sin(totalAngle);
      const normY = Math.cos(totalAngle);

      const dx = pin.x - slotCenterX;
      const dy = pin.y - slotCenterY;

      // Distância normal (perpendicular à fenda)
      const perpDist = dx * normX + dy * normY;
      maxResidual = Math.max(maxResidual, Math.abs(perpDist));

      // Limites de fim de curso (se closedEnds !== false)
      let endDist = 0;
      if (pis.slot.closedEnds !== false) {
        const proj = dx * dirX + dy * dirY;
        const halfLen = (pis.slot.length || 80) / 2;
        if (proj > halfLen) {
          endDist = proj - halfLen;
        } else if (proj < -halfLen) {
          endDist = proj - (-halfLen);
        }
        maxResidual = Math.max(maxResidual, Math.abs(endDist));
      }

      // Distribuição de correção entre pino e corpo da fenda
      const freeLinkPivots = part.pivots.filter((p) => !sim.particles[p.id]?.fixed);
      const hasFreePivots = freeLinkPivots.length > 0;
      const pinWeight = pin.fixed ? 0 : 1;
      const linkWeight = hasFreePivots ? 1 : 0;
      const totalWeight = pinWeight + linkWeight;
      if (totalWeight === 0) continue;

      const pinFrac = pinWeight / totalWeight;
      const linkFrac = linkWeight / totalWeight;

      // 1. Correção no Pino
      if (pinFrac > 0) {
        pin.x -= (perpDist * normX + endDist * dirX) * pinFrac;
        pin.y -= (perpDist * normY + endDist * dirY) * pinFrac;
      }

      // 2. Correção Reversa no Elo da Fenda
      if (linkFrac > 0) {
        const corrX = (perpDist * normX + endDist * dirX) * linkFrac;
        const corrY = (perpDist * normY + endDist * dirY) * linkFrac;

        const fixedPivots = part.pivots.filter((p) => sim.particles[p.id]?.fixed);
        if (fixedPivots.length === 1) {
          // Rotação pura ao redor do pivô fixo
          const fixedPv = fixedPivots[0];
          const origin = sim.particles[fixedPv.id];
          const rx = pin.x - origin.x;
          const ry = pin.y - origin.y;
          const r2 = rx * rx + ry * ry;
          if (r2 > 1e-4) {
            const dTheta = (rx * corrY - ry * corrX) / r2;
            for (const freePv of freeLinkPivots) {
              const sp = sim.particles[freePv.id];
              const prx = sp.x - origin.x;
              const pry = sp.y - origin.y;
              sp.x -= dTheta * pry;
              sp.y += dTheta * prx;
            }
          }
        } else {
          // Translação dos pivôs livres
          for (const freePv of freeLinkPivots) {
            const sp = sim.particles[freePv.id];
            sp.x += corrX;
            sp.y += corrY;
          }
        }
      }
    }

    // E. Restrições de Transmissão por Engrenamento (Gears)
    for (const g of sim.gears) {
      const p1 = parts.find((p) => p.id === g.part1Id);
      const p2 = parts.find((p) => p.id === g.part2Id);
      if (!p1 || !p2) continue;

      // Sincroniza orientação angular se a engrenagem tiver múltiplos pivôs
      if (p1.pivots.length >= 2) {
        p1.rot = computePartPose(p1, sim.particles).rot;
      }
      if (p2.pivots.length >= 2) {
        p2.rot = computePartPose(p2, sim.particles).rot;
      }

      const desiredRot2 = -g.ratio * p1.rot + g.initialDiff;
      let rotErr = p2.rot - desiredRot2;
      rotErr = Math.atan2(Math.sin(rotErr), Math.cos(rotErr));

      const equivLinearErr = Math.abs(rotErr) * ((p2.gear?.module || 4) * (p2.gear?.teeth || 20) * 0.5);
      maxResidual = Math.max(maxResidual, equivLinearErr);

      const p1Motor = p1.pivots.some((pv) => pv.motor);
      const p2Motor = p2.pivots.some((pv) => pv.motor);

      if (p1Motor && !p2Motor) {
        p2.rot -= rotErr;
      } else if (!p1Motor && p2Motor) {
        p1.rot -= rotErr / g.ratio;
      } else {
        p2.rot -= rotErr * 0.5;
        p1.rot -= (rotErr / g.ratio) * 0.5;
      }

      // Sincronizar partículas dos pivôs excêntricos das engrenagens (se houver)
      for (const p of [p1, p2]) {
        if (p.pivots.length > 1) {
          p.pivots.forEach((pv) => {
            const sp = sim.particles[pv.id];
            if (sp && !sp.fixed) {
              const [rx, ry] = rotate2D(pv.lx, pv.ly, p.rot);
              sp.x = p.x + rx;
              sp.y = p.y + ry;
            }
          });
        }
      }
    }
  }

  sim.errorResidual = maxResidual;
  sim.lockedUp = maxResidual > 15.0; // Se após 80 iterações o erro for > 15mm, mecanismo travou/singularidade

  // 3. Atualizar pose dos corpos rígidos a partir das partículas relaxadas
  for (const part of parts) {
    if (part.pivots.length === 0) continue;

    if (part.type === 'gear') {
      const p = part.pivots[0];
      const simP = sim.particles[p.id];
      if (simP) {
        const [rx, ry] = rotate2D(p.lx, p.ly, part.rot);
        part.x = simP.x - rx;
        part.y = simP.y - ry;
      }
    } else if (part.pivots.length === 1) {
      const p = part.pivots[0];
      const simP = sim.particles[p.id];
      if (simP) {
        const [rx, ry] = rotate2D(p.lx, p.ly, part.rot);
        part.x = simP.x - rx;
        part.y = simP.y - ry;
      }
    } else if (part.pivots.length === 2) {
      const [pv0, pv1] = part.pivots;
      const sim0 = sim.particles[pv0.id];
      const sim1 = sim.particles[pv1.id];
      if (sim0 && sim1) {
        const simAng = Math.atan2(sim1.y - sim0.y, sim1.x - sim0.x);
        const localAng = Math.atan2(pv1.ly - pv0.ly, pv1.lx - pv0.lx);
        const rot = simAng - localAng;
        const [rx, ry] = rotate2D(pv0.lx, pv0.ly, rot);

        part.rot = rot;
        part.x = sim0.x - rx;
        part.y = sim0.y - ry;
      }
    } else {
      // 3+ pivôs: Pose ótima (Shape Matching / Procrustes 2D)
      let sumSimX = 0, sumSimY = 0;
      let sumLocX = 0, sumLocY = 0;
      const n = part.pivots.length;

      for (const p of part.pivots) {
        const simP = sim.particles[p.id];
        sumSimX += simP.x;
        sumSimY += simP.y;
        sumLocX += p.lx;
        sumLocY += p.ly;
      }

      const cSim = { x: sumSimX / n, y: sumSimY / n };
      const cLoc = { x: sumLocX / n, y: sumLocY / n };

      let num = 0;
      let den = 0;
      for (const p of part.pivots) {
        const simP = sim.particles[p.id];
        const lx = p.lx - cLoc.x;
        const ly = p.ly - cLoc.y;
        const sx = simP.x - cSim.x;
        const sy = simP.y - cSim.y;

        num += lx * sy - ly * sx;
        den += lx * sx + ly * sy;
      }

      const rot = Math.atan2(num, den);
      const [rcx, rcy] = rotate2D(cLoc.x, cLoc.y, rot);
      part.rot = rot;
      part.x = cSim.x - rcx;
      part.y = cSim.y - rcy;
    }
  }

  // 4. Gravar trajetórias e telemetria para pivôs marcados com trace
  for (const part of parts) {
    for (const pivot of part.pivots) {
      if (!pivot.trace) continue;

      const currentPos = pivotWorldPos(part, pivot);
      const trail = trails[pivot.id] || (trails[pivot.id] = []);
      trail.push({ x: currentPos.x, y: currentPos.y, time: sim.time });

      const duration = pivot.traceDuration !== undefined ? pivot.traceDuration : defaultTrailDuration;
      if (duration > 0) {
        const cutoffTime = sim.time - duration;
        while (trail.length > 2 && trail[0].time < cutoffTime) {
          trail.shift();
        }
      } else if (trail.length > 2000) {
        trail.shift();
      }

      const telemetry = telemetryHistory[pivot.id] || (telemetryHistory[pivot.id] = []);
      const prev = telemetry[telemetry.length - 1];

      let vx = 0, vy = 0, ax = 0, ay = 0;
      if (prev && dt > 0) {
        vx = (currentPos.x - prev.x) / dt;
        vy = (currentPos.y - prev.y) / dt;
        ax = (vx - prev.vx) / dt;
        ay = (vy - prev.vy) / dt;
      }

      telemetry.push({
        time: sim.time,
        x: currentPos.x,
        y: currentPos.y,
        vx,
        vy,
        speed: Math.hypot(vx, vy),
        ax,
        ay,
        accel: Math.hypot(ax, ay),
      });

      if (telemetry.length > 500) telemetry.shift();
    }
  }
};

export const stepPausedTrails = (
  sim: SimulationInstance,
  parts: Part[],
  dt: number,
  trails: Record<number, TrailPoint[]>,
  defaultTrailDuration = 3.0
): void => {
  let hasTemporaryTrails = false;
  for (const part of parts) {
    for (const pv of part.pivots) {
      if (!pv.trace) continue;
      const trail = trails[pv.id];
      if (!trail || trail.length === 0) continue;
      const duration = pv.traceDuration !== undefined ? pv.traceDuration : defaultTrailDuration;
      if (duration > 0) {
        hasTemporaryTrails = true;
        break;
      }
    }
    if (hasTemporaryTrails) break;
  }

  if (!hasTemporaryTrails) return;

  sim.time += dt;

  for (const part of parts) {
    for (const pv of part.pivots) {
      if (!pv.trace) continue;
      const trail = trails[pv.id];
      if (!trail || trail.length === 0) continue;

      const duration = pv.traceDuration !== undefined ? pv.traceDuration : defaultTrailDuration;
      if (duration > 0) {
        const cutoffTime = sim.time - duration;
        while (trail.length > 0 && trail[0].time < cutoffTime) {
          trail.shift();
        }
      }
    }
  }
};

export const analyzeMechanism = (parts: Part[], joints: Joint[]): MechanismAnalysis => {
  const groundPivots = parts.flatMap(p => p.pivots).filter(pv => pv.fixed || pv.motor);
  const hasGround = groundPivots.length > 0;
  const numLinks = parts.length + (hasGround ? 1 : 0);

  // Contagem de juntas J1 (revolutas, fixas, sliders) e J2 (pino em fenda e engrenamentos)
  const numRevolute = joints.filter((j) => j.type !== 'pin-in-slot' && j.type !== 'gear').length;
  const numPinInSlots = joints.filter((j) => j.type === 'pin-in-slot').length;
  const numFixedJoints = groundPivots.length;
  const numSliders = parts.flatMap((p) => p.pivots).filter((pv) => pv.slider?.enabled).length;

  // Contagem de engrenamentos (juntas explícitas + proximidade física)
  const pairedGears = new Set<string>();
  for (const j of joints) {
    if (j.type === 'gear' && j.part1Id && j.part2Id) {
      pairedGears.add([j.part1Id, j.part2Id].sort().join('-'));
    }
  }
  const gearParts = parts.filter((p) => p.type === 'gear' && p.gear);
  for (let i = 0; i < gearParts.length; i++) {
    for (let k = i + 1; k < gearParts.length; k++) {
      const g1 = gearParts[i];
      const g2 = gearParts[k];
      const key = [g1.id, g2.id].sort().join('-');
      if (pairedGears.has(key)) continue;
      const d = Math.hypot(g2.x - g1.x, g2.y - g1.y);
      const rp1 = ((g1.gear!.module) * g1.gear!.teeth) / 2;
      const rp2 = ((g2.gear!.module) * g2.gear!.teeth) / 2;
      if (Math.abs(d - (rp1 + rp2)) <= Math.max(10, g1.gear!.module * 1.8)) {
        pairedGears.add(key);
      }
    }
  }
  const totalGearMeshes = pairedGears.size;

  const J1 = numRevolute + numFixedJoints + numSliders;
  const J2 = numPinInSlots + totalGearMeshes; // Fenda e engrenamento são pares superiores (J2)

  // Critério de Gruebler-Kutzbach: M = 3(L - 1) - 2*J1 - J2
  const dof = numLinks > 0 ? 3 * (numLinks - 1) - 2 * J1 - J2 : 0;
  const hasMotor = parts.some(p => p.pivots.some(v => v.motor));

  // Análise de Grashof se for quadrilátero de 4 barras (4 elos, 4 juntas)
  let grashofInfo: MechanismAnalysis['grashof'] | undefined;
  if (parts.length === 3 && joints.length === 2 && groundPivots.length >= 2) {
    // 3 elos móveis + 1 terra = 4 barras
    const barLengths = parts.map(p => {
      if (p.pivots.length >= 2) {
        return Math.hypot(p.pivots[1].lx - p.pivots[0].lx, p.pivots[1].ly - p.pivots[0].ly);
      }
      return p.w;
    });

    const g1 = pivotWorldPos(parts[0], groundPivots[0]);
    const g2 = pivotWorldPos(parts[parts.length - 1], groundPivots[1]);
    const groundLength = distance2D(g1, g2);

    const allLengths: [number, number, number, number] = [
      barLengths[0] || 50,
      barLengths[1] || 100,
      barLengths[2] || 80,
      groundLength || 100,
    ];

    const sorted = [...allLengths].sort((a, b) => a - b);
    const s = sorted[0];
    const l = sorted[3];
    const p = sorted[1];
    const q = sorted[2];
    const sPlusL = s + l;
    const pPlusQ = p + q;

    let condition: NonNullable<MechanismAnalysis['grashof']>['condition'] = 'none';
    if (Math.abs(sPlusL - pPlusQ) < 1.0) {
      condition = 'change-point';
    } else if (sPlusL < pPlusQ) {
      if (Math.abs(s - allLengths[3]) < 1.0) {
        condition = 'double-crank'; // Terra é o elo menor
      } else if (Math.abs(s - allLengths[0]) < 1.0 || Math.abs(s - allLengths[2]) < 1.0) {
        condition = 'crank-rocker'; // Manivela-Balancim
      } else {
        condition = 'double-rocker'; // Acoplador é o elo menor
      }
    } else {
      condition = 'triple-rocker'; // Não-Grashof
    }

    grashofInfo = {
      isFourBar: true,
      condition,
      lengths: allLengths,
      sPlusL,
      pPlusQ,
    };
  }

  return {
    links: numLinks,
    joints1: J1,
    joints2: J2,
    dof,
    grashof: grashofInfo,
    hasMotor,
    isOverconstrained: dof < 0,
  };
};

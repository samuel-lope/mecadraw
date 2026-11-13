import { Part, Point2D } from '../types/mechanism';
import { rotate2D } from './geometry';
import { calculateGearRadii } from './gearGeometry';

/**
 * Retorna o raio efetivo de transmissão rotativa de uma peça (Engrenagem: raio primitivo; Polia: raio nominal).
 */
export const getRotaryRadius = (part: Part): number | null => {
  if (part.type === 'gear' && part.gear) {
    return calculateGearRadii(part.gear.teeth, part.gear.module).pitch;
  }
  if (part.type === 'pulley') {
    const diam = part.pulley?.diameter ?? part.w;
    return Math.max(4, diam / 2);
  }
  return null;
};

/**
 * Retorna o fator de aderência / atrito efetivo da peça (0.0 a 1.0).
 */
export const getPartFriction = (part: Part): number => {
  if (part.type === 'pulley') {
    const f = part.pulley?.friction ?? 1.0;
    return Math.max(0, Math.min(1, f));
  }
  return 1.0;
};

export interface ClosestSegmentResult {
  point: Point2D;
  dist: number;
  t: number;
}

/**
 * Ponto mais próximo em um segmento de reta AB em relação ao ponto P.
 */
export const closestPointOnSegment = (
  p: Point2D,
  a: Point2D,
  b: Point2D
): ClosestSegmentResult => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) {
    return { point: { x: a.x, y: a.y }, dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return {
    point: { x: projX, y: projY },
    dist: Math.hypot(p.x - projX, p.y - projY),
    t,
  };
};

export interface BoundaryContact {
  point: Point2D;  // Ponto mais próximo na superfície da peça (mundo)
  dist: number;    // Distância euclidiana do ponto consultado até a superfície
  outwardNormal: Point2D; // Normal apontando da superfície em direção ao ponto externo
}

/**
 * Calcula o ponto mais próximo na borda geométrica externa de qualquer peça rígida.
 */
export const closestPointOnPartBoundary = (
  worldPt: Point2D,
  part: Part
): BoundaryContact | null => {
  const [lx, ly] = rotate2D(worldPt.x - part.x, worldPt.y - part.y, -part.rot);

  let localPt: Point2D;
  let localOutNormal: Point2D;

  if (part.type === 'circle' || part.type === 'gear' || part.type === 'pulley') {
    const r = getRotaryRadius(part) ?? Math.max(4, part.w / 2);
    const len = Math.hypot(lx, ly);
    if (len > 1e-6) {
      localOutNormal = { x: lx / len, y: ly / len };
    } else {
      localOutNormal = { x: 1, y: 0 };
    }
    localPt = { x: localOutNormal.x * r, y: localOutNormal.y * r };
  } else if (part.type === 'bar') {
    // Barra é um estádio/cápsula com semicírculos de raio h/2
    const rCap = Math.max(2, part.h / 2);
    const halfSpine = Math.max(0, part.w / 2 - rCap);
    const spine = closestPointOnSegment(
      { x: lx, y: ly },
      { x: -halfSpine, y: 0 },
      { x: halfSpine, y: 0 }
    );
    const dx = lx - spine.point.x;
    const dy = ly - spine.point.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      localOutNormal = { x: dx / len, y: dy / len };
    } else {
      localOutNormal = { x: 0, y: -1 };
    }
    localPt = {
      x: spine.point.x + localOutNormal.x * rCap,
      y: spine.point.y + localOutNormal.y * rCap,
    };
  } else if (part.type === 'tri') {
    const v0: Point2D = { x: -part.w / 2, y: part.h / 2 };
    const v1: Point2D = { x: part.w / 2, y: part.h / 2 };
    const v2: Point2D = { x: 0, y: -part.h / 2 };
    const e0 = closestPointOnSegment({ x: lx, y: ly }, v0, v1);
    const e1 = closestPointOnSegment({ x: lx, y: ly }, v1, v2);
    const e2 = closestPointOnSegment({ x: lx, y: ly }, v2, v0);
    const best = e0.dist <= e1.dist && e0.dist <= e2.dist ? e0 : e1.dist <= e2.dist ? e1 : e2;
    localPt = best.point;
    const dx = lx - localPt.x;
    const dy = ly - localPt.y;
    const len = Math.hypot(dx, dy);
    localOutNormal = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 0, y: -1 };
  } else {
    // Retângulo / polígono aproximado por caixa envolvente
    const hw = Math.max(4, part.w / 2);
    const hh = Math.max(4, part.h / 2);
    const clampedX = Math.max(-hw, Math.min(hw, lx));
    const clampedY = Math.max(-hh, Math.min(hh, ly));
    const isInside = Math.abs(lx) < hw && Math.abs(ly) < hh;

    if (!isInside) {
      localPt = { x: clampedX, y: clampedY };
      const dx = lx - localPt.x;
      const dy = ly - localPt.y;
      const len = Math.hypot(dx, dy);
      localOutNormal = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 0, y: -1 };
    } else {
      const distRight = hw - lx;
      const distLeft = lx + hw;
      const distBottom = hh - ly;
      const distTop = ly + hh;
      const minD = Math.min(distRight, distLeft, distBottom, distTop);
      if (minD === distRight) {
        localPt = { x: hw, y: ly };
        localOutNormal = { x: 1, y: 0 };
      } else if (minD === distLeft) {
        localPt = { x: -hw, y: ly };
        localOutNormal = { x: -1, y: 0 };
      } else if (minD === distBottom) {
        localPt = { x: lx, y: hh };
        localOutNormal = { x: 0, y: 1 };
      } else {
        localPt = { x: lx, y: -hh };
        localOutNormal = { x: 0, y: -1 };
      }
    }
  }

  const [wxOff, wyOff] = rotate2D(localPt.x, localPt.y, part.rot);
  const [nx, ny] = rotate2D(localOutNormal.x, localOutNormal.y, part.rot);
  const worldBoundaryPt = { x: part.x + wxOff, y: part.y + wyOff };

  return {
    point: worldBoundaryPt,
    dist: Math.hypot(worldPt.x - worldBoundaryPt.x, worldPt.y - worldBoundaryPt.y),
    outwardNormal: { x: nx, y: ny },
  };
};

export interface FrictionWheelContact {
  p1Id: number;
  p2Id: number;
  contactPoint: Point2D;
  r1: number;
  r2: number;
  ratio: number;
  gap: number;
}

/**
 * Verifica contato tangencial direto entre duas rodas onde ao menos uma é Polia.
 */
export const calculateFrictionWheelContact = (
  p1: Part,
  p2: Part,
  tolerance = 8
): FrictionWheelContact | null => {
  if (p1.type !== 'pulley' && p2.type !== 'pulley') return null;
  const r1 = getRotaryRadius(p1);
  const r2 = getRotaryRadius(p2);
  if (r1 === null || r2 === null) return null;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-3) return null;

  const idealDist = r1 + r2;
  const gap = d - idealDist;
  if (Math.abs(gap) > tolerance) return null;

  const nx = dx / d;
  const ny = dy / d;
  return {
    p1Id: p1.id,
    p2Id: p2.id,
    contactPoint: {
      x: p1.x + nx * r1,
      y: p1.y + ny * r1,
    },
    r1,
    r2,
    ratio: r1 / r2,
    gap,
  };
};

/**
 * Calcula a posição ideal de encaixe tangencial para uma polia sendo arrastada próxima a outra peça.
 */
export const getIdealFrictionSnapPosition = (
  anchorPart: Part,
  movingPulley: Part
): Point2D | null => {
  const rp = getRotaryRadius(movingPulley);
  if (rp === null) return null;

  const anchorR = getRotaryRadius(anchorPart);
  if (anchorR !== null) {
    const dx = movingPulley.x - anchorPart.x;
    const dy = movingPulley.y - anchorPart.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) return null;
    const idealDist = anchorR + rp;
    return {
      x: anchorPart.x + (dx / d) * idealDist,
      y: anchorPart.y + (dy / d) * idealDist,
    };
  }

  const contact = closestPointOnPartBoundary(
    { x: movingPulley.x, y: movingPulley.y },
    anchorPart
  );
  if (!contact) return null;

  // Só aplica snap se o centro da polia estiver do lado externo da superfície
  const toCenterX = movingPulley.x - contact.point.x;
  const toCenterY = movingPulley.y - contact.point.y;
  const dot = toCenterX * contact.outwardNormal.x + toCenterY * contact.outwardNormal.y;
  if (dot < -2) return null;

  return {
    x: contact.point.x + contact.outwardNormal.x * rp,
    y: contact.point.y + contact.outwardNormal.y * rp,
  };
};

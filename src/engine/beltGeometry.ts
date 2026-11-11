import { Part, Point2D } from '../types/mechanism';
import { calculateGearRadii } from './gearGeometry';

export interface BeltGeometryData {
  gear1Id: number;
  gear2Id: number;
  c1: Point2D;
  c2: Point2D;
  r1: number; // Raio primitivo Polia 1
  r2: number; // Raio primitivo Polia 2
  m: number;  // Módulo das engrenagens
  d: number;  // Distância entre centros (mm)
  thetaC: number; // Ângulo da linha de centros C1 -> C2
  phi: number;    // Ângulo de tangência acos((r1 - r2) / d)
  beta: number;   // phi - PI/2 = asin((r2 - r1) / d)
  u: number;      // thetaC + phi
  l: number;      // thetaC - phi
  t1a: Point2D;   // Ponto de tangência em G1 (ângulo u)
  t2a: Point2D;   // Ponto de tangência em G2 (ângulo u)
  t2b: Point2D;   // Ponto de tangência em G2 (ângulo l)
  t1b: Point2D;   // Ponto de tangência em G1 (ângulo l)
  spanLength: number; // Comprimento de cada vão reto
  arc1Length: number; // Comprimento de abraçamento em G1
  arc2Length: number; // Comprimento de abraçamento em G2
  totalLength: number;// Comprimento primitivo total L (mm)
  teethCount: number; // Quantidade inteira estimada de dentes
  pitch: number;      // Passo circular p = π · m (mm)
  ratio: number;      // Relação de transmissão z1 / z2
}

/**
 * Calcula a geometria analítica completa de uma correia dentada aberta entre duas engrenagens
 */
export const calculateBeltGeometry = (
  gear1: Part,
  gear2: Part
): BeltGeometryData | null => {
  if (!gear1.gear || !gear2.gear) return null;

  const m = gear1.gear.module;
  const r1 = calculateGearRadii(gear1.gear.teeth, m).pitch;
  const r2 = calculateGearRadii(gear2.gear.teeth, gear2.gear.module).pitch;

  const dx = gear2.x - gear1.x;
  const dy = gear2.y - gear1.y;
  const d = Math.hypot(dx, dy);

  // Distância mínima: as engrenagens não podem estar uma dentro da outra
  if (d <= Math.abs(r2 - r1) + 2) return null;

  const thetaC = Math.atan2(dy, dx);
  // Ângulo analítico exato de tangência externa
  const cosPhi = Math.max(-1, Math.min(1, (r1 - r2) / d));
  const phi = Math.acos(cosPhi);
  const beta = phi - Math.PI / 2;

  const u = thetaC + phi;
  const l = thetaC - phi;

  // Pontos de tangência no ramo u
  const t1a: Point2D = {
    x: gear1.x + r1 * Math.cos(u),
    y: gear1.y + r1 * Math.sin(u),
  };
  const t2a: Point2D = {
    x: gear2.x + r2 * Math.cos(u),
    y: gear2.y + r2 * Math.sin(u),
  };

  // Pontos de tangência no ramo l
  const t2b: Point2D = {
    x: gear2.x + r2 * Math.cos(l),
    y: gear2.y + r2 * Math.sin(l),
  };
  const t1b: Point2D = {
    x: gear1.x + r1 * Math.cos(l),
    y: gear1.y + r1 * Math.sin(l),
  };

  const spanLength = Math.sqrt(Math.max(0, d * d - (r2 - r1) * (r2 - r1)));
  const arc1Length = r1 * (2 * Math.PI - 2 * phi);
  const arc2Length = r2 * (2 * phi);
  const totalLength = 2 * spanLength + arc1Length + arc2Length;

  const pitch = Math.PI * m;
  const teethCount = Math.max(1, Math.round(totalLength / pitch));
  const ratio = gear1.gear.teeth / gear2.gear.teeth;

  return {
    gear1Id: gear1.id,
    gear2Id: gear2.id,
    c1: { x: gear1.x, y: gear1.y },
    c2: { x: gear2.x, y: gear2.y },
    r1,
    r2,
    m,
    d,
    thetaC,
    phi,
    beta,
    u,
    l,
    t1a,
    t2a,
    t2b,
    t1b,
    spanLength,
    arc1Length,
    arc2Length,
    totalLength,
    teethCount,
    pitch,
    ratio,
  };
};

export interface BeltToothPoint {
  x: number;
  y: number;
  angle: number; // Direção tangencial da correia
  nx: number;    // Vetor normal apontando para o interior
  ny: number;
}

/**
 * Amostra pontos com orientação ao longo do perímetro da correia
 */
export const getBeltPointAtDistance = (
  geom: BeltGeometryData,
  s: number
): BeltToothPoint => {
  const L = geom.totalLength;
  const curS = ((s % L) + L) % L;

  const L1 = geom.spanLength;                // Span 1: T1a -> T2a
  const L2 = L1 + geom.arc2Length;           // Arc 2: T2a -> T2b (no gear 2)
  const L3 = L2 + geom.spanLength;           // Span 2: T2b -> T1b
  // L4 = L3 + geom.arc1Length = L           // Arc 1: T1b -> T1a (no gear 1)

  // 1. Ramo Reto 1 (T1a -> T2a)
  if (curS <= L1) {
    const t = curS / L1;
    const x = geom.t1a.x + (geom.t2a.x - geom.t1a.x) * t;
    const y = geom.t1a.y + (geom.t2a.y - geom.t1a.y) * t;
    const angle = Math.atan2(geom.t2a.y - geom.t1a.y, geom.t2a.x - geom.t1a.x);
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    return { x, y, angle, nx, ny };
  }

  // 2. Arco de Abraçamento Polia 2 (T2a -> T2b em sentido anti-horário de u para l)
  if (curS <= L2) {
    const arcDist = curS - L1;
    const frac = arcDist / geom.arc2Length;
    const ang = geom.u - frac * (2 * geom.phi);
    const x = geom.c2.x + geom.r2 * Math.cos(ang);
    const y = geom.c2.y + geom.r2 * Math.sin(ang);
    const tangentAng = ang - Math.PI / 2;
    const nx = (geom.c2.x - x) / geom.r2;
    const ny = (geom.c2.y - y) / geom.r2;
    return { x, y, angle: tangentAng, nx, ny };
  }

  // 3. Ramo Reto 2 (T2b -> T1b)
  if (curS <= L3) {
    const t = (curS - L2) / geom.spanLength;
    const x = geom.t2b.x + (geom.t1b.x - geom.t2b.x) * t;
    const y = geom.t2b.y + (geom.t1b.y - geom.t2b.y) * t;
    const angle = Math.atan2(geom.t1b.y - geom.t2b.y, geom.t1b.x - geom.t2b.x);
    const nx = Math.sin(angle);
    const ny = -Math.cos(angle);
    return { x, y, angle, nx, ny };
  }

  // 4. Arco de Abraçamento Polia 1 (T1b -> T1a de l para u ao redor de C1)
  const arcDist = curS - L3;
  const frac = arcDist / geom.arc1Length;
  const ang = geom.l - frac * (2 * Math.PI - 2 * geom.phi);
  const x = geom.c1.x + geom.r1 * Math.cos(ang);
  const y = geom.c1.y + geom.r1 * Math.sin(ang);
  const tangentAng = ang - Math.PI / 2;
  const nx = (geom.c1.x - x) / geom.r1;
  const ny = (geom.c1.y - y) / geom.r1;
  return { x, y, angle: tangentAng, nx, ny };
};

/**
 * Distância mínima de um ponto a um segmento de reta
 */
const distPointToSegment = (
  p: Point2D,
  a: Point2D,
  b: Point2D
): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
};

/**
 * Hit testing para seleção de uma correia dentada
 */
export const hitBelt = (
  pt: Point2D,
  geom: BeltGeometryData,
  tolerance = 8
): boolean => {
  // Testar proximidade dos dois ramos retos
  if (distPointToSegment(pt, geom.t1a, geom.t2a) <= tolerance) return true;
  if (distPointToSegment(pt, geom.t2b, geom.t1b) <= tolerance) return true;

  // Testar proximidade do arco da Polia 1 (lado exterior, oposto a C2)
  const d1 = Math.hypot(pt.x - geom.c1.x, pt.y - geom.c1.y);
  if (Math.abs(d1 - geom.r1) <= tolerance) {
    const ang = Math.atan2(pt.y - geom.c1.y, pt.x - geom.c1.x);
    const relAng = Math.atan2(Math.sin(ang - (geom.thetaC + Math.PI)), Math.cos(ang - (geom.thetaC + Math.PI)));
    if (Math.abs(relAng) <= Math.PI - geom.phi) return true;
  }

  // Testar proximidade do arco da Polia 2 (lado exterior, no sentido de C2)
  const d2 = Math.hypot(pt.x - geom.c2.x, pt.y - geom.c2.y);
  if (Math.abs(d2 - geom.r2) <= tolerance) {
    const ang = Math.atan2(pt.y - geom.c2.y, pt.x - geom.c2.x);
    const relAng = Math.atan2(Math.sin(ang - geom.thetaC), Math.cos(ang - geom.thetaC));
    if (Math.abs(relAng) <= geom.phi) return true;
  }

  return false;
};

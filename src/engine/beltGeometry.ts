import { Part, Point2D } from '../types/mechanism';
import { closestPointOnSegment, getRotaryRadius } from './pulleyGeometry';

export interface BeltGeometryData {
  gear1Id: number;
  gear2Id: number;
  c1: Point2D;
  c2: Point2D;
  r1: number; // Raio primitivo Polia 1
  r2: number; // Raio primitivo Polia 2
  m: number;  // Módulo das engrenagens (quando aplicável)
  hasTeeth: boolean; // True se ao menos uma das peças for engrenagem dentada
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
  ratio: number;      // Relação de transmissão r1 / r2
}

/**
 * Calcula a geometria analítica completa de uma correia aberta entre duas polias e/ou engrenagens
 */
export const calculateBeltGeometry = (
  gear1: Part,
  gear2: Part
): BeltGeometryData | null => {
  const r1 = getRotaryRadius(gear1);
  const r2 = getRotaryRadius(gear2);
  if (r1 === null || r2 === null) return null;

  const hasTeeth = gear1.type === 'gear' || gear2.type === 'gear';
  const m = gear1.gear?.module ?? gear2.gear?.module ?? 4;

  const dx = gear2.x - gear1.x;
  const dy = gear2.y - gear1.y;
  const d = Math.hypot(dx, dy);

  // Distância mínima: as polias/engrenagens não podem estar uma dentro da outra
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
  const ratio = r1 / r2;

  return {
    gear1Id: gear1.id,
    gear2Id: gear2.id,
    c1: { x: gear1.x, y: gear1.y },
    c2: { x: gear2.x, y: gear2.y },
    r1,
    r2,
    m,
    hasTeeth,
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

export interface BeltClosestPoint {
  point: Point2D;
  dist: number;
  clockwiseTangent: Point2D; // Vetor unitário tangente quando G1/G2 giram no sentido horário (rot crescente)
  segment: 'span-u' | 'span-l' | 'arc-1' | 'arc-2';
}

/**
 * Encontra o ponto mais próximo ao longo de todo o perímetro da correia (ramos retos e arcos)
 * e retorna o vetor tangente unitário compatível com rotação horária positiva.
 */
export const closestPointOnBelt = (
  pt: Point2D,
  geom: BeltGeometryData
): BeltClosestPoint => {
  // 1. Ramo u (t1a -> t2a): deslocamento horário vai de t2a para t1a
  const segU = closestPointOnSegment(pt, geom.t1a, geom.t2a);
  const ux = geom.t1a.x - geom.t2a.x;
  const uy = geom.t1a.y - geom.t2a.y;
  const uLen = Math.hypot(ux, uy) || 1;
  let best: BeltClosestPoint = {
    point: segU.point,
    dist: segU.dist,
    clockwiseTangent: { x: ux / uLen, y: uy / uLen },
    segment: 'span-u',
  };

  // 2. Ramo l (t1b -> t2b): deslocamento horário vai de t1b para t2b
  const segL = closestPointOnSegment(pt, geom.t1b, geom.t2b);
  if (segL.dist < best.dist) {
    const lx = geom.t2b.x - geom.t1b.x;
    const ly = geom.t2b.y - geom.t1b.y;
    const lLen = Math.hypot(lx, ly) || 1;
    best = {
      point: segL.point,
      dist: segL.dist,
      clockwiseTangent: { x: lx / lLen, y: ly / lLen },
      segment: 'span-l',
    };
  }

  // 3. Arco exterior na Polia 1
  const ang1 = Math.atan2(pt.y - geom.c1.y, pt.x - geom.c1.x);
  const relAng1 = Math.atan2(
    Math.sin(ang1 - (geom.thetaC + Math.PI)),
    Math.cos(ang1 - (geom.thetaC + Math.PI))
  );
  if (Math.abs(relAng1) <= Math.PI - geom.phi) {
    const px = geom.c1.x + geom.r1 * Math.cos(ang1);
    const py = geom.c1.y + geom.r1 * Math.sin(ang1);
    const dist1 = Math.hypot(pt.x - px, pt.y - py);
    if (dist1 < best.dist) {
      best = {
        point: { x: px, y: py },
        dist: dist1,
        clockwiseTangent: { x: -Math.sin(ang1), y: Math.cos(ang1) },
        segment: 'arc-1',
      };
    }
  }

  // 4. Arco exterior na Polia 2
  const ang2 = Math.atan2(pt.y - geom.c2.y, pt.x - geom.c2.x);
  const relAng2 = Math.atan2(
    Math.sin(ang2 - geom.thetaC),
    Math.cos(ang2 - geom.thetaC)
  );
  if (Math.abs(relAng2) <= geom.phi) {
    const px = geom.c2.x + geom.r2 * Math.cos(ang2);
    const py = geom.c2.y + geom.r2 * Math.sin(ang2);
    const dist2 = Math.hypot(pt.x - px, pt.y - py);
    if (dist2 < best.dist) {
      best = {
        point: { x: px, y: py },
        dist: dist2,
        clockwiseTangent: { x: -Math.sin(ang2), y: Math.cos(ang2) },
        segment: 'arc-2',
      };
    }
  }

  return best;
};

/**
 * Hit testing para seleção de uma correia
 */
export const hitBelt = (
  pt: Point2D,
  geom: BeltGeometryData,
  tolerance = 8
): boolean => {
  return closestPointOnBelt(pt, geom).dist <= tolerance;
};

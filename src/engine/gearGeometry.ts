import { GearData, Part, Point2D } from '../types/mechanism';
import { rotate2D } from './geometry';

export interface GearRadii {
  pitch: number; // Raio Primitivo Rp = m * z / 2
  base: number; // Raio de Base Rb = Rp * cos(alpha)
  addendum: number; // Raio de Cabeça Ra = Rp + m
  dedendum: number; // Raio de Raiz Rf = Rp - 1.25 * m
  circularPitch: number; // Passo circular p = pi * m
  toothThickness: number; // Espessura do dente no primitivo s = p / 2
  angularPitch: number; // Passo angular deltaTheta = 2*pi / z
}

export const DEFAULT_PRESSURE_ANGLE = 20 * (Math.PI / 180); // 20 graus

/**
 * Calcula todos os raios canônicos de uma engrenagem cilíndrica de dentes retos (ISO)
 */
export const calculateGearRadii = (
  teeth: number,
  module: number,
  pressureAngle = DEFAULT_PRESSURE_ANGLE
): GearRadii => {
  const z = Math.max(6, Math.round(teeth));
  const m = Math.max(1, module);
  const alpha = pressureAngle;

  const pitch = (m * z) / 2;
  const base = pitch * Math.cos(alpha);
  const addendum = pitch + m;
  const dedendum = Math.max(m * 0.5, pitch - 1.25 * m);
  const circularPitch = Math.PI * m;
  const toothThickness = circularPitch / 2;
  const angularPitch = (2 * Math.PI) / z;

  return {
    pitch,
    base,
    addendum,
    dedendum,
    circularPitch,
    toothThickness,
    angularPitch,
  };
};

/**
 * Gera os pontos 2D do polígono do contorno de todos os dentes da engrenagem
 */
export const generateGearOutline = (
  gear: GearData,
  center: Point2D,
  rot: number
): Point2D[] => {
  const { teeth, module, profile = 'involute', pressureAngle = DEFAULT_PRESSURE_ANGLE } = gear;
  const radii = calculateGearRadii(teeth, module, pressureAngle);
  const z = Math.max(6, Math.round(teeth));
  const pts: Point2D[] = [];

  const { pitch, base, addendum, dedendum, angularPitch } = radii;
  const halfToothAngle = angularPitch / 4; // Quarto do passo = meio dente

  for (let i = 0; i < z; i++) {
    const toothCenterAngle = rot + i * angularPitch;

    if (profile === 'involute') {
      // Perfil de Evolvente de Círculo
      // 1. Raiz esquerda
      const aRootLeft = toothCenterAngle - halfToothAngle * 1.35;
      pts.push({
        x: center.x + dedendum * Math.cos(aRootLeft),
        y: center.y + dedendum * Math.sin(aRootLeft),
      });

      // 2. Base da evolvente esquerda
      const aBaseLeft = toothCenterAngle - halfToothAngle * 1.15;
      pts.push({
        x: center.x + Math.max(dedendum, base) * Math.cos(aBaseLeft),
        y: center.y + Math.max(dedendum, base) * Math.sin(aBaseLeft),
      });

      // 3. Flanco da evolvente no raio primitivo
      const aPitchLeft = toothCenterAngle - halfToothAngle * 0.95;
      pts.push({
        x: center.x + pitch * Math.cos(aPitchLeft),
        y: center.y + pitch * Math.sin(aPitchLeft),
      });

      // 4. Crista do dente esquerda (topo)
      const aTipLeft = toothCenterAngle - halfToothAngle * 0.55;
      pts.push({
        x: center.x + addendum * Math.cos(aTipLeft),
        y: center.y + addendum * Math.sin(aTipLeft),
      });

      // 5. Crista do dente direita (topo)
      const aTipRight = toothCenterAngle + halfToothAngle * 0.55;
      pts.push({
        x: center.x + addendum * Math.cos(aTipRight),
        y: center.y + addendum * Math.sin(aTipRight),
      });

      // 6. Flanco da evolvente no raio primitivo direito
      const aPitchRight = toothCenterAngle + halfToothAngle * 0.95;
      pts.push({
        x: center.x + pitch * Math.cos(aPitchRight),
        y: center.y + pitch * Math.sin(aPitchRight),
      });

      // 7. Base da evolvente direita
      const aBaseRight = toothCenterAngle + halfToothAngle * 1.15;
      pts.push({
        x: center.x + Math.max(dedendum, base) * Math.cos(aBaseRight),
        y: center.y + Math.max(dedendum, base) * Math.sin(aBaseRight),
      });

      // 8. Raiz direita
      const aRootRight = toothCenterAngle + halfToothAngle * 1.35;
      pts.push({
        x: center.x + dedendum * Math.cos(aRootRight),
        y: center.y + dedendum * Math.sin(aRootRight),
      });
    } else if (profile === 'cycloidal') {
      // Perfil Cicloidal (Dentes arredondados com ogiva suave)
      const aRootLeft = toothCenterAngle - halfToothAngle * 1.3;
      const aMidLeft = toothCenterAngle - halfToothAngle * 0.9;
      const aTip = toothCenterAngle;
      const aMidRight = toothCenterAngle + halfToothAngle * 0.9;
      const aRootRight = toothCenterAngle + halfToothAngle * 1.3;

      pts.push({
        x: center.x + dedendum * Math.cos(aRootLeft),
        y: center.y + dedendum * Math.sin(aRootLeft),
      });
      pts.push({
        x: center.x + pitch * Math.cos(aMidLeft),
        y: center.y + pitch * Math.sin(aMidLeft),
      });
      pts.push({
        x: center.x + addendum * Math.cos(aTip),
        y: center.y + addendum * Math.sin(aTip),
      });
      pts.push({
        x: center.x + pitch * Math.cos(aMidRight),
        y: center.y + pitch * Math.sin(aMidRight),
      });
      pts.push({
        x: center.x + dedendum * Math.cos(aRootRight),
        y: center.y + dedendum * Math.sin(aRootRight),
      });
    } else {
      // Perfil Trapezoidal / Reto
      const aRootLeft = toothCenterAngle - halfToothAngle * 1.4;
      const aTipLeft = toothCenterAngle - halfToothAngle * 0.6;
      const aTipRight = toothCenterAngle + halfToothAngle * 0.6;
      const aRootRight = toothCenterAngle + halfToothAngle * 1.4;

      pts.push({
        x: center.x + dedendum * Math.cos(aRootLeft),
        y: center.y + dedendum * Math.sin(aRootLeft),
      });
      pts.push({
        x: center.x + addendum * Math.cos(aTipLeft),
        y: center.y + addendum * Math.sin(aTipLeft),
      });
      pts.push({
        x: center.x + addendum * Math.cos(aTipRight),
        y: center.y + addendum * Math.sin(aTipRight),
      });
      pts.push({
        x: center.x + dedendum * Math.cos(aRootRight),
        y: center.y + dedendum * Math.sin(aRootRight),
      });
    }
  }

  return pts;
};

export interface GearContactData {
  pitchPoint: Point2D;
  contactPoint: Point2D;
  lineOfActionStart: Point2D;
  lineOfActionEnd: Point2D;
  normalVector: Point2D;
  isMeshing: boolean;
  distance: number;
  idealDistance: number;
}

/**
 * Calcula a Linha de Ação, Ponto Primitivo e Ponto Dinâmico de Contato entre duas engrenagens
 */
export const calculateGearContact = (
  gear1: Part,
  gear2: Part
): GearContactData | null => {
  if (!gear1.gear || !gear2.gear) return null;

  const r1 = calculateGearRadii(gear1.gear.teeth, gear1.gear.module);
  const r2 = calculateGearRadii(gear2.gear.teeth, gear2.gear.module);

  const dx = gear2.x - gear1.x;
  const dy = gear2.y - gear1.y;
  const dist = Math.hypot(dx, dy);
  const idealDist = r1.pitch + r2.pitch;

  if (dist < 1e-3) return null;

  // Vetor unitário centro a centro (O1 -> O2)
  const ux = dx / dist;
  const uy = dy / dist;

  // Vetor normal (tangente às circunferências no ponto primitivo)
  const tx = -uy;
  const ty = ux;

  // Ponto Primitivo P (ponto de tangência das circunferências primitivas)
  const pitchPoint: Point2D = {
    x: gear1.x + ux * r1.pitch,
    y: gear1.y + uy * r1.pitch,
  };

  // Linha de Ação (inclinada pelo ângulo de pressão alpha = 20 graus)
  const alpha = gear1.gear.pressureAngle ?? DEFAULT_PRESSURE_ANGLE;
  // Direção da linha de ação passando por P
  const [lax, lay] = rotate2D(tx, ty, alpha);

  // Extensão da linha de ação entre as circunferências de cabeça
  const loaLen = (gear1.gear.module + gear2.gear.module) * 1.7;
  const lineOfActionStart: Point2D = {
    x: pitchPoint.x - lax * loaLen,
    y: pitchPoint.y - lay * loaLen,
  };
  const lineOfActionEnd: Point2D = {
    x: pitchPoint.x + lax * loaLen,
    y: pitchPoint.y + lay * loaLen,
  };

  // Ponto de contato dinâmico entre dentes ativos:
  // À medida que a engrenagem 1 gira, o ponto de contato percorre a linha de ação
  const toothAngle1 = (2 * Math.PI) / gear1.gear.teeth;
  const cycleFrac = ((gear1.rot % toothAngle1) + toothAngle1) % toothAngle1;
  const normCycle = (cycleFrac / toothAngle1) - 0.5; // -0.5 a +0.5

  const contactOffset = normCycle * (gear1.gear.module * 2.8);
  const contactPoint: Point2D = {
    x: pitchPoint.x + lax * contactOffset,
    y: pitchPoint.y + lay * contactOffset,
  };

  const normalVector: Point2D = {
    x: lax,
    y: lay,
  };

  const isMeshing = Math.abs(dist - idealDist) <= Math.max(10, gear1.gear.module * 1.8);

  return {
    pitchPoint,
    contactPoint,
    lineOfActionStart,
    lineOfActionEnd,
    normalVector,
    isMeshing,
    distance: dist,
    idealDistance: idealDist,
  };
};

/**
 * Retorna a posição ajustada para a peça 2 engrenar com passo perfeito na peça 1
 */
export const getIdealMeshedPosition = (
  gear1: Part,
  gear2: Part
): Point2D => {
  if (!gear1.gear || !gear2.gear) return { x: gear2.x, y: gear2.y };
  const r1 = calculateGearRadii(gear1.gear.teeth, gear1.gear.module);
  const r2 = calculateGearRadii(gear2.gear.teeth, gear2.gear.module);
  const idealDist = r1.pitch + r2.pitch;

  const dx = gear2.x - gear1.x;
  const dy = gear2.y - gear1.y;
  const currentDist = Math.hypot(dx, dy) || 1;

  const ux = dx / currentDist;
  const uy = dy / currentDist;

  return {
    x: gear1.x + ux * idealDist,
    y: gear1.y + uy * idealDist,
  };
};

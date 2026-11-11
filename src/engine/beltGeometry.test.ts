import { describe, it, expect } from 'vitest';
import { calculateBeltGeometry, getBeltPointAtDistance, hitBelt } from './beltGeometry';
import { Part } from '../types/mechanism';

describe('beltGeometry', () => {
  const createGear = (id: number, x: number, y: number, teeth: number, module = 4): Part => ({
    id,
    name: `G${id}`,
    type: 'gear',
    x,
    y,
    rot: 0,
    w: teeth * module,
    h: teeth * module,
    gear: { teeth, module },
    pivots: [{ id: id * 10, label: 'P', lx: 0, ly: 0 }],
  });

  it('calcula geometria exata de correia para engrenagens de raios iguais', () => {
    // z=20, m=4 => Rp = (20*4)/2 = 40mm
    const g1 = createGear(1, 0, 0, 20, 4);
    const g2 = createGear(2, 200, 0, 20, 4);

    const geom = calculateBeltGeometry(g1, g2);
    expect(geom).not.toBeNull();
    if (!geom) return;

    expect(geom.r1).toBe(40);
    expect(geom.r2).toBe(40);
    expect(geom.d).toBe(200);
    expect(geom.beta).toBeCloseTo(0, 5);
    expect(geom.spanLength).toBeCloseTo(200, 4);

    // L = 2*200 + 2*(pi*40) = 400 + 80*pi ≈ 651.327
    const expectedL = 400 + 80 * Math.PI;
    expect(geom.totalLength).toBeCloseTo(expectedL, 2);

    // Passo p = pi * 4 ≈ 12.566
    // Dentes = 651.327 / 12.566 ≈ 51.83 -> 52 dentes
    expect(geom.teethCount).toBe(52);
    expect(geom.ratio).toBe(1.0);
  });

  it('calcula geometria para engrenagens de raios desiguais (redução 1:4)', () => {
    // G1: z=10, m=4 => Rp1 = 20mm
    // G2: z=40, m=4 => Rp2 = 80mm
    // d = 200mm
    const g1 = createGear(1, 0, 0, 10, 4);
    const g2 = createGear(2, 200, 0, 40, 4);

    const geom = calculateBeltGeometry(g1, g2);
    expect(geom).not.toBeNull();
    if (!geom) return;

    expect(geom.r1).toBe(20);
    expect(geom.r2).toBe(80);
    // span = sqrt(200^2 - (80-20)^2) = sqrt(40000 - 3600) = sqrt(36400) ≈ 190.7878
    expect(geom.spanLength).toBeCloseTo(Math.sqrt(36400), 2);

    expect(geom.ratio).toBe(0.25);
    expect(geom.beta).toBeCloseTo(Math.asin(60 / 200), 4);
  });

  it('rejeita centros sobrepostos ou muito próximos', () => {
    const g1 = createGear(1, 0, 0, 20, 4);
    const g2 = createGear(2, 10, 0, 80, 4); // D = 10 <= |r2 - r1| = |160 - 40| = 120

    const geom = calculateBeltGeometry(g1, g2);
    expect(geom).toBeNull();
  });

  it('amostra pontos contínuos ao longo de todo o perímetro da correia', () => {
    const g1 = createGear(1, 0, 0, 20, 4);
    const g2 = createGear(2, 200, 0, 20, 4);
    const geom = calculateBeltGeometry(g1, g2)!;

    const pt0 = getBeltPointAtDistance(geom, 0);
    const ptMidSpan = getBeltPointAtDistance(geom, 100);
    const ptEndSpan1 = getBeltPointAtDistance(geom, geom.spanLength);

    expect(pt0.x).toBeCloseTo(geom.t1a.x, 2);
    expect(pt0.y).toBeCloseTo(geom.t1a.y, 2);
    expect(ptMidSpan.x).toBeCloseTo(100, 2);
    expect(ptEndSpan1.x).toBeCloseTo(geom.t2a.x, 2);
  });

  it('detecta clique de seleção da correia com hitBelt', () => {
    const g1 = createGear(1, 0, 0, 20, 4);
    const g2 = createGear(2, 200, 0, 20, 4);
    const geom = calculateBeltGeometry(g1, g2)!;

    // Ponto sobre o ramo superior (y = 40, x = 100)
    expect(hitBelt({ x: 100, y: 40 }, geom, 5)).toBe(true);
    // Ponto muito longe
    expect(hitBelt({ x: 100, y: 150 }, geom, 5)).toBe(false);
  });
});

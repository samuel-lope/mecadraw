import { describe, it, expect } from 'vitest';
import { Part } from '../types/mechanism';
import {
  calculateFrictionWheelContact,
  closestPointOnPartBoundary,
  getIdealFrictionSnapPosition,
  getPartFriction,
  getRotaryRadius,
} from './pulleyGeometry';
import { calculateBeltGeometry, closestPointOnBelt } from './beltGeometry';

const makePulley = (id: number, x: number, y: number, diameter: number, friction = 1): Part => ({
  id,
  name: `Polia ${id}`,
  type: 'pulley',
  x,
  y,
  rot: 0,
  w: diameter,
  h: diameter,
  pulley: { diameter, friction, spokes: 4 },
  pivots: [{ id: id * 10, lx: 0, ly: 0, fixed: true }],
});

describe('Pulley Geometry & Friction Contacts', () => {
  it('computes rotary radius for gears and pulleys uniformly', () => {
    const p = makePulley(1, 0, 0, 80);
    const g: Part = {
      id: 2,
      name: 'G1',
      type: 'gear',
      x: 100,
      y: 0,
      rot: 0,
      w: 88,
      h: 88,
      gear: { teeth: 20, module: 4 },
      pivots: [{ id: 20, lx: 0, ly: 0, fixed: true }],
    };
    const bar: Part = {
      id: 3,
      name: 'B1',
      type: 'bar',
      x: 0,
      y: 0,
      rot: 0,
      w: 100,
      h: 16,
      pivots: [],
    };

    expect(getRotaryRadius(p)).toBe(40);
    expect(getRotaryRadius(g)).toBe(40); // 20 * 4 / 2
    expect(getRotaryRadius(bar)).toBeNull();
  });

  it('clamps pulley friction factor between 0 and 1', () => {
    expect(getPartFriction(makePulley(1, 0, 0, 60, 0.75))).toBe(0.75);
    expect(getPartFriction(makePulley(2, 0, 0, 60, 1.5))).toBe(1);
    expect(getPartFriction(makePulley(3, 0, 0, 60, -0.2))).toBe(0);
  });

  it('detects tangential friction contact between two pulleys', () => {
    const p1 = makePulley(1, 0, 0, 80); // r=40
    const p2 = makePulley(2, 72, 0, 60); // r=30 -> ideal d = 70, gap = 2 <= 8
    const pFar = makePulley(3, 120, 0, 60);

    const contact = calculateFrictionWheelContact(p1, p2);
    expect(contact).not.toBeNull();
    expect(contact!.r1).toBe(40);
    expect(contact!.r2).toBe(30);
    expect(contact!.ratio).toBeCloseTo(40 / 30);
    expect(contact!.contactPoint.x).toBeCloseTo(40);
    expect(contact!.contactPoint.y).toBeCloseTo(0);

    expect(calculateFrictionWheelContact(p1, pFar)).toBeNull();
  });

  it('computes closest point on belt and clockwise tangent vector accurately', () => {
    const p1 = makePulley(1, 0, 0, 80);   // r=40
    const p2 = makePulley(2, 160, 0, 80); // r=40
    const geom = calculateBeltGeometry(p1, p2);
    expect(geom).not.toBeNull();
    expect(geom!.hasTeeth).toBe(false);
    expect(geom!.ratio).toBeCloseTo(1);

    // Point above top span (y = -40): clockwise rotation moves top span RIGHT (+1, 0)
    const topQuery = closestPointOnBelt({ x: 80, y: -70 }, geom!);
    expect(topQuery.segment).toBe('span-l');
    expect(topQuery.point.x).toBeCloseTo(80);
    expect(topQuery.point.y).toBeCloseTo(-40);
    expect(topQuery.dist).toBeCloseTo(30);
    expect(topQuery.clockwiseTangent.x).toBeCloseTo(1);
    expect(topQuery.clockwiseTangent.y).toBeCloseTo(0);

    // Point below bottom span (y = +40): clockwise rotation moves bottom span LEFT (-1, 0)
    const botQuery = closestPointOnBelt({ x: 80, y: 70 }, geom!);
    expect(botQuery.segment).toBe('span-u');
    expect(botQuery.point.x).toBeCloseTo(80);
    expect(botQuery.point.y).toBeCloseTo(40);
    expect(botQuery.dist).toBeCloseTo(30);
    expect(botQuery.clockwiseTangent.x).toBeCloseTo(-1);
    expect(botQuery.clockwiseTangent.y).toBeCloseTo(0);
  });

  it('computes closest point on bar boundary and ideal tangential snap position', () => {
    const bar: Part = {
      id: 10,
      name: 'Barra A',
      type: 'bar',
      x: 0,
      y: 0,
      rot: 0,
      w: 120,
      h: 20, // top edge at y = -10
      pivots: [],
    };
    const pulley = makePulley(11, 10, -45, 60); // r = 30 -> ideal y = -10 - 30 = -40

    const boundary = closestPointOnPartBoundary({ x: pulley.x, y: pulley.y }, bar);
    expect(boundary).not.toBeNull();
    expect(boundary!.point.x).toBeCloseTo(10);
    expect(boundary!.point.y).toBeCloseTo(-10);
    expect(boundary!.dist).toBeCloseTo(35);

    const snap = getIdealFrictionSnapPosition(bar, pulley);
    expect(snap).not.toBeNull();
    expect(snap!.x).toBeCloseTo(10);
    expect(snap!.y).toBeCloseTo(-40);
  });
});

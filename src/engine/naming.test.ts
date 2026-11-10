import { describe, expect, it } from 'vitest';
import { syncPartsAndPivots } from './naming';
import { Part } from '../types/mechanism';

describe('Naming and Indexing Engine', () => {
  it('correctly assigns sequential letters and axis labels', () => {
    const rawParts: Part[] = [
      {
        id: 1,
        name: 'Barra',
        type: 'bar',
        x: 0,
        y: 0,
        rot: 0,
        w: 100,
        h: 16,
        pivots: [
          { id: 10, lx: -50, ly: 0 },
          { id: 11, lx: 50, ly: 0 },
        ],
      },
      {
        id: 2,
        name: 'Acoplador',
        type: 'bar',
        x: 50,
        y: 50,
        rot: 0,
        w: 120,
        h: 16,
        pivots: [
          { id: 20, lx: -60, ly: 0 },
          { id: 21, lx: 60, ly: 0 },
          { id: 22, lx: 0, ly: -30 },
        ],
      },
    ];

    const synced = syncPartsAndPivots(rawParts);

    expect(synced[0].letter).toBe('A');
    expect(synced[0].pivots[0].label).toBe('A1');
    expect(synced[0].pivots[1].label).toBe('A2');

    expect(synced[1].letter).toBe('B');
    expect(synced[1].pivots[0].label).toBe('B1');
    expect(synced[1].pivots[1].label).toBe('B2');
    expect(synced[1].pivots[2].label).toBe('B3');
  });

  it('re-indexes letters when a part is removed', () => {
    const rawParts: Part[] = [
      {
        id: 1,
        name: 'Barra 1',
        type: 'bar',
        x: 0,
        y: 0,
        rot: 0,
        w: 100,
        h: 16,
        pivots: [{ id: 10, lx: 0, ly: 0 }],
      },
      {
        id: 3,
        name: 'Barra 3',
        type: 'bar',
        x: 0,
        y: 0,
        rot: 0,
        w: 100,
        h: 16,
        pivots: [{ id: 30, lx: 0, ly: 0 }],
      },
    ];

    const synced = syncPartsAndPivots(rawParts);
    expect(synced[0].letter).toBe('A');
    expect(synced[0].pivots[0].label).toBe('A1');

    expect(synced[1].letter).toBe('B');
    expect(synced[1].pivots[0].label).toBe('B1');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { hexToRgba, applyStrokeLineStyle, mergeElementStyle } from './style';

describe('Style utilities', () => {
  describe('hexToRgba', () => {
    it('converts 6-digit hex colors correctly', () => {
      expect(hexToRgba('#2563eb', 0.5)).toBe('rgba(37, 99, 235, 0.5)');
      expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
      expect(hexToRgba('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)');
    });

    it('converts 3-digit shorthand hex colors correctly', () => {
      expect(hexToRgba('#fff', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
      expect(hexToRgba('#000', 0.2)).toBe('rgba(0, 0, 0, 0.2)');
    });

    it('returns existing rgba/hsla strings untouched', () => {
      expect(hexToRgba('rgba(10, 20, 30, 0.4)', 0.5)).toBe('rgba(10, 20, 30, 0.4)');
      expect(hexToRgba('hsla(200, 50%, 50%, 0.8)', 0.5)).toBe('hsla(200, 50%, 50%, 0.8)');
    });
  });

  describe('applyStrokeLineStyle', () => {
    it('clears dash for solid or undefined style', () => {
      const mockCtx = { setLineDash: vi.fn() };
      applyStrokeLineStyle(mockCtx as any, undefined, 1);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);

      applyStrokeLineStyle(mockCtx as any, 'solid', 1);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([]);
    });

    it('sets dashed line pattern with zoom scaling', () => {
      const mockCtx = { setLineDash: vi.fn() };
      applyStrokeLineStyle(mockCtx as any, 'dashed', 2);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([16, 8]);
    });

    it('sets dotted line pattern with zoom scaling', () => {
      const mockCtx = { setLineDash: vi.fn() };
      applyStrokeLineStyle(mockCtx as any, 'dotted', 1);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([2.5, 3]);
    });

    it('sets dashdot line pattern with zoom scaling', () => {
      const mockCtx = { setLineDash: vi.fn() };
      applyStrokeLineStyle(mockCtx as any, 'dashdot', 2);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([16, 7, 4, 7]);
    });
  });

  describe('mergeElementStyle', () => {
    it('merges patch into undefined style', () => {
      const merged = mergeElementStyle(undefined, {
        strokeColor: '#ef4444',
        strokeWidth: 3,
      });
      expect(merged).toEqual({
        strokeColor: '#ef4444',
        strokeWidth: 3,
      });
    });

    it('merges patch preserving existing attributes', () => {
      const current = {
        strokeColor: '#2563eb',
        strokeWidth: 2,
        strokeStyle: 'solid' as const,
      };
      const merged = mergeElementStyle(current, {
        fillColor: '#10b981',
        opacity: 0.8,
      });
      expect(merged).toEqual({
        strokeColor: '#2563eb',
        strokeWidth: 2,
        strokeStyle: 'solid',
        fillColor: '#10b981',
        opacity: 0.8,
      });
    });
  });
});

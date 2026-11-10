import { Camera, Part, PartSlot, Pivot, Point2D } from '../types/mechanism';

export const rotate2D = (x: number, y: number, angle: number): [number, number] => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
};

export const pivotWorldPos = (part: Part, pivot: Pivot): Point2D => {
  const [rx, ry] = rotate2D(pivot.lx, pivot.ly, part.rot);
  return { x: part.x + rx, y: part.y + ry };
};

export const slotWorldCenter = (part: Part, slot: PartSlot): Point2D => {
  const [rx, ry] = rotate2D(slot.lx, slot.ly, part.rot);
  return { x: part.x + rx, y: part.y + ry };
};

export const slotWorldEndpoints = (part: Part, slot: PartSlot): [Point2D, Point2D] => {
  const center = slotWorldCenter(part, slot);
  const totalAngle = part.rot + (slot.angle || 0);
  const halfLen = slot.length / 2;
  const dx = Math.cos(totalAngle) * halfLen;
  const dy = Math.sin(totalAngle) * halfLen;
  return [
    { x: center.x - dx, y: center.y - dy },
    { x: center.x + dx, y: center.y + dy },
  ];
};

export const hitSlot = (
  worldPt: Point2D,
  parts: Part[],
  camera: Camera,
  thresholdPx = 12
): { part: Part; slot: PartSlot } | null => {
  const thresholdWorld = thresholdPx / camera.zoom;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.hidden || !p.slots) continue;
    for (const slot of p.slots) {
      const center = slotWorldCenter(p, slot);
      const totalAngle = p.rot + (slot.angle || 0);
      const [lx, ly] = rotate2D(worldPt.x - center.x, worldPt.y - center.y, -totalAngle);
      const halfLen = slot.length / 2 + 6;
      const halfWidth = (slot.width || 12) / 2 + thresholdWorld;
      if (Math.abs(lx) <= halfLen && Math.abs(ly) <= halfWidth) {
        return { part: p, slot };
      }
    }
  }
  return null;
};

export const worldToScreen = (world: Point2D, camera: Camera, canvasWidth: number, canvasHeight: number): Point2D => {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  return {
    x: cx + (world.x - camera.x) * camera.zoom,
    y: cy + (world.y - camera.y) * camera.zoom,
  };
};

export const screenToWorld = (screen: Point2D, camera: Camera, canvasWidth: number, canvasHeight: number): Point2D => {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  return {
    x: camera.x + (screen.x - cx) / camera.zoom,
    y: camera.y + (screen.y - cy) / camera.zoom,
  };
};

export const distance2D = (p1: Point2D, p2: Point2D): number => {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
};

export const normalizeAngle = (angle: number): number => {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

export const snapValue = (val: number, step: number): number => {
  return Math.round(val / step) * step;
};

export interface SnapResult {
  point: Point2D;
  snappedTo: 'pivot' | 'grid' | 'none';
  targetPivot?: { part: Part; pivot: Pivot };
}

export const getSnapPoint = (
  worldPt: Point2D,
  parts: Part[],
  camera: Camera,
  excludePivotId?: number
): SnapResult => {
  // 1. Prioridade máxima: Snap magnético a pivôs existentes
  if (camera.snapToPivots) {
    let closestDist = Infinity;
    let closestTarget: { part: Part; pivot: Pivot } | null = null;
    let closestPos: Point2D | null = null;
    const snapWorldThreshold = 14 / camera.zoom;

    for (const part of parts) {
      for (const pivot of part.pivots) {
        if (pivot.id === excludePivotId) continue;
        const wpos = pivotWorldPos(part, pivot);
        const d = distance2D(worldPt, wpos);
        if (d <= snapWorldThreshold && d < closestDist) {
          closestDist = d;
          closestTarget = { part, pivot };
          closestPos = wpos;
        }
      }
    }

    if (closestPos && closestTarget) {
      return {
        point: closestPos,
        snappedTo: 'pivot',
        targetPivot: closestTarget,
      };
    }
  }

  // 2. Snap à grade
  if (camera.snapToGrid && camera.gridSize > 0) {
    const gx = snapValue(worldPt.x, camera.gridSize);
    const gy = snapValue(worldPt.y, camera.gridSize);
    const d = distance2D(worldPt, { x: gx, y: gy });
    if (d <= (camera.gridSize * 0.45)) {
      return {
        point: { x: gx, y: gy },
        snappedTo: 'grid',
      };
    }
  }

  return {
    point: worldPt,
    snappedTo: 'none',
  };
};

export const hitPivot = (
  worldPt: Point2D,
  parts: Part[],
  camera: Camera,
  radiusPx = 10
): { part: Part; pivot: Pivot } | null => {
  const radiusWorld = radiusPx / camera.zoom;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    for (const pivot of part.pivots) {
      const pos = pivotWorldPos(part, pivot);
      if (distance2D(pos, worldPt) <= radiusWorld) {
        return { part, pivot };
      }
    }
  }
  return null;
};

export const hitPart = (worldPt: Point2D, parts: Part[]): Part | null => {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const [lx, ly] = rotate2D(worldPt.x - p.x, worldPt.y - p.y, -p.rot);

    let isInside = false;
    if (p.type === 'circle') {
      isInside = Math.hypot(lx, ly) <= p.w / 2;
    } else if (p.type === 'tri') {
      const t = (ly + p.h / 2) / p.h;
      isInside = t >= 0 && t <= 1 && Math.abs(lx) <= (p.w / 2) * t;
    } else {
      // bar or rect
      isInside = Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2;
    }

    if (isInside) return p;
  }
  return null;
};

export interface TransformGizmoHit {
  type: 'rotate' | 'scale-w' | 'scale-h' | 'endpoint-start' | 'endpoint-end';
  point: Point2D;
}

export const getPartRotateHandle = (part: Part): Point2D => {
  const handleOffset = part.h / 2 + 25;
  const [rx, ry] = rotate2D(0, -handleOffset, part.rot);
  return { x: part.x + rx, y: part.y + ry };
};

export const hitGizmo = (
  worldPt: Point2D,
  part: Part,
  camera: Camera
): TransformGizmoHit | null => {
  const hitRadius = 12 / camera.zoom;

  // Handle de rotação no topo
  const rotHandle = getPartRotateHandle(part);
  if (distance2D(worldPt, rotHandle) <= hitRadius) {
    return { type: 'rotate', point: rotHandle };
  }

  // Se for barra com 2 eixos, permitir esticar as extremidades diretamente
  if (part.type === 'bar' && part.pivots.length >= 2) {
    const p0 = pivotWorldPos(part, part.pivots[0]);
    const p1 = pivotWorldPos(part, part.pivots[1]);
    if (distance2D(worldPt, p0) <= hitRadius) {
      return { type: 'endpoint-start', point: p0 };
    }
    if (distance2D(worldPt, p1) <= hitRadius) {
      return { type: 'endpoint-end', point: p1 };
    }
  }

  return null;
};

import { ElementStyle, StrokeLineStyle } from '../types/mechanism';

/**
 * Converte cor hex (#RGB ou #RRGGBB) para rgba com o valor de transparência fornecido.
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  if (hex.startsWith('rgba') || hex.startsWith('hsla')) return hex;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  if (c.length === 6) {
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
};

/**
 * Configura o padrão de linha pontilhada/tracejada no contexto 2D do Canvas.
 */
export const applyStrokeLineStyle = (
  ctx: Pick<CanvasRenderingContext2D, 'setLineDash'>,
  style?: StrokeLineStyle,
  zoom = 1
) => {
  if (!style || style === 'solid') {
    ctx.setLineDash([]);
  } else if (style === 'dashed') {
    ctx.setLineDash([8 * zoom, 4 * zoom]);
  } else if (style === 'dotted') {
    ctx.setLineDash([2.5 * zoom, 3 * zoom]);
  } else if (style === 'dashdot') {
    ctx.setLineDash([8 * zoom, 3.5 * zoom, 2 * zoom, 3.5 * zoom]);
  }
};

/**
 * Atualiza o estilo de um elemento mesclando os atributos parciais fornecidos.
 */
export const mergeElementStyle = (
  current: ElementStyle | undefined,
  patch: Partial<ElementStyle>
): ElementStyle => {
  return {
    ...(current || {}),
    ...patch,
  };
};

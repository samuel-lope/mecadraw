export interface Point2D {
  x: number;
  y: number;
}

export interface SliderGuide {
  enabled: boolean;
  angle: number; // Radianos relativos ao mundo ou à peça
  length: number; // Comprimento da guia visual em mm
}

export interface Pivot {
  id: number;
  lx: number; // Posição local X (mm)
  ly: number; // Posição local Y (mm)
  fixed?: boolean; // Apoio fixo / Terra
  motor?: boolean; // Motor acionador rotativo
  motorRpm?: number; // RPM customizado do motor (se undefined, usa velocidade global)
  motorDir?: 1 | -1;
  trace?: boolean; // Traçar trajetória da curva de acoplamento
  traceColor?: string;
  slider?: SliderGuide; // Junta prismática (guia linear)
}

export type PartType = 'bar' | 'rect' | 'circle' | 'tri' | 'polygon';

export interface Part {
  id: number;
  name: string;
  type: PartType;
  x: number; // Posição global X do centro (mm)
  y: number; // Posição global Y do centro (mm)
  rot: number; // Ângulo de orientação (radianos)
  w: number; // Largura ou comprimento (mm)
  h: number; // Altura ou espessura (mm)
  pivots: Pivot[];
  color?: string;
  locked?: boolean;
}

export interface Joint {
  id: number;
  p1: number; // ID do pivô A
  p2: number; // ID do pivô B
  type?: 'revolute' | 'weld';
}

export type ToolType =
  | 'sel'
  | 'bar'
  | 'rect'
  | 'circle'
  | 'tri'
  | 'axis'
  | 'joint'
  | 'motor'
  | 'ground'
  | 'slider'
  | 'trace'
  | 'del';

export interface Camera {
  x: number; // Deslocamento X da visualização (pixels)
  y: number; // Deslocamento Y da visualização (pixels)
  zoom: number; // Nível de zoom (1.0 = 100%)
  gridSize: number; // Tamanho do passo da grade (ex: 10 mm)
  snapToGrid: boolean;
  snapToPivots: boolean;
  showDimensions: boolean;
  showTrails: boolean;
  showVectors: boolean;
}

export interface TelemetrySample {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  ax: number;
  ay: number;
  accel: number;
  angle?: number;
}

export interface MechanismAnalysis {
  links: number;
  joints1: number;
  joints2: number;
  dof: number;
  grashof?: {
    isFourBar: boolean;
    condition: 'crank-rocker' | 'double-crank' | 'double-rocker' | 'triple-rocker' | 'change-point' | 'none';
    lengths: [number, number, number, number];
    sPlusL: number;
    pPlusQ: number;
  };
  hasMotor: boolean;
  isOverconstrained: boolean;
}

export interface SelectionState {
  partId?: number;
  pivotId?: number;
  jointId?: number;
  multiPartIds?: number[];
}

export interface Point2D {
  x: number;
  y: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

export interface SliderGuide {
  enabled: boolean;
  angle: number; // Radianos relativos ao mundo ou à peça
  length: number; // Comprimento da guia visual em mm
}

export interface PartSlot {
  id: number;
  label?: string; // ex: S1, A-S1
  lx: number; // Posição local X do centro da fenda
  ly: number; // Posição local Y do centro da fenda
  length: number; // Comprimento útil da fenda em mm
  angle: number; // Ângulo relativo à peça em radianos (0 = ao longo da peça)
  width?: number; // Largura do rasgo (padrão 12mm)
  closedEnds?: boolean; // Se true, possui batentes fechados nas extremidades
}

export interface Pivot {
  id: number;
  label?: string; // Identificador legível (ex: A1, B2)
  lx: number; // Posição local X (mm)
  ly: number; // Posição local Y (mm)
  fixed?: boolean; // Apoio fixo / Terra
  motor?: boolean; // Motor acionador rotativo
  motorRpm?: number; // RPM customizado do motor (se undefined, usa velocidade global)
  motorDir?: 1 | -1;
  trace?: boolean; // Traçar trajetória da curva de acoplamento
  traceColor?: string;
  traceDuration?: number; // Duração do rastro em segundos (se undefined, usa camera.trailDuration; 0 = infinito)
  slider?: SliderGuide; // Junta prismática (guia linear)
}

export type GearProfileType = 'involute' | 'trapezoidal' | 'cycloidal';

export interface GearData {
  teeth: number; // Número de dentes z (ex: 20)
  module: number; // Módulo métrico m em mm (ex: 4 mm)
  pressureAngle?: number; // Ângulo de pressão em radianos (padrão 20° = 0.349 rad)
  profile?: GearProfileType; // 'involute' | 'trapezoidal' | 'cycloidal'
}

export type PartType = 'bar' | 'rect' | 'circle' | 'tri' | 'polygon' | 'gear';

export interface Part {
  id: number;
  letter?: string; // Letra identificadora sequencial (ex: A, B, C)
  name: string;
  type: PartType;
  x: number; // Posição global X do centro (mm)
  y: number; // Posição global Y do centro (mm)
  rot: number; // Ângulo de orientação (radianos)
  w: number; // Largura ou comprimento (mm)
  h: number; // Altura ou espessura (mm)
  pivots: Pivot[];
  slots?: PartSlot[]; // Fendas internas mecânicas por onde eixos correm
  gear?: GearData; // Dados paramétricos se type === 'gear'
  color?: string;
  locked?: boolean;
  hidden?: boolean; // Peça e eixos ocultos visualmente (mantém cálculo cinemático)
}

export interface Joint {
  id: number;
  p1: number; // ID do pivô A
  p2?: number; // ID do pivô B (se revoluta)
  slotId?: number; // ID da fenda (se pino-em-fenda)
  part1Id?: number; // ID da peça 1 (se engrenamento ou correia)
  part2Id?: number; // ID da peça 2 (se engrenamento ou correia)
  gearRatio?: number; // Relação de transmissão z1 / z2 (se engrenamento ou correia)
  type?: 'revolute' | 'weld' | 'pin-in-slot' | 'gear' | 'belt';
  beltWidth?: number; // Largura visual da correia em mm (padrão 6mm)
  color?: string;
}

export type ToolType =
  | 'sel'
  | 'bar'
  | 'rect'
  | 'circle'
  | 'tri'
  | 'gear'
  | 'belt'
  | 'axis'
  | 'slot'
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
  trailDuration: number; // Duração global do rastro em segundos (padrão 3.0s, 0 = infinito)
  showGearContacts: boolean; // Visualização dos pontos de contato e linha de ação das engrenagens
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
  details?: {
    movingLinksCount: number;
    hasGround: boolean;
    weldCount: number;
    revoluteCount: number;
    groundPivotsCount: number;
    slidersCount: number;
    gearMeshesCount: number;
    beltsCount: number;
    pinInSlotsCount: number;
    motorCount: number;
  };
}

export interface SelectionState {
  partId?: number;
  pivotId?: number;
  jointId?: number;
  multiPartIds?: number[];
}

export type HeadSignalName =
  | 'headX'
  | 'headY'
  | 'headRoll'
  | 'jawOpen'
  | 'browRaise'
  | 'blink';

export type HandSignalName =
  | 'handX'
  | 'handY'
  | 'pinch'
  | 'openPalm';

export type EyeSignalName =
  | 'gazeX'
  | 'gazeY'
  | 'irisDistL'
  | 'irisDistR'
  | 'eyeOpenness';

export type SignalName = HeadSignalName | HandSignalName | EyeSignalName;

export interface QualityMetrics {
  face: number;
  hand: number;
  eye?: number;
}

export interface SignalFrame {
  t: number; // timestamp in milliseconds
  quality: QualityMetrics;
  signals: Record<SignalName, number | null>;
}

export type InputMode = 'head' | 'hand' | 'eye';

export interface CameraState {
  isStreaming: boolean;
  error: string | null;
  hasPermission: boolean;
}

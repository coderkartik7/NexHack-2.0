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

export type SignalName = HeadSignalName | HandSignalName;

export interface QualityMetrics {
  face: number;
  hand: number;
}

export interface SignalFrame {
  t: number; // timestamp in milliseconds
  quality: QualityMetrics;
  signals: Record<SignalName, number | null>;
}

export type InputMode = 'head' | 'hand';

export interface CameraState {
  isStreaming: boolean;
  error: string | null;
  hasPermission: boolean;
}

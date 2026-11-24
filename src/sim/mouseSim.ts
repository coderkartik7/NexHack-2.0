import type { SignalFrame, SignalName } from '../types/signals';
import type { LearnerProfile } from '../calibration/types';
import type { SignalFrameListener, SignalSource } from './signalSource';

/**
 * Mouse & Keyboard Simulator:
 * Drives cursor signals from mouse coordinates (normalized relative to viewport)
 * and gesture signals from keys:
 * - Hold 'J' = select gesture active
 * - Hold 'K' = grab gesture active
 * - Hold 'L' = pause gesture active
 * 
 * Emits SignalFrames at ~30Hz (every 33ms).
 */
export class MouseSim implements SignalSource {
  readonly id = 'mouse_sim';
  readonly label = 'Mouse & Keyboard Simulator';
  private listeners: Set<SignalFrameListener> = new Set();
  private running = false;
  private intervalId: number | null = null;
  private profile: LearnerProfile | null = null;

  // Internal simulated state
  private normX = 0.5;
  private normY = 0.5;
  private isHoldingSelect = false;
  private isHoldingGrab = false;
  private isHoldingPause = false;

  private onMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private onKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private onKeyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(profile: LearnerProfile | null = null) {
    this.profile = profile;
  }

  public setProfile(profile: LearnerProfile): void {
    this.profile = profile;
  }

  public subscribe(listener: SignalFrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Attach DOM event listeners
    if (typeof window !== 'undefined') {
      this.onMouseMoveHandler = (e: MouseEvent) => {
        const w = window.innerWidth || 1024;
        const h = window.innerHeight || 768;
        this.normX = Math.max(0, Math.min(1, e.clientX / w));
        this.normY = Math.max(0, Math.min(1, e.clientY / h));
      };

      this.onKeyDownHandler = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'j') this.isHoldingSelect = true;
        if (key === 'k') this.isHoldingGrab = true;
        if (key === 'l') this.isHoldingPause = true;
      };

      this.onKeyUpHandler = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'j') this.isHoldingSelect = false;
        if (key === 'k') this.isHoldingGrab = false;
        if (key === 'l') this.isHoldingPause = false;
      };

      window.addEventListener('mousemove', this.onMouseMoveHandler);
      window.addEventListener('keydown', this.onKeyDownHandler);
      window.addEventListener('keyup', this.onKeyUpHandler);
    }

    // Emit frames at ~30 FPS
    const FRAME_INTERVAL = 33;
    let t = performance.now();

    this.intervalId = window.setInterval(() => {
      t = performance.now();
      const frame = this.generateFrame(t);
      for (const l of this.listeners) {
        l(frame);
      }
    }, FRAME_INTERVAL);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (typeof window !== 'undefined') {
      if (this.onMouseMoveHandler) window.removeEventListener('mousemove', this.onMouseMoveHandler);
      if (this.onKeyDownHandler) window.removeEventListener('keydown', this.onKeyDownHandler);
      if (this.onKeyUpHandler) window.removeEventListener('keyup', this.onKeyUpHandler);
    }
  }

  public isActive(): boolean {
    return this.running;
  }

  /**
   * Deterministic frame generation for testing or step-by-step driving
   */
  public generateFrame(t: number): SignalFrame {
    const isHead = this.profile?.mode === 'head';
    const isEye = this.profile?.mode === 'eye';
    const mapping = this.profile?.cursorMapping ?? { gainX: 1, gainY: 1, offsetX: 0, offsetY: 0 };

    // Invert mapping:
    // normX = 0.5 + (rawX - offsetX) * gainX
    // => rawX = offsetX + (normX - 0.5) / gainX
    const gainX = mapping.gainX || 1;
    const gainY = mapping.gainY || 1;
    const rawCursorX = isHead
      ? mapping.offsetX + (this.normX - 0.5) / gainX
      : (mapping.offsetX || 0.5) + (this.normX - 0.5) / gainX;
    const rawCursorY = isHead
      ? mapping.offsetY + (this.normY - 0.5) / gainY
      : (mapping.offsetY || 0.5) + (this.normY - 0.5) / gainY;

    // Gesture signals
    const signals: Record<SignalName, number | null> = {
      headX: isHead ? rawCursorX : 0,
      headY: isHead ? rawCursorY : 0,
      headRoll: 0,
      jawOpen: 0.05,
      browRaise: 0.05,
      blink: 0.05,
      handX: !isHead && !isEye ? rawCursorX : 0.5,
      handY: !isHead && !isEye ? rawCursorY : 0.5,
      pinch: 0.8,
      openPalm: 1.0,
      gazeX: this.normX,
      gazeY: this.normY,
      irisDistL: this.normX,
      irisDistR: this.normX,
      eyeOpenness: 0.25,
    };

    if (this.profile) {
      // If select is held (J key), drive active value past enter
      const sel = this.profile.commands.select;
      if (this.isHoldingSelect) {
        signals[sel.signal] = sel.direction === 'high' ? sel.enter + 0.15 : sel.enter - 0.15;
      } else {
        signals[sel.signal] = sel.direction === 'high' ? Math.max(0, sel.exit - 0.1) : sel.exit + 0.1;
      }

      // If grab is held (K key)
      const grb = this.profile.commands.grab;
      if (this.isHoldingGrab) {
        signals[grb.signal] = grb.direction === 'high' ? grb.enter + 0.15 : grb.enter - 0.15;
      } else if (!this.isHoldingSelect || sel.signal !== grb.signal) {
        signals[grb.signal] = grb.direction === 'high' ? Math.max(0, grb.exit - 0.1) : grb.exit + 0.1;
      }

      // If pause is held (L key)
      const pau = this.profile.commands.pause;
      if (this.isHoldingPause) {
        signals[pau.signal] = pau.direction === 'high' ? pau.enter + 0.15 : pau.enter - 0.15;
      } else if (
        (!this.isHoldingSelect || sel.signal !== pau.signal) &&
        (!this.isHoldingGrab || grb.signal !== pau.signal)
      ) {
        signals[pau.signal] = pau.direction === 'high' ? Math.max(0, pau.exit - 0.1) : pau.exit + 0.1;
      }
    }

    return {
      t,
      quality: { face: 0.95, hand: 0.95 },
      signals,
    };
  }

  // Programmatic keys control for unit testing
  public setKeyStates(select: boolean, grab: boolean, pause: boolean): void {
    this.isHoldingSelect = select;
    this.isHoldingGrab = grab;
    this.isHoldingPause = pause;
  }

  public setNormalizedPosition(x: number, y: number): void {
    this.normX = Math.max(0, Math.min(1, x));
    this.normY = Math.max(0, Math.min(1, y));
  }
}

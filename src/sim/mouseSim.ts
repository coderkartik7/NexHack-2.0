import type { SignalFrame, SignalName } from '../types/signals';
import type { LearnerProfile } from '../calibration/types';
import type { SignalFrameListener, SignalSource } from './signalSource';
import { usePipelineStore } from '../vision/pipeline';

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
    usePipelineStore.getState().setSourceInfo('mouse_sim', true);

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
    usePipelineStore.getState().setSourceInfo('mouse_sim', false);

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (typeof window !== 'undefined') {
      if (this.onMouseMoveHandler) {
        window.removeEventListener('mousemove', this.onMouseMoveHandler);
        this.onMouseMoveHandler = null;
      }
      if (this.onKeyDownHandler) {
        window.removeEventListener('keydown', this.onKeyDownHandler);
        this.onKeyDownHandler = null;
      }
      if (this.onKeyUpHandler) {
        window.removeEventListener('keyup', this.onKeyUpHandler);
        this.onKeyUpHandler = null;
      }
    }
  }

  public isActive(): boolean {
    return this.running;
  }

  /**
   * Generates a synthetic SignalFrame based on simulator state and active profile bindings.
   */
  public generateFrame(t = performance.now()): SignalFrame {
    const isHead = this.profile?.mode === 'head';

    // Neutral baseline signals
    const signals: Record<SignalName, number | null> = {
      headX: isHead ? (this.normX - 0.5) * 0.8 : 0,
      headY: isHead ? (this.normY - 0.5) * 0.8 : 0,
      headRoll: 0,
      jawOpen: 0.05,
      browRaise: 0.05,
      blink: 0.05,
      handX: !isHead ? this.normX : 0.5,
      handY: !isHead ? this.normY : 0.5,
      pinch: 0.8,
      openPalm: 1.0,
      gazeX: this.normX,
      gazeY: this.normY,
      irisDistL: 0.5,
      irisDistR: 0.5,
      eyeOpenness: 0.25,
    };

    if (this.profile) {
      const { select, grab, pause } = this.profile.commands;

      // Select activation (J)
      if (this.isHoldingSelect && select) {
        const highEnter = select.direction === 'high';
        signals[select.signal] = highEnter ? select.enter + 0.15 : select.enter - 0.15;
      }

      // Grab activation (K)
      if (this.isHoldingGrab && grab) {
        const highEnter = grab.direction === 'high';
        signals[grab.signal] = highEnter ? grab.enter + 0.15 : grab.enter - 0.15;
      }

      // Pause activation (L)
      if (this.isHoldingPause && pause) {
        const highEnter = pause.direction === 'high';
        signals[pause.signal] = highEnter ? pause.enter + 0.15 : pause.enter - 0.15;
      }
    } else {
      // Fallback signals for untuned simulator
      if (this.isHoldingSelect) {
        signals.jawOpen = 0.6;
        signals.pinch = 0.15;
      }
      if (this.isHoldingGrab) {
        signals.browRaise = 0.6;
        signals.openPalm = 1.6;
      }
      if (this.isHoldingPause) {
        signals.blink = 0.9;
      }
    }

    return {
      t,
      quality: {
        face: 0.95,
        hand: 0.95,
        eye: 0.95,
      },
      signals,
    };
  }

  // Programmatic testing helpers
  public simulateMouseMove(normX: number, normY: number): void {
    this.normX = Math.max(0, Math.min(1, normX));
    this.normY = Math.max(0, Math.min(1, normY));
  }

  public simulateKeyDown(key: 'j' | 'k' | 'l'): void {
    if (key === 'j') this.isHoldingSelect = true;
    if (key === 'k') this.isHoldingGrab = true;
    if (key === 'l') this.isHoldingPause = true;
  }

  public simulateKeyUp(key: 'j' | 'k' | 'l'): void {
    if (key === 'j') this.isHoldingSelect = false;
    if (key === 'k') this.isHoldingGrab = false;
    if (key === 'l') this.isHoldingPause = false;
  }
}

export interface TargetRect {
  id: string;
  type: 'option' | 'label' | 'drop_zone' | 'button' | 'scroll';
  x: number;      // Bounding client rect
  y: number;
  width: number;
  height: number;
  data?: Record<string, any>;
}

export interface TargetingOptions {
  hitPadding?: number;      // Extra padding (default: 16px)
  hysteresisMargin?: number; // Sticky hover margin to avoid flicker (default: 24px)
  magnetismRadius?: number; // Distance within which cursor is visually pulled (default: 40px)
  snapRadius?: number;      // Drop zone snap distance (default: 60px)
}

export interface TargetingResult {
  hoveredTargetId: string | null;
  stickyTargetId: string | null;
  cursorDisplayX: number;
  cursorDisplayY: number;
  isMagnetized: boolean;
}

export function createTargetResolverForProfile(
  profile: { mode?: string; gaze?: { validation?: { p90ErrorPx?: number } | null }; largeTargetMode?: boolean } | null
): TargetResolver {
  if (profile?.mode === 'eye') {
    const p90 = profile.gaze?.validation?.p90ErrorPx ?? 160;
    const padding = Math.max(32, Math.round(0.75 * p90));
    const isLarge = profile.largeTargetMode;
    return new TargetResolver({
      hitPadding: isLarge ? Math.round(padding * 1.3) : padding,
      hysteresisMargin: isLarge ? 50 : 36,
      magnetismRadius: isLarge ? 80 : 60,
      snapRadius: isLarge ? 90 : 75,
    });
  }
  return new TargetResolver();
}

export class TargetResolver {
  private currentStickyId: string | null = null;
  private options: Required<TargetingOptions>;

  constructor(options: TargetingOptions = {}) {
    this.options = {
      hitPadding: options.hitPadding ?? 16,
      hysteresisMargin: options.hysteresisMargin ?? 24,
      magnetismRadius: options.magnetismRadius ?? 40,
      snapRadius: options.snapRadius ?? 60,
    };
  }

  public reset(): void {
    this.currentStickyId = null;
  }

  public getStickyId(): string | null {
    return this.currentStickyId;
  }

  /**
   * Pure evaluation: finds hovered target with sticky hysteresis and magnetism pull.
   */
  public resolveTarget(
    cursorX: number,
    cursorY: number,
    targets: TargetRect[]
  ): TargetingResult {
    // 1. Check if existing sticky target is still retained (generous hysteresis margin)
    if (this.currentStickyId) {
      const active = targets.find((t) => t.id === this.currentStickyId);
      if (active) {
        const margin = this.options.hitPadding + this.options.hysteresisMargin;
        const left = active.x - margin;
        const right = active.x + active.width + margin;
        const top = active.y - margin;
        const bottom = active.y + active.height + margin;

        if (cursorX >= left && cursorX <= right && cursorY >= top && cursorY <= bottom) {
          // Still within sticky threshold
          const display = this.computeMagnetism(cursorX, cursorY, active);
          return {
            hoveredTargetId: active.id,
            stickyTargetId: active.id,
            cursorDisplayX: display.x,
            cursorDisplayY: display.y,
            isMagnetized: display.isMagnetized,
          };
        }
      }
      // Left the sticky target area
      this.currentStickyId = null;
    }

    // 2. Find closest target whose padded rect contains cursor
    let bestTarget: TargetRect | null = null;
    let minCenterDist = Infinity;

    for (const t of targets) {
      const pad = this.options.hitPadding;
      const left = t.x - pad;
      const right = t.x + t.width + pad;
      const top = t.y - pad;
      const bottom = t.y + t.height + pad;

      if (cursorX >= left && cursorX <= right && cursorY >= top && cursorY <= bottom) {
        const cx = t.x + t.width / 2;
        const cy = t.y + t.height / 2;
        const dist = Math.hypot(cursorX - cx, cursorY - cy);
        if (dist < minCenterDist) {
          minCenterDist = dist;
          bestTarget = t;
        }
      }
    }

    if (bestTarget) {
      this.currentStickyId = bestTarget.id;
      const display = this.computeMagnetism(cursorX, cursorY, bestTarget);
      return {
        hoveredTargetId: bestTarget.id,
        stickyTargetId: bestTarget.id,
        cursorDisplayX: display.x,
        cursorDisplayY: display.y,
        isMagnetized: display.isMagnetized,
      };
    }

    return {
      hoveredTargetId: null,
      stickyTargetId: null,
      cursorDisplayX: cursorX,
      cursorDisplayY: cursorY,
      isMagnetized: false,
    };
  }

  /**
   * Checks if a dragged item at (x, y) snaps to a drop zone
   */
  public findSnapZone(
    x: number,
    y: number,
    dropZones: TargetRect[]
  ): TargetRect | null {
    let closestZone: TargetRect | null = null;
    let minDist = this.options.snapRadius;

    for (const zone of dropZones) {
      const cx = zone.x + zone.width / 2;
      const cy = zone.y + zone.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= minDist) {
        minDist = dist;
        closestZone = zone;
      }
    }

    return closestZone;
  }

  private computeMagnetism(
    cursorX: number,
    cursorY: number,
    target: TargetRect
  ): { x: number; y: number; isMagnetized: boolean } {
    const cx = target.x + target.width / 2;
    const cy = target.y + target.height / 2;
    const dist = Math.hypot(cursorX - cx, cursorY - cy);

    if (dist <= this.options.magnetismRadius && dist > 0) {
      // Pull cursor 30% closer to center of target for steady selection
      const pull = 0.35;
      return {
        x: cursorX + (cx - cursorX) * pull,
        y: cursorY + (cy - cursorY) * pull,
        isMagnetized: true,
      };
    }

    return { x: cursorX, y: cursorY, isMagnetized: false };
  }
}

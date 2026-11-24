import { describe, it, expect } from 'vitest';
import { TargetResolver, type TargetRect } from '../src/lesson/targeting';
import { ScrollController } from '../src/lesson/scrollZones';

describe('Targeting & Hover Hysteresis (Pure)', () => {
  const targets: TargetRect[] = [
    { id: 'btn_a', type: 'button', x: 100, y: 100, width: 120, height: 60 },
    { id: 'btn_b', type: 'button', x: 260, y: 100, width: 120, height: 60 },
  ];

  it('detects hover with hit padding', () => {
    const resolver = new TargetResolver({ hitPadding: 20 });
    // Cursor at (85, 100) is 15px outside rect, but inside 20px hit padding
    const res = resolver.resolveTarget(85, 100, targets);
    expect(res.hoveredTargetId).toBe('btn_a');
  });

  it('sticky hover keeps current target across neighbor boundary until clear exit', () => {
    const resolver = new TargetResolver({ hitPadding: 10, hysteresisMargin: 30 });

    // Hover btn_a
    let res = resolver.resolveTarget(150, 120, targets);
    expect(res.hoveredTargetId).toBe('btn_a');

    // Move cursor right into border region (x=235) between btn_a (ends at 220) and btn_b (starts at 260)
    // 235 is 15px outside btn_a, which is within hysteresisMargin (10 + 30 = 40px)
    res = resolver.resolveTarget(235, 120, targets);
    expect(res.hoveredTargetId).toBe('btn_a'); // Still sticky!

    // Move definitively over to btn_b (x=280)
    res = resolver.resolveTarget(280, 120, targets);
    expect(res.hoveredTargetId).toBe('btn_b');
  });

  it('snaps dropped label within snap radius', () => {
    const resolver = new TargetResolver({ snapRadius: 50 });
    const dropZones: TargetRect[] = [
      { id: 'zone_nucleus', type: 'drop_zone', x: 400, y: 300, width: 80, height: 80 }, // center is 440, 340
    ];

    // Dropped at (450, 350) -> dist = sqrt(10^2 + 10^2) = 14px <= 50px
    const snap = resolver.findSnapZone(450, 350, dropZones);
    expect(snap?.id).toBe('zone_nucleus');

    // Dropped far at (600, 300) -> dist > 50px
    const farSnap = resolver.findSnapZone(600, 300, dropZones);
    expect(farSnap).toBeNull();
  });
});

describe('Scroll Zone Dwell Logic', () => {
  it('does not scroll until dwell time is met, with dead zone margin', () => {
    const scroll = new ScrollController({
      topBandPx: 100,
      bottomBandPx: 100,
      dwellTimeMs: 250,
      deadZonePx: 20,
      maxSpeedPxPerFrame: 15,
    });

    const viewportH = 800;

    // Cursor enters bottom band at y = 750 (viewportH - 100 = 700) at t=0
    let dec = scroll.evaluate(750, viewportH, 0);
    expect(dec.inBand).toBe('bottom');
    expect(dec.shouldScroll).toBe(false);

    // At t=150ms (< 250ms dwell), passing through does not scroll
    dec = scroll.evaluate(750, viewportH, 150);
    expect(dec.shouldScroll).toBe(false);

    // At t=300ms (> 250ms dwell), starts scrolling down
    dec = scroll.evaluate(750, viewportH, 300);
    expect(dec.shouldScroll).toBe(true);
    expect(dec.deltaY).toBeGreaterThan(0);

    // Stopped immediately on pause
    dec = scroll.evaluate(750, viewportH, 350, true);
    expect(dec.shouldScroll).toBe(false);
  });
});

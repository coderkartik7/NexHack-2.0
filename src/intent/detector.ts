import type { CommandBinding } from '../calibration/types';
import type { DetectorResult } from './types';

/**
 * Pure function: converts a raw signal reading to active-direction space,
 * where higher values ALWAYS indicate greater gesture activity/intent.
 * 
 * - For direction: 'high' (e.g. jawOpen, browRaise, blink, openPalm): activeVal = rawVal
 * - For direction: 'low' (e.g. pinch aperture): activeVal = -rawVal
 * 
 * Compares against enter/exit thresholds with hysteresis.
 * A null or NaN signal is marked unknown and never active.
 */
export function detectSignal(
  rawVal: number | null | undefined,
  binding: Pick<CommandBinding, 'direction' | 'enter' | 'exit'>
): DetectorResult {
  const isHigh = binding.direction === 'high';
  const enterActive = isHigh ? binding.enter : -binding.enter;
  const exitActive = isHigh ? binding.exit : -binding.exit;

  if (rawVal === null || rawVal === undefined || isNaN(rawVal)) {
    return {
      rawSignal: null,
      activeVal: null,
      enterActive,
      exitActive,
      isAboveEnter: false,
      isAboveExit: false,
      isUnknown: true,
    };
  }

  const activeVal = isHigh ? rawVal : -rawVal;

  return {
    rawSignal: rawVal,
    activeVal,
    enterActive,
    exitActive,
    isAboveEnter: activeVal >= enterActive,
    isAboveExit: activeVal >= exitActive,
    isUnknown: false,
  };
}

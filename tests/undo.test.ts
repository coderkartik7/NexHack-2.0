import { describe, it, expect } from 'vitest';
import {
  LessonStore,
  createSelectOptionAction,
  createPlaceLabelAction,
} from '../src/lesson/lessonStore';

describe('Undo Stack Behavior', () => {
  it('undoes question option selection back to previous selection and initial state', () => {
    const store = new LessonStore();
    expect(store.canUndo()).toBe(false);

    store.execute(createSelectOptionAction('opt_a', 100)); // wrong
    expect(store.getState().selectedOptionId).toBe('opt_a');
    expect(store.canUndo()).toBe(true);

    store.execute(createSelectOptionAction('opt_b', 200)); // right
    expect(store.getState().selectedOptionId).toBe('opt_b');
    expect(store.getState().isQuestionCorrect).toBe(true);

    // Undo once -> goes back to opt_a
    store.undo();
    expect(store.getState().selectedOptionId).toBe('opt_a');
    expect(store.getState().isQuestionCorrect).toBe(false);

    // Undo second time -> back to unselected
    store.undo();
    expect(store.getState().selectedOptionId).toBeNull();
    expect(store.getState().isQuestionAnswered).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it('undoes label placement, returning label safely to tray or previous zone', () => {
    const store = new LessonStore();

    store.execute(createPlaceLabelAction('label_nucleus', 'zone_chloroplast', 100)); // wrong zone
    expect(store.getState().placements['label_nucleus']).toBe('zone_chloroplast');
    expect(store.getState().placementResults['label_nucleus']).toBe(false);

    // Undo -> returns to tray (null)
    store.undo();
    expect(store.getState().placements['label_nucleus']).toBeNull();
    expect(store.getState().placementResults['label_nucleus']).toBe(false);
  });
});

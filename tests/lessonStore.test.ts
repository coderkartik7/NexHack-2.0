import { describe, it, expect } from 'vitest';
import {
  LessonStore,
  createSelectOptionAction,
  createPlaceLabelAction,
} from '../src/lesson/lessonStore';

describe('Lesson Store & Reducer Transitions (Pure)', () => {
  it('selects option, checks correctness, and calculates completion', () => {
    const store = new LessonStore();

    // Select incorrect option first (opt_a: Mitochondria)
    store.execute(createSelectOptionAction('opt_a', 100));
    expect(store.getState().selectedOptionId).toBe('opt_a');
    expect(store.getState().isQuestionCorrect).toBe(false);
    expect(store.getState().isCompleted).toBe(false);

    // Select correct option (opt_b: Chloroplast)
    store.execute(createSelectOptionAction('opt_b', 200));
    expect(store.getState().isQuestionCorrect).toBe(true);
    expect(store.getState().questionAttempts).toBe(2);
  });

  it('drops label into zone, snaps, and marks completion when all labels match', () => {
    const store = new LessonStore();
    // Answer question correctly
    store.execute(createSelectOptionAction('opt_b', 100));

    // Place labels
    store.execute(createPlaceLabelAction('label_nucleus', 'zone_nucleus', 200));
    expect(store.getState().placements['label_nucleus']).toBe('zone_nucleus');
    expect(store.getState().placementResults['label_nucleus']).toBe(true);
    expect(store.getState().isCompleted).toBe(false);

    store.execute(createPlaceLabelAction('label_chloroplast', 'zone_chloroplast', 300));
    expect(store.getState().isCompleted).toBe(false);

    store.execute(createPlaceLabelAction('label_cell_wall', 'zone_cell_wall', 400));
    // All 3 labels correct and question correct -> complete!
    expect(store.getState().isCompleted).toBe(true);
    expect(store.getState().completedAt).toBe(400);
  });

  it('drop is cancelled cleanly on tracking loss or cancelDrag', () => {
    const store = new LessonStore();
    store.setDragging('label_nucleus', { x: 300, y: 200 });
    expect(store.getState().draggedLabelId).toBe('label_nucleus');

    store.cancelDrag();
    expect(store.getState().draggedLabelId).toBeNull();
    expect(store.getState().placements['label_nucleus']).toBeNull(); // remains in tray
  });
});

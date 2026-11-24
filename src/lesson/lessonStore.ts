import { PLANT_CELL_LESSON, type LessonContent } from './lessonData';
import { UndoStack, type UndoableAction } from './actions';

export interface LessonState {
  lesson: LessonContent;
  selectedOptionId: string | null;
  isQuestionAnswered: boolean;
  isQuestionCorrect: boolean;
  questionAttempts: number;

  // Label placements: map of labelId -> dropZoneId (null if in tray)
  placements: Record<string, string | null>;
  // Placed status: map of labelId -> boolean (correctly placed)
  placementResults: Record<string, boolean>;
  labelAttempts: number;

  // Active dragging
  draggedLabelId: string | null;
  dragPosition: { x: number; y: number } | null;

  isCompleted: boolean;
  completedAt: number | null;
}

export function createInitialLessonState(lesson: LessonContent = PLANT_CELL_LESSON): LessonState {
  const placements: Record<string, string | null> = {};
  const placementResults: Record<string, boolean> = {};

  for (const lbl of lesson.diagram.labels) {
    placements[lbl.id] = null;
    placementResults[lbl.id] = false;
  }

  return {
    lesson,
    selectedOptionId: null,
    isQuestionAnswered: false,
    isQuestionCorrect: false,
    questionAttempts: 0,
    placements,
    placementResults,
    labelAttempts: 0,
    draggedLabelId: null,
    dragPosition: null,
    isCompleted: false,
    completedAt: null,
  };
}

/**
 * Pure functions creating undoable actions for lesson state changes
 */

export function createSelectOptionAction(
  optionId: string,
  now: number
): UndoableAction<LessonState> {
  let prevOptionId: string | null = null;
  let prevAnswered = false;
  let prevCorrect = false;
  let prevAttempts = 0;
  let prevCompleted = false;

  return {
    type: 'SELECT_OPTION',
    description: `Select answer option "${optionId}"`,
    timestamp: now,
    do: (state) => {
      prevOptionId = state.selectedOptionId;
      prevAnswered = state.isQuestionAnswered;
      prevCorrect = state.isQuestionCorrect;
      prevAttempts = state.questionAttempts;
      prevCompleted = state.isCompleted;

      const opt = state.lesson.question.options.find((o) => o.id === optionId);
      const isCorrect = opt?.isCorrect ?? false;

      const next = {
        ...state,
        selectedOptionId: optionId,
        isQuestionAnswered: true,
        isQuestionCorrect: isCorrect,
        questionAttempts: state.questionAttempts + 1,
      };

      next.isCompleted = checkLessonCompletion(next);
      if (next.isCompleted && !state.isCompleted) {
        next.completedAt = now;
      }

      return next;
    },
    undo: (state) => {
      return {
        ...state,
        selectedOptionId: prevOptionId,
        isQuestionAnswered: prevAnswered,
        isQuestionCorrect: prevCorrect,
        questionAttempts: prevAttempts,
        isCompleted: prevCompleted,
        completedAt: prevCompleted ? state.completedAt : null,
      };
    },
  };
}

export function createPlaceLabelAction(
  labelId: string,
  dropZoneId: string | null,
  now: number
): UndoableAction<LessonState> {
  let prevZoneId: string | null = null;
  let prevResult = false;
  let prevAttempts = 0;
  let prevCompleted = false;

  return {
    type: 'PLACE_LABEL',
    description: dropZoneId ? `Place label "${labelId}" in "${dropZoneId}"` : `Return label "${labelId}" to tray`,
    timestamp: now,
    do: (state) => {
      prevZoneId = state.placements[labelId] ?? null;
      prevResult = state.placementResults[labelId] ?? false;
      prevAttempts = state.labelAttempts;
      prevCompleted = state.isCompleted;

      const label = state.lesson.diagram.labels.find((l) => l.id === labelId);
      const isCorrect = dropZoneId !== null && label?.correctZoneId === dropZoneId;

      const nextPlacements = { ...state.placements, [labelId]: dropZoneId };
      const nextResults = { ...state.placementResults, [labelId]: isCorrect };

      const next = {
        ...state,
        placements: nextPlacements,
        placementResults: nextResults,
        labelAttempts: state.labelAttempts + 1,
        draggedLabelId: null,
        dragPosition: null,
      };

      next.isCompleted = checkLessonCompletion(next);
      if (next.isCompleted && !state.isCompleted) {
        next.completedAt = now;
      }

      return next;
    },
    undo: (state) => {
      const nextPlacements = { ...state.placements, [labelId]: prevZoneId };
      const nextResults = { ...state.placementResults, [labelId]: prevResult };

      return {
        ...state,
        placements: nextPlacements,
        placementResults: nextResults,
        labelAttempts: prevAttempts,
        draggedLabelId: null,
        dragPosition: null,
        isCompleted: prevCompleted,
        completedAt: prevCompleted ? state.completedAt : null,
      };
    },
  };
}

export function checkLessonCompletion(state: LessonState): boolean {
  if (!state.isQuestionCorrect) return false;
  // All labels must be placed in their correct drop zone
  for (const lbl of state.lesson.diagram.labels) {
    if (state.placements[lbl.id] !== lbl.correctZoneId) {
      return false;
    }
  }
  return true;
}

export class LessonStore {
  private state: LessonState;
  private undoStack: UndoStack<LessonState> = new UndoStack();
  private listeners: Set<(state: LessonState) => void> = new Set();

  constructor(initialState: LessonState = createInitialLessonState()) {
    this.state = initialState;
  }

  public getState(): LessonState {
    return this.state;
  }

  public subscribe(listener: (state: LessonState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      l(this.state);
    }
  }

  public execute(action: UndoableAction<LessonState>): void {
    this.state = action.do(this.state);
    this.undoStack.push(action);
    this.notify();
  }

  public undo(): UndoableAction<LessonState> | null {
    const action = this.undoStack.pop();
    if (!action) return null;
    this.state = action.undo(this.state);
    this.notify();
    return action;
  }

  public canUndo(): boolean {
    return this.undoStack.canUndo();
  }

  public setDragging(labelId: string | null, pos: { x: number; y: number } | null): void {
    this.state = {
      ...this.state,
      draggedLabelId: labelId,
      dragPosition: pos,
    };
    this.notify();
  }

  public cancelDrag(): void {
    if (this.state.draggedLabelId) {
      this.state = {
        ...this.state,
        draggedLabelId: null,
        dragPosition: null,
      };
      this.notify();
    }
  }
}

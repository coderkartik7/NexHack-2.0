export interface UndoableAction<S> {
  type: string;
  description: string;
  timestamp: number;
  do: (state: S) => S;
  undo: (state: S) => S;
}

export class UndoStack<S> {
  private stack: UndoableAction<S>[] = [];
  private maxDepth: number;

  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
  }

  public push(action: UndoableAction<S>): void {
    this.stack.push(action);
    if (this.stack.length > this.maxDepth) {
      this.stack.shift();
    }
  }

  public pop(): UndoableAction<S> | undefined {
    return this.stack.pop();
  }

  public peek(): UndoableAction<S> | undefined {
    return this.stack[this.stack.length - 1];
  }

  public canUndo(): boolean {
    return this.stack.length > 0;
  }

  public getCount(): number {
    return this.stack.length;
  }

  public clear(): void {
    this.stack = [];
  }
}

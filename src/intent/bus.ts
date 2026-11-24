import type { BusEvent } from './types';

export type BusListener = (event: BusEvent) => void;

export class CommandBus {
  private listeners: Set<BusListener> = new Set();

  public subscribe(listener: BusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(event: BusEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in CommandBus listener:', err);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const commandBus = new CommandBus();

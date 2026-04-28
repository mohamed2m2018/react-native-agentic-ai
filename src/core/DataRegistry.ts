import type { DataDefinition } from './types';

export class DataRegistry {
  private dataSources = new Map<string, DataDefinition>();
  private listeners = new Set<() => void>();

  register(source: DataDefinition): void {
    this.dataSources.set(source.name, source);
    this.notify();
  }

  unregister(name: string): void {
    this.dataSources.delete(name);
    this.notify();
  }

  get(name: string): DataDefinition | undefined {
    return this.dataSources.get(name);
  }

  getAll(): DataDefinition[] {
    return Array.from(this.dataSources.values());
  }

  clear(): void {
    this.dataSources.clear();
    this.notify();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const dataRegistry = new DataRegistry();

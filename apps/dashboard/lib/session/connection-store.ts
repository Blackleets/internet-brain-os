export type KernelConnection = {
  baseUrl: string;
  token: string;
};

export type ConnectionListener = () => void;

export class ConnectionStore {
  #connection: KernelConnection | undefined;
  #listeners = new Set<ConnectionListener>();

  get(): KernelConnection | undefined {
    return this.#connection;
  }

  set(connection: KernelConnection): void {
    this.#connection = connection;
    this.notify();
  }

  clear(): void {
    this.#connection = undefined;
    this.notify();
  }

  subscribe(listener: ConnectionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  private notify(): void {
    this.#listeners.forEach((listener) => listener());
  }
}

export const connectionStore = new ConnectionStore();

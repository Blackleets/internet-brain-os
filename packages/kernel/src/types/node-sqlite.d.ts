// Minimal ambient declaration for node:sqlite (experimental builtin, Node >=22.5).
// Remove once the repo upgrades @types/node to a version that ships it.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean });
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
      get(...params: unknown[]): Record<string, unknown> | undefined;
      all(...params: unknown[]): Array<Record<string, unknown>>;
    };
    close(): void;
  }
}

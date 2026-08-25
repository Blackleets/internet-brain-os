import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Entity, EntityId } from '@internet-brain-os/shared';
import type { EntityRepository } from './entity-repository';

/**
 * Durable EntityRepository backed by node:sqlite (zero external dependencies).
 *
 * Stores each entity as one row; JSON columns carry aliases, properties and
 * evidenceIds. The schema is created lazily on first open so a fresh data
 * directory just works, and the same file reopens with all prior state.
 */
export class SqliteEntityRepository implements EntityRepository {
  private readonly database: DatabaseSync;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        aliases_json TEXT NOT NULL DEFAULT '[]',
        properties_json TEXT NOT NULL DEFAULT '{}',
        verification_status TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        evidence_ids_json TEXT NOT NULL DEFAULT '[]'
      );
    `);
  }

  async create(entity: Entity): Promise<void> {
    const existing = this.database.prepare('SELECT id FROM entities WHERE id = ?').get(entity.id);
    if (existing) throw new Error(`Entity already exists: ${entity.id}`);
    this.insert(entity);
  }

  async getById(id: EntityId): Promise<Entity | null> {
    const row = this.database.prepare('SELECT * FROM entities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.hydrate(row) : null;
  }

  async list(): Promise<readonly Entity[]> {
    const rows = this.database.prepare('SELECT * FROM entities ORDER BY created_at').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.hydrate(row));
  }

  async update(entity: Entity): Promise<void> {
    const result = this.database
      .prepare(`UPDATE entities SET type = ?, name = ?, description = ?, aliases_json = ?, properties_json = ?,
                verification_status = ?, confidence = ?, updated_at = ?, evidence_ids_json = ? WHERE id = ?`)
      .run(
        entity.type,
        entity.name,
        entity.description ?? null,
        JSON.stringify(entity.aliases ?? []),
        JSON.stringify(entity.properties),
        entity.verificationStatus,
        entity.confidence,
        entity.updatedAt,
        JSON.stringify(entity.evidenceIds),
        entity.id,
      );
    if (result.changes === 0) throw new Error(`Entity not found: ${entity.id}`);
  }

  close(): void {
    this.database.close();
  }

  private insert(entity: Entity): void {
    this.database
      .prepare(`INSERT INTO entities (id, type, name, description, aliases_json, properties_json,
                verification_status, confidence, created_at, updated_at, evidence_ids_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        entity.id,
        entity.type,
        entity.name,
        entity.description ?? null,
        JSON.stringify(entity.aliases ?? []),
        JSON.stringify(entity.properties),
        entity.verificationStatus,
        entity.confidence,
        entity.createdAt,
        entity.updatedAt,
        JSON.stringify(entity.evidenceIds),
      );
  }

  private hydrate(row: Record<string, unknown>): Entity {
    const description = row.description as string | null;
    return {
      id: row.id as EntityId,
      type: row.type as string,
      name: row.name as string,
      // Spread order keeps round-trips exact: absent description stays absent
      // (undefined is dropped by JSON and never materializes as a key).
      ...(description !== null && description !== undefined ? { description } : {}),
      aliases: JSON.parse(row.aliases_json as string) as string[],
      properties: JSON.parse(row.properties_json as string) as Record<string, unknown>,
      verificationStatus: row.verification_status as Entity['verificationStatus'],
      confidence: row.confidence as Entity['confidence'],
      createdAt: row.created_at as Entity['createdAt'],
      updatedAt: row.updated_at as Entity['updatedAt'],
      evidenceIds: JSON.parse(row.evidence_ids_json as string) as Entity['evidenceIds'],
    };
  }
}

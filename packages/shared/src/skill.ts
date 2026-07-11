// skill.ts
import type { SkillId, IsoDateTime } from './common';

export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly author?: string;
  readonly tags: readonly string[];
  readonly inputSchemaVersion: string;
  readonly outputSchemaVersion: string;
}

export interface SkillInstallation {
  readonly skillId: SkillId;
  readonly isEnabled: boolean;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
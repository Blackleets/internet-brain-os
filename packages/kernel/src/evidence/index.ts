export { EvidenceManager } from './evidence-manager';
export type {
  CreateEvidenceInput,
  UpdateEvidenceMetadataInput,
} from './evidence-manager';
export type {
  EvidenceCaseReader,
  EvidenceRecord,
  EvidenceRepository,
} from './evidence-repository';
export {
  ArchivedCaseEvidenceLinkError,
  EvidenceAlreadyExistsError,
  EvidenceNotFoundError,
  InvalidEvidenceInputError,
  StaleEvidenceUpdateError,
} from './evidence-errors';
export type { InvalidEvidenceInputField } from './evidence-errors';

export { evidenceSupportsGoal } from './support';
export type {
  EvidenceSupportResult,
  GoalSupportInput,
  PageSupportInput,
} from './support';

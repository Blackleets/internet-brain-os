import { StorageError } from './storage-errors';

export class InvalidCognitivePipelineRecordError extends StorageError {
  constructor(message: string) {
    super(`Invalid cognitive pipeline record: ${message}`);
  }
}

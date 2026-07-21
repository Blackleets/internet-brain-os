export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

export class AlreadyExistsError extends StorageError {
  constructor(resource: string, id: string) {
    super(`${resource} already exists: ${id}`);
  }
}

export class NotFoundError extends StorageError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
  }
}

export class CorruptDataError extends StorageError {
  constructor(path: string, cause?: unknown) {
    super(`Stored data is corrupt or unsupported: ${path}`, cause);
  }
}

export class InvalidPathError extends StorageError {
  constructor(path: string) {
    super(`Invalid storage path: ${path}`);
  }
}

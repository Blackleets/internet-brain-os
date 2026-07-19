export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
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
  constructor(path: string, options?: ErrorOptions) {
    super(`Stored data is corrupt or unsupported: ${path}`, options);
  }
}

export class InvalidPathError extends StorageError {
  constructor(path: string) {
    super(`Invalid storage path: ${path}`);
  }
}

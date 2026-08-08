export class CapabilityNotFoundError extends Error {
  constructor(readonly capabilityId: string) {
    super(`Capability is not registered: ${capabilityId}`);
    this.name = 'CapabilityNotFoundError';
  }
}

export class CapabilityVersionMismatchError extends Error {
  constructor(readonly capabilityId: string, readonly requestedVersion: string, readonly registeredVersion: string) {
    super(`Capability version mismatch for ${capabilityId}`);
    this.name = 'CapabilityVersionMismatchError';
  }
}

export class CapabilityUnavailableError extends Error {
  constructor(readonly capabilityId: string, readonly health: string) {
    super(`Capability is not available: ${capabilityId}`);
    this.name = 'CapabilityUnavailableError';
  }
}

export class CapabilityDeniedError extends Error {
  constructor(readonly capabilityId: string, readonly reason: string) {
    super(`Capability denied: ${capabilityId} (${reason})`);
    this.name = 'CapabilityDeniedError';
  }
}

export class InvalidCapabilityDefinitionError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'InvalidCapabilityDefinitionError';
  }
}

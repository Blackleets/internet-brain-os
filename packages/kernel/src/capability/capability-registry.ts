import {
  CAPABILITY_CONSENT_POLICIES,
  CAPABILITY_HEALTH_STATES,
  CAPABILITY_RISK_LEVELS,
  type AuthorizedCapability,
  type CapabilityAuthorizationContext,
  type CapabilityDefinition,
  type CapabilityRequest,
} from './capability-contract';
import {
  CapabilityDeniedError,
  CapabilityNotFoundError,
  CapabilityUnavailableError,
  CapabilityVersionMismatchError,
  InvalidCapabilityDefinitionError,
} from './capability-errors';

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();

  constructor(definitions: readonly CapabilityDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: CapabilityDefinition): void {
    const normalized = validateAndCloneDefinition(definition);
    if (this.definitions.has(normalized.id)) {
      throw new InvalidCapabilityDefinitionError('id', `Capability is already registered: ${normalized.id}`);
    }
    this.definitions.set(normalized.id, normalized);
  }

  get(capabilityId: string): CapabilityDefinition | null {
    const definition = this.definitions.get(clean(capabilityId, 'capabilityId'));
    return definition ? cloneDefinition(definition) : null;
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.definitions.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(cloneDefinition);
  }

  authorize(request: CapabilityRequest, context: CapabilityAuthorizationContext): AuthorizedCapability {
    const capabilityId = clean(request.capabilityId, 'capabilityId');
    const definition = this.definitions.get(capabilityId);
    if (!definition) throw new CapabilityNotFoundError(capabilityId);

    if (request.version !== undefined && clean(request.version, 'version') !== definition.version) {
      throw new CapabilityVersionMismatchError(capabilityId, request.version, definition.version);
    }
    if (definition.health !== 'available') {
      throw new CapabilityUnavailableError(capabilityId, definition.health);
    }

    const allowedCapabilities = new Set(context.goalAllowedCapabilities);
    const forbiddenCapabilities = new Set(context.goalForbiddenCapabilities);
    if (!allowedCapabilities.has(capabilityId)) {
      throw new CapabilityDeniedError(capabilityId, 'not_allowed_by_goal');
    }
    if (forbiddenCapabilities.has(capabilityId)) {
      throw new CapabilityDeniedError(capabilityId, 'forbidden_by_goal');
    }

    const allowedDataScopes = new Set(context.goalAllowedDataScopes);
    const forbiddenDataScopes = new Set(context.goalForbiddenDataScopes);
    for (const scope of definition.allowedDataScopes) {
      if (forbiddenDataScopes.has(scope)) throw new CapabilityDeniedError(capabilityId, `forbidden_data_scope:${scope}`);
      if (allowedDataScopes.size > 0 && !allowedDataScopes.has(scope)) {
        throw new CapabilityDeniedError(capabilityId, `data_scope_not_allowed:${scope}`);
      }
    }

    return {
      definition: cloneDefinition(definition),
      requiresConsent: definition.consentPolicy !== 'none',
    };
  }
}

function validateAndCloneDefinition(input: CapabilityDefinition): CapabilityDefinition {
  const id = clean(input.id, 'id');
  const version = clean(input.version, 'version');
  const provider = clean(input.provider, 'provider');
  if (!CAPABILITY_RISK_LEVELS.includes(input.riskLevel)) {
    throw new InvalidCapabilityDefinitionError('riskLevel', 'Invalid capability risk level');
  }
  if (!CAPABILITY_CONSENT_POLICIES.includes(input.consentPolicy)) {
    throw new InvalidCapabilityDefinitionError('consentPolicy', 'Invalid capability consent policy');
  }
  if (!CAPABILITY_HEALTH_STATES.includes(input.health)) {
    throw new InvalidCapabilityDefinitionError('health', 'Invalid capability health state');
  }
  const allowedDataScopes = uniqueClean(input.allowedDataScopes, 'allowedDataScopes');
  const credentialScopes = uniqueClean(input.credentialScopes, 'credentialScopes');
  return {
    id,
    version,
    provider,
    riskLevel: input.riskLevel,
    consentPolicy: input.consentPolicy,
    allowedDataScopes,
    credentialScopes,
    health: input.health,
    ...(input.description === undefined ? {} : { description: clean(input.description, 'description') }),
  };
}

function uniqueClean(values: readonly string[], field: string): readonly string[] {
  if (!Array.isArray(values)) throw new InvalidCapabilityDefinitionError(field, `${field} must be an array`);
  const normalized = values.map((value) => clean(value, field));
  if (new Set(normalized).size !== normalized.length) {
    throw new InvalidCapabilityDefinitionError(field, `${field} contains duplicates`);
  }
  return [...normalized];
}

function clean(value: string, field: string): string {
  if (typeof value !== 'string') throw new InvalidCapabilityDefinitionError(field, `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new InvalidCapabilityDefinitionError(field, `${field} is invalid`);
  }
  return normalized;
}

function cloneDefinition(definition: CapabilityDefinition): CapabilityDefinition {
  return {
    ...definition,
    allowedDataScopes: [...definition.allowedDataScopes],
    credentialScopes: [...definition.credentialScopes],
  };
}

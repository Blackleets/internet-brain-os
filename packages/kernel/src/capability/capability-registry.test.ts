import { describe, expect, test } from 'vitest';
import { CapabilityRegistry } from './capability-registry';
import {
  CapabilityDeniedError,
  CapabilityNotFoundError,
  CapabilityUnavailableError,
  CapabilityVersionMismatchError,
  InvalidCapabilityDefinitionError,
} from './capability-errors';
import type { CapabilityAuthorizationContext, CapabilityDefinition } from './capability-contract';

const webSearch: CapabilityDefinition = {
  id: 'web.search',
  version: '1',
  provider: 'browser-research',
  riskLevel: 'r0_observe',
  consentPolicy: 'none',
  allowedDataScopes: ['public_web'],
  credentialScopes: [],
  health: 'available',
};

const context: CapabilityAuthorizationContext = {
  planId: 'plan:1',
  goalAllowedCapabilities: ['web.search'],
  goalForbiddenCapabilities: [],
  goalAllowedDataScopes: ['public_web'],
  goalForbiddenDataScopes: [],
};

describe('CapabilityRegistry', () => {
  test('authorizes only a registered healthy capability allowed by the Goal', () => {
    const registry = new CapabilityRegistry([webSearch]);
    expect(registry.authorize({ capabilityId: 'web.search', version: '1' }, context)).toMatchObject({
      requiresConsent: false,
      definition: { id: 'web.search', riskLevel: 'r0_observe' },
    });
  });

  test('fails closed when a capability is unknown', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.authorize({ capabilityId: 'web.search' }, context)).toThrow(CapabilityNotFoundError);
  });

  test('rejects a version mismatch', () => {
    const registry = new CapabilityRegistry([webSearch]);
    expect(() => registry.authorize({ capabilityId: 'web.search', version: '2' }, context)).toThrow(CapabilityVersionMismatchError);
  });

  test('rejects degraded and unavailable capabilities', () => {
    for (const health of ['degraded', 'unavailable'] as const) {
      const registry = new CapabilityRegistry([{ ...webSearch, health }]);
      expect(() => registry.authorize({ capabilityId: 'web.search' }, context)).toThrow(CapabilityUnavailableError);
    }
  });

  test('rejects capabilities omitted or explicitly forbidden by the Goal', () => {
    const registry = new CapabilityRegistry([webSearch]);
    expect(() => registry.authorize({ capabilityId: 'web.search' }, { ...context, goalAllowedCapabilities: [] })).toThrow(CapabilityDeniedError);
    expect(() => registry.authorize({ capabilityId: 'web.search' }, { ...context, goalForbiddenCapabilities: ['web.search'] })).toThrow(CapabilityDeniedError);
  });

  test('rejects a capability whose data scope exceeds the Goal scope', () => {
    const registry = new CapabilityRegistry([webSearch]);
    expect(() => registry.authorize({ capabilityId: 'web.search' }, { ...context, goalAllowedDataScopes: ['local_files'] })).toThrow(CapabilityDeniedError);
    expect(() => registry.authorize({ capabilityId: 'web.search' }, { ...context, goalForbiddenDataScopes: ['public_web'] })).toThrow(CapabilityDeniedError);
  });

  test('marks policy and always-consent capabilities as requiring consent', () => {
    for (const consentPolicy of ['policy', 'always'] as const) {
      const registry = new CapabilityRegistry([{ ...webSearch, consentPolicy }]);
      expect(registry.authorize({ capabilityId: 'web.search' }, context).requiresConsent).toBe(true);
    }
  });

  test('defensively copies definitions and rejects duplicate registration', () => {
    const dataScopes = ['public_web'];
    const registry = new CapabilityRegistry([{ ...webSearch, allowedDataScopes: dataScopes }]);
    dataScopes.push('private_data');
    expect(registry.get('web.search')?.allowedDataScopes).toEqual(['public_web']);
    expect(() => registry.register(webSearch)).toThrow(InvalidCapabilityDefinitionError);
  });
});

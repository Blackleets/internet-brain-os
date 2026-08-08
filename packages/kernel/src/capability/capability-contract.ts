export const CAPABILITY_RISK_LEVELS = ['r0_observe', 'r1_reversible', 'r2_external', 'r3_irreversible'] as const;
export type CapabilityRiskLevel = (typeof CAPABILITY_RISK_LEVELS)[number];

export const CAPABILITY_HEALTH_STATES = ['available', 'degraded', 'unavailable'] as const;
export type CapabilityHealthState = (typeof CAPABILITY_HEALTH_STATES)[number];

export const CAPABILITY_CONSENT_POLICIES = ['none', 'policy', 'always'] as const;
export type CapabilityConsentPolicy = (typeof CAPABILITY_CONSENT_POLICIES)[number];

export interface CapabilityDefinition {
  readonly id: string;
  readonly version: string;
  readonly provider: string;
  readonly riskLevel: CapabilityRiskLevel;
  readonly consentPolicy: CapabilityConsentPolicy;
  readonly allowedDataScopes: readonly string[];
  readonly credentialScopes: readonly string[];
  readonly health: CapabilityHealthState;
  readonly description?: string;
}

export interface CapabilityRequest {
  readonly capabilityId: string;
  readonly version?: string;
}

export interface CapabilityAuthorizationContext {
  readonly planId: string;
  readonly goalAllowedCapabilities: readonly string[];
  readonly goalForbiddenCapabilities: readonly string[];
  readonly goalAllowedDataScopes: readonly string[];
  readonly goalForbiddenDataScopes: readonly string[];
}

export interface AuthorizedCapability {
  readonly definition: CapabilityDefinition;
  readonly requiresConsent: boolean;
}

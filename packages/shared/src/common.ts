// common.ts
declare const brand: unique symbol;

export type Brand<Value, Name extends string> = Value & { readonly [brand]: Name };

export type RequestId = Brand<string, 'RequestId'>;
export type CaseId = Brand<string, 'CaseId'>;
export type EvidenceId = Brand<string, 'EvidenceId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type RelationshipId = Brand<string, 'RelationshipId'>;
export type ClaimId = Brand<string, 'ClaimId'>;
export type ReportId = Brand<string, 'ReportId'>;
export type SkillId = Brand<string, 'SkillId'>;
export type Confidence = Brand<number, 'Confidence'>;
export type IsoDateTime = Brand<string, 'IsoDateTime'>;
export type VerificationStatus = 'hypothesis' | 'supported' | 'verified' | 'rejected';

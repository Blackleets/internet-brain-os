import type { CapabilityRiskLevel } from '../capability/capability-contract';

export const APPROVAL_REQUIREMENTS = ['none', 'policy', 'explicit'] as const;
export type ApprovalRequirement = (typeof APPROVAL_REQUIREMENTS)[number];

export interface CapabilityRiskAssessment {
  readonly capabilityId: string;
  readonly riskLevel: CapabilityRiskLevel;
  readonly approvalRequirement: ApprovalRequirement;
  readonly reasons: readonly string[];
}

export interface PlanRiskAssessment {
  readonly planId: string;
  readonly highestRisk: CapabilityRiskLevel;
  readonly approvalRequirement: ApprovalRequirement;
  readonly capabilities: readonly CapabilityRiskAssessment[];
}

export interface ApprovalReceipt {
  readonly id: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly decision: 'approved' | 'rejected';
  readonly approvedCapabilities: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
}

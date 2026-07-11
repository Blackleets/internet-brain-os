---
objective: Define shared domain types for Phase 0.2
types_introduced:
  - RequestId, CaseId, EvidenceId, EntityId, RelationshipId, ReportId, SkillId
  - Confidence, IsoDateTime, VerificationStatus
  - Case, Evidence, Entity, Relationship, Report, SkillDefinition, SkillInstallation
  - LLMMessage, LLMRequest, LLMResponse
  - EvidenceContentType, ReportFormat, ReportSection
validation_decisions:
  - Confidence is a branded number in [0,1] with createConfidence rejecting invalid values.
  - IsoDateTime is a branded string that must be in canonical UTC ISO-8601 format (exactly three fractional digits).
  - Validation functions throw RangeError for invalid inputs.
test_count: 29 unit tests in validation.test.ts + 1 public API smoke test = 30 total
risks:
  - Evidence content (rawText, summary, contentRef, contentHash) is optional and assumes external storage.
  - LLMRequest/LLMResponse are provider-agnostic; provider-specific options must be handled in adapters.
  - The validation functions are not exhaustive for all possible ISO-8601 edge cases but cover the required use cases.
pr: https://github.com/Blackleets/internet-brain-os/pull/3
next_step: Await review and merge of PR #3. After merge, proceed to Phase 0.3 (Kernel and Case Manager).
phase_0_3_status: Not started.

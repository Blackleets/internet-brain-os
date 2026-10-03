import type { AIInvocation, AISelection } from "../ai/types.ts";

export type PublicReadOk = {
  ok: true;
  url: string;
  title: string;
  sourceHost: string;
  excerpt: string;
  contentHash: string;
  httpStatus: number;
  bytes: number;
  retrievedAt: string;
};

export type PublicReadFail = {
  ok: false;
  status: "BLOCKED" | "FAIL";
  error: string;
  url: string;
};

export type PublicReadResult = PublicReadOk | PublicReadFail;

export type SourceKind =
  | "encyclopedia"
  | "news"
  | "discussion"
  | "research"
  | "official"
  | "market"
  | "general";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  sourceHost: string;
  kind?: SourceKind;
  provider?: string;
};

export type ProviderProbe = {
  name: string;
  status: "ok" | "empty" | "fail" | "blocked";
  hitCount: number;
  error?: string;
  recoverable: boolean;
};

export type DiscoveryReport = {
  queries: string[];
  providers: ProviderProbe[];
  found: number;
  usable: number;
  domains: string[];
  kinds: Partial<Record<SourceKind, number>>;
  extracted?: number;
  readFailures?: string[];
};

export type SearchResult =
  | { ok: true; hits: SearchHit[]; provider: string; discovery?: DiscoveryReport }
  | { ok: false; status: "BLOCKED" | "FAIL"; error: string; discovery?: DiscoveryReport };

export type InterpretedFinding = {
  title: string;
  answer: string;
  whyItMatters: string;
  confidence: "low" | "medium" | "high";
  evidenceIndexes: number[];
  uncertainties: string[];
  nextAction: string;
  memoryRelation?: "novel" | "confirmed" | "tension";
  memoryNote?: string;
};

export type InterpretResult =
  | { ok: true; available: true; findings: InterpretedFinding[]; invocation?: AIInvocation }
  | { ok: true; available: false; reason: string; invocation?: AIInvocation }
  | { ok: false; status: "BLOCKED" | "FAIL"; error: string; invocation?: AIInvocation };

export type ResearchIO = {
  readPublicWeb: (input: { data: { url: string } }) => Promise<PublicReadResult>;
  interpretEvidence: (input: {
    data: {
      goal: string;
      evidence: Array<{ title: string; url: string; excerpt: string }>;
      memory?: Array<{ title: string; why: string }>;
      parentSeal?: {
        goal: string;
        executive: string;
        findings: Array<{ title: string; answer: string }>;
      };
      selection?: AISelection;
    };
  }) => Promise<InterpretResult>;
  searchPublicWeb: (input: { data: { query: string } }) => Promise<SearchResult>;
};

export async function resolveResearchIO(io?: ResearchIO): Promise<ResearchIO> {
  if (io) return io;
  const fns = await import("./functions.ts");
  return {
    readPublicWeb: (input) => fns.readPublicWeb(input) as Promise<PublicReadResult>,
    interpretEvidence: (input) => fns.interpretEvidence(input) as Promise<InterpretResult>,
    searchPublicWeb: (input) => fns.searchPublicWeb(input) as Promise<SearchResult>,
  };
}

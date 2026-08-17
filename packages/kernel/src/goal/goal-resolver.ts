import { UserGoalInterpreter } from './goal-interpreter';
import { GoalPlanner } from './goal-planner';
import type { UserGoal } from './user-goal-contract';
import type { GoalPlan } from './goal-plan-contract';
import type { PublicWebSearchResponse } from '../execution/public-web-search-adapter';

/**
 * Represents a candidate result from a public web search.
 */
export interface Candidate {
  /** Title of the result */
  title: string;
  /** URL of the result */
  url: string;
  /** Domain/source host (e.g., "linkedin.com") */
  domain: string;
  /** Source of the result (e.g., the query that generated it or the provider) */
  source: string;
  /** Context/snippet from the result */
  context: string;
  /** Date when the result was retrieved (ISO string) */
  retrievedAt: string;
  /** Date of publication if available in the result, otherwise null */
  publishedAt: string | null;
  /** List of criterion descriptions that are mentioned in the result */
  criteriaMet: string[];
  /** List of criterion descriptions that are not mentioned in the result */
  criteriaMissing: string[];
  /** Coverage ratio (number of criteria met / total criteria) */
  coverage: number;
  /** Warnings about the result (e.g., missing data, ambiguities) */
  warnings: string[];
  /** State of the candidate relative to the goal: 'partial' (some criteria met), 'no_match' (no criteria met) */
  state: 'partial' | 'no_match';
}

function normalizeMatchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function criterionIsMentioned(description: string, text: string): boolean {
  const normalizedDescription = normalizeMatchText(description);
  const normalizedText = normalizeMatchText(text);
  const numbers = normalizedDescription.match(/\d+/g) ?? [];
  if (numbers.some((number) => !new RegExp(`\\b${number}\\b`).test(normalizedText))) return false;

  const semanticRules = [
    { when: /\b(?:jornada|horas?|hrs?)\b/, match: /\b(?:jornada|horas?|hrs?)\b|\d+\s*h(?:rs?)?/ },
    { when: /\b(?:salario|sueldo)\b/, match: /\b(?:salario|sueldo|paga|euros?|eur)\b|€/ },
    { when: /\b(?:mensual|monthly|mes)\b|al mes/, match: /\b(?:mensual|monthly|mes)\b|al mes/ },
    { when: /\b(?:modalidad|modality)\b/, match: /\b(?:modalidad|remoto|remote|presencial|onsite|hibrido|hybrid)\b/ },
    { when: /\b(?:contrato|contract)\b/, match: /\b(?:contrato|contract|freelance|parcial|part-time|completo|full-time)\b/ },
  ] as const;

  let matchedRule = false;
  for (const rule of semanticRules) {
    if (!rule.when.test(normalizedDescription)) continue;
    matchedRule = true;
    if (!rule.match.test(normalizedText)) return false;
  }
  if (matchedRule) return true;

  const meaningfulWords = normalizedDescription.match(/[a-z0-9]{4,}/g) ?? [];
  return meaningfulWords.some((word) => normalizedText.includes(word));
}

/**
 * Interprets and evaluates a Goal against results that were already returned by
 * an authorized public-web execution. This class deliberately performs no I/O:
 * callers must route every query in the returned plan through the
 * CapabilityRegistry/ExecutionEngine boundary before passing responses here.
 */
export class WebGoalResolver {
  private readonly interpreter: UserGoalInterpreter;
  private readonly planner: GoalPlanner;

  constructor() {
    this.interpreter = new UserGoalInterpreter();
    this.planner = new GoalPlanner();
  }

  plan(goalText: string): { userGoal: UserGoal; plan: GoalPlan } {
    const userGoal: UserGoal = this.interpreter.interpret(goalText);
    return { userGoal, plan: this.planner.createPlan(userGoal) };
  }

  /**
   * Evaluates the given goal text and authorized public-web responses.
   * @param goalText The natural language goal (e.g., "Encuéntrame un trabajo de 20 horas que pague 600 euros al mes")
   * @param responses Results returned by the authorized execution boundary.
   * @returns The candidate list and the overall resolution state.
   */
  resolve(goalText: string, responses: readonly PublicWebSearchResponse[]): { candidates: Candidate[]; resolutionState: 'partial' | 'no_match' } {
    if (!Array.isArray(responses)) throw new TypeError('Authorized public-web responses are required');
    const { userGoal, plan } = this.plan(goalText);

    const allResults: Array<{
      query: string;
      title: string;
      url: string;
      domain: string;
      snippet: string;
      retrievedAt: string;
    }> = [];

    for (const response of responses) {
      for (const result of response.results) {
        allResults.push({
          query: response.query,
          title: result.title,
          url: result.url,
          domain: result.sourceHost,
          snippet: result.snippet,
          retrievedAt: response.searchedAt,
        });
      }
    }

    // Step 4: Deduplicate results by URL (keeping the first occurrence)
    const seenUrls = new Set<string>();
    const uniqueResults = allResults.filter(result => {
      if (seenUrls.has(result.url)) {
        return false;
      }
      seenUrls.add(result.url);
      return true;
    });

    // Step 5: For each unique result, compute which criteria are met
    const criteriaDescriptions = plan.criteria.map(c => c.description);
    const candidates: Candidate[] = [];

    for (const result of uniqueResults) {
      const criteriaMet: string[] = [];
      const criteriaMissing: string[] = [];

      const textToSearch = `${result.title} ${result.snippet}`;

      for (const description of criteriaDescriptions) {
        if (criterionIsMentioned(description, textToSearch)) {
          criteriaMet.push(description);
        } else {
          criteriaMissing.push(description);
        }
      }

      const coverage = criteriaDescriptions.length === 0 ? 0 : criteriaMet.length / criteriaDescriptions.length;

      // Determine candidate state: partial if at least one criterion met, otherwise no_match
      const candidateState: 'partial' | 'no_match' = criteriaMet.length > 0 ? 'partial' : 'no_match';

      // Collect warnings from the plan and user goal
      const warnings: string[] = [
        ...plan.risks,
        ...plan.limits,
        ...userGoal.ambiguities,
        ...userGoal.missingData.map(field => `Missing data: ${field}`),
      ];

      // Attempt to extract a publication date from the snippet (very basic)
      const publishedAt = this.extractDate(result.snippet) ?? null;

      candidates.push({
        title: result.title,
        url: result.url,
        domain: result.domain,
        source: `Query: "${result.query}"`,
        context: result.snippet,
        retrievedAt: result.retrievedAt,
        publishedAt,
        criteriaMet,
        criteriaMissing,
        coverage,
        warnings,
        state: candidateState,
      });
    }

    // Step 6: Determine overall resolution state
    // If we have at least one candidate with state 'partial', then overall is partial.
    // If we have candidates but all are 'no_match', then overall is 'no_match'.
    // If we have no candidates, then overall is 'no_match'.
    let resolutionState: 'partial' | 'no_match' = 'no_match';
    if (candidates.length > 0) {
      if (candidates.some(c => c.state === 'partial')) {
        resolutionState = 'partial';
      } else {
        resolutionState = 'no_match';
      }
    }

    return { candidates, resolutionState };
  }

  /**
   * Attempts to extract a date from a string using a simple regex.
   * Looks for patterns like "dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd".
   * Returns the date in ISO format if found, otherwise null.
   */
  private extractDate(text: string): string | null {
    // Patterns for dates
    const patterns = [
      // yyyy-mm-dd
      /\b(\d{4})-(\d{2})-(\d{2})\b/,
      // dd/mm/yyyy
      /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
      // mm/dd/yyyy
      /\b(\d{2})\/(\d{2})\/(\d{4})\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let year, month, day;
        if (pattern === patterns[0]) {
          // yyyy-mm-dd
          year = match[1];
          month = match[2];
          day = match[3];
        } else if (pattern === patterns[1]) {
          // dd/mm/yyyy
          day = match[1];
          month = match[2];
          year = match[3];
        } else {
          // mm/dd/yyyy (assume pattern[2])
          month = match[1];
          day = match[2];
          year = match[3];
        }
        // Validate ranges (basic)
        if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }

    return null;
  }
}

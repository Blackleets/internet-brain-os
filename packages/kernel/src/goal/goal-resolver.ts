import { UserGoalInterpreter } from './goal-interpreter';
import { UserGoal } from './user-goal-contract';
import { GoalPlanner } from './goal-planner';
import { GoalPlan } from './goal-plan-contract';

/**
 * Port for public web search. Keeps the goal module decoupled from the
 * connectors package (adapters, not domain-layer provider coupling).
 */
export interface GoalWebSearchPort {
  search(query: string, limit?: number): Promise<{
    query: string;
    searchedAt: string;
    provider: string;
    results: ReadonlyArray<{ rank: number; title: string; url: string; snippet: string; sourceHost: string }>;
  }>;
}

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

/**
 * Resolves a goal using public web search only (does not persist Evidence or memory).
 * Suitable for web mode without Kernel persistence.
 */
export class WebGoalResolver {
  private readonly interpreter: UserGoalInterpreter;
  private readonly planner: GoalPlanner;
  private readonly searcher: GoalWebSearchPort;

  constructor(searcher?: GoalWebSearchPort) {
    this.interpreter = new UserGoalInterpreter();
    this.planner = new GoalPlanner();
    if (searcher) {
      this.searcher = searcher;
    } else {
      // Late-bound adapter keeps the connectors package out of the kernel's
      // compile graph; the adapter is wired at composition root (server/CLI).
      throw new Error('WebGoalResolver requires a search port (no default adapter is bundled)');
    }
  }

  /**
   * Resolves the given goal text and returns a list of candidates.
   * @param goalText The natural language goal (e.g., "Encuéntrame un trabajo de 20 horas que pague 600 euros al mes")
   * @returns A promise that resolves to the list of candidates and the overall resolution state
   */
  async resolve(goalText: string): Promise<{ candidates: Candidate[]; resolutionState: 'partial' | 'no_match' }> {
    // Step 1: Interpret the goal
    const userGoal: UserGoal = this.interpreter.interpret(goalText);

    // Step 2: Create a plan
    const plan: GoalPlan = this.planner.createPlan(userGoal);

    // Step 3: Execute each query in the plan and collect results
    const allResults: Array<{
      query: string;
      title: string;
      url: string;
      domain: string;
      snippet: string;
      retrievedAt: string;
    }> = [];

    for (const query of plan.queries) {
      try {
        const response = await this.searcher.search(query, 10); // limit to 10 results per query
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
      } catch (error) {
        // If a query fails, we log it as a warning but continue with other queries
        // We could also collect errors and include them in warnings, but for simplicity we skip.
        console.warn(`Failed to execute query "${query}":`, error);
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

      const textToSearch = `${result.title} ${result.snippet}`.toLowerCase();

      for (const description of criteriaDescriptions) {
        // Token-overlap matching: a criterion is met when its significant tokens
        // (numbers, currency, keywords) all appear in the result text. Plain
        // substring matching is too brittle for natural-language descriptions.
        if (criterionTokensMatch(description, textToSearch)) {
          criteriaMet.push(description);
        } else {
          criteriaMissing.push(description);
        }
      }

      const coverage = criteriaMet.length / criteriaDescriptions.length;

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

const STOP_WORDS = new Set([
  'de', 'un', 'una', 'la', 'el', 'los', 'las', 'del', 'al', 'a', 'en', 'y', 'o',
  'jornada', 'salario', 'tipo', 'contrato', 'ubicación', 'modalidad'
]);

/**
 * Token-overlap criterion matching: every significant token of the criterion
 * description (numbers, currency codes, keywords) must appear in the result
 * text. More robust than raw substring equality for natural-language text.
 */
export function criterionTokensMatch(description: string, lowerText: string): boolean {
  const tokens = description
    .toLowerCase()
    .split(/[^0-9a-záéíóúñü€]+/i)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  if (tokens.length === 0) return false;
  return tokens.every((token) => lowerText.includes(token));
}
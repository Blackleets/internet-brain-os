export interface UserGoal {
  /** The original title as provided by the user */
  originalTitle: string;
  /** The interpreted intent (canonical English: "find", "want", "need") */
  intent: string;
  /** The original action verb detected in the source language (e.g., "encontrar", "buscar") */
  intentVerb?: string;
  /** The category of the goal (e.g., "trabajo", "investigación", "compra") */
  category: string;
  /** Constraints extracted from the goal */
  constraints: UserGoalConstraints;
  /** User preferences (e.g., ["remote", "freelance"]) */
  preferences: string[];
  /** Data that could not be determined from the goal */
  missingData: string[];
  /** Ambiguities in the interpretation (e.g., "hours per week or month?") */
  ambiguities: string[];
}

export interface UserGoalConstraints {
  /** Number of hours (e.g., 20) */
  hours?: number;
  /** Salary amount (e.g., 600) */
  salary?: number;
  /** Currency code (e.g., "EUR", "USD") */
  currency?: string;
  /** Frequency of the salary (e.g., "monthly", "weekly", "hourly") */
  frequency?: string;
  /** Location (e.g., "Madrid", "remote") */
  location?: string;
  /** Modality (e.g., "remote", "onsite", "hybrid") */
  modality?: string;
  /** Type of contract (e.g., "part-time", "freelance", "full-time") */
  contractType?: string;
}
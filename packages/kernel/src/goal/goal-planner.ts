import { UserGoal, UserGoalConstraints } from './user-goal-contract';
import { GoalPlan, GoalCriterion, GoalPlanState } from './goal-plan-contract';

/**
 * Creates a plan for achieving a goal based on the interpreted user goal.
 */
export class GoalPlanner {
  /**
   * Creates a plan for the given user goal.
   * @param userGoal The interpreted user goal
   * @returns A goal plan that can be executed
   */
  createPlan(userGoal: UserGoal): GoalPlan {
    const plan: GoalPlan = {
      userGoal,
      interpretation: this.createInterpretation(userGoal),
      criteria: this.createCriteria(userGoal),
      queries: this.createQueries(userGoal),
      sources: this.createSources(userGoal),
      capabilities: this.createCapabilities(userGoal),
      risks: this.createRisks(userGoal),
      limits: this.createLimits(userGoal),
      state: 'draft',
      nextAction: 'Execute discovery queries'
    };

    return plan;
  }

  /**
   * Creates a human-readable interpretation of the goal.
   */
  private createInterpretation(userGoal: UserGoal): string {
    const { intent, category, constraints, preferences } = userGoal;

    // Map intent to appropriate Spanish infinitive verb
    let spanishVerb: string;
    switch (intent) {
      case 'find':
        spanishVerb = 'encontrar';
        break;
      case 'want':
        spanishVerb = 'querer';
        break;
      default:
        // Fallback to the intent itself (should not happen with current interpreter)
        spanishVerb = intent;
    }

    let interpretation = `${spanishVerb} un ${category}`;

    // Add constraints
    const constraintParts: string[] = [];
    if (constraints.hours) {
      constraintParts.push(`${constraints.hours} horas`);
    }
    if (constraints.salary && constraints.currency && constraints.frequency) {
      constraintParts.push(`${constraints.salary} ${constraints.currency} ${constraints.frequency}`);
    } else if (constraints.salary && constraints.currency) {
      constraintParts.push(`${constraints.salary} ${constraints.currency}`);
    }
    if (constraints.location) {
      constraintParts.push(`en ${constraints.location}`);
    }
    if (constraints.modality) {
      constraintParts.push(`modalidad ${constraints.modality}`);
    }
    if (constraints.contractType) {
      constraintParts.push(`tipo de contrato ${constraints.contractType}`);
    }

    if (constraintParts.length > 0) {
      interpretation += ` con ${constraintParts.join(' y ')}`;
    }

    // Add preferences
    if (preferences.length > 0) {
      interpretation += `, preferiendo ${preferences.join(', ')}`;
    }

    return interpretation;
  }

  /**
   * Creates the criteria that must be satisfied for the goal to be considered met.
   */
  private createCriteria(userGoal: UserGoal): GoalCriterion[] {
    const criteria: GoalCriterion[] = [];
    const { constraints } = userGoal;

    // Hours criterion
    if (constraints.hours !== undefined) {
      criteria.push({
        description: `Jornada de ${constraints.hours} horas`,
        confirmed: false
      });
    }

    // Salary criterion
    if (constraints.salary !== undefined && constraints.currency !== undefined && constraints.frequency !== undefined) {
      criteria.push({
        description: `Salario de ${constraints.salary} ${constraints.currency} ${constraints.frequency}`,
        confirmed: false
      });
    } else if (constraints.salary !== undefined && constraints.currency !== undefined) {
      criteria.push({
        description: `Salario de ${constraints.salary} ${constraints.currency}`,
        confirmed: false
      });
    }

    // Location criterion
    if (constraints.location !== undefined) {
      criteria.push({
        description: `Ubicación: ${constraints.location}`,
        confirmed: false
      });
    }

    // Modality criterion
    if (constraints.modality !== undefined) {
      criteria.push({
        description: `Modalidad: ${constraints.modality}`,
        confirmed: false
      });
    }

    // Contract type criterion
    if (constraints.contractType !== undefined) {
      criteria.push({
        description: `Tipo de contrato: ${constraints.contractType}`,
        confirmed: false
      });
    }

    return criteria;
  }

  /**
   * Creates the queries that should be executed to gather information.
   */
  private createQueries(userGoal: UserGoal): string[] {
    const queries: string[] = [];
    const { constraints, category } = userGoal;

    // Base query: category + constraints
    let baseQuery = category;

    if (constraints.hours !== undefined) {
      baseQuery += ` ${constraints.hours} horas`;
    }

    if (constraints.salary !== undefined && constraints.currency !== undefined) {
      baseQuery += ` ${constraints.salary} ${constraints.currency}`;
    }

    // Add variations for different ways of expressing the same thing
    if (constraints.hours !== undefined) {
      queries.push(`${baseQuery}`);
      queries.push(`${category} ${constraints.hours}h`);
      queries.push(`${category} ${constraints.hours}hrs`);

      // Media jornada variations
      if (constraints.hours === 20) { // Assuming 20 hours is media jornada
        queries.push(`${category} media jornada`);
        queries.push(`${category} jornada parcial`);
        queries.push(`${category} medio tiempo`);
      }
    }

    // Salary variations
    if (constraints.salary !== undefined && constraints.currency !== undefined) {
      // Already added in baseQuery, but add symbolic variations
      queries.push(`${category} ${constraints.salary}€`);
      queries.push(`${category} ${constraints.salary} EUR`);

      if (constraints.frequency === 'monthly') {
        queries.push(`${category} ${constraints.salary} al mes`);
        queries.push(`${category} ${constraints.salary} mensual`);
      } else if (constraints.frequency === 'weekly') {
        queries.push(`${category} ${constraints.salary} por semana`);
        queries.push(`${category} ${constraints.salary} semanal`);
      } else if (constraints.frequency === 'hourly') {
        queries.push(`${category} ${constraints.salary} por hora`);
        queries.push(`${category} ${constraints.salary} horario`);
      }
    }

    // Location variations
    if (constraints.location !== undefined) {
      queries.push(`${category} en ${constraints.location}`);
      queries.push(`${category} ${constraints.location}`);
    }

    // Modality variations
    if (constraints.modality !== undefined) {
      queries.push(`${category} ${constraints.modality}`);
      if (constraints.modality === 'remote') {
        queries.push(`${category} remoto`);
        queries.push(`${category} trabajo desde casa`);
      }
    }

    // Contract type variations
    if (constraints.contractType !== undefined) {
      queries.push(`${category} ${constraints.contractType}`);
      if (constraints.contractType === 'part-time') {
        queries.push(`${category} tiempo parcial`);
        queries.push(`${category} medio tiempo`);
      } else if (constraints.contractType === 'full-time') {
        queries.push(`${category} tiempo completo`);
      } else if (constraints.contractType === 'freelance') {
        queries.push(`${category} freelance`);
        queries.push(`${category} autónomo`);
      }
    }

    // Remove duplicates and limit to reasonable number
    const uniqueQueries = Array.from(new Set(queries));
    return uniqueQueries.slice(0, 10); // Limit to 10 queries to avoid too many requests
  }

  /**
   * Creates the sources that are allowed or preferred for gathering information.
   */
  private createSources(userGoal: UserGoal): string[] {
    // For now, we'll allow general job search sites
    // In a real implementation, this would be configurable
    return [
      'LinkedIn',
      'Indeed',
      'InfoJobs',
      'Glassdoor',
      'Google'
    ];
  }

  /**
   * Creates the capabilities that are required or allowed for executing the plan.
   */
  private createCapabilities(userGoal: UserGoal): string[] {
    // For job search, we need web search capabilities
    return ['public_web_research'];
  }

  /**
   * Creates the risks associated with executing this plan.
   */
  private createRisks(userGoal: UserGoal): string[] {
    return [
      'Los resultados pueden no ser precisos o estar desactualizados',
      'Algunas fuentes pueden requerir registro o pago para acceder a información completa',
      'Los datos salariales pueden variar según experiencia y ubicación exacta',
      'Puede haber múltiples interpretaciones de términos como "media jornada"'
    ];
  }

  /**
   * Creates any limits or constraints on the plan (e.g., time, budget).
   */
  private createLimits(userGoal: UserGoal): string[] {
    const limits: string[] = [];

    // Add any explicit constraints from the user goal as limits
    if (userGoal.constraints.hours !== undefined) {
      limits.push(`Máximo ${userGoal.constraints.hours} horas por semana`);
    }

    // We don't have a budget constraint in the user goal, but we could add one
    // if the user specified a maximum salary they're willing to accept

    // Time limit for the search (e.g., don't spend more than 1 hour searching)
    limits.push('Búsqueda limitada a 30 minutos');

    return limits;
  }
}
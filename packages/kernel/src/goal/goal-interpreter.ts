import { UserGoal, UserGoalConstraints } from './user-goal-contract';

/**
 * Interprets a natural language goal into a structured UserGoal.
 */
export class UserGoalInterpreter {
  /**
   * Parses the given goal text and returns a UserGoal.
   * @param text The natural language goal (e.g., "Encuéntrame un trabajo de 20 horas que pague 600 euros al mes")
   * @returns A structured UserGoal
   */
  interpret(text: string): UserGoal {
    const lowerText = text.toLowerCase();

    // Extract constraints
    const constraints: UserGoalConstraints = {};

    // Hours: look for patterns like "20 horas", "20h", "20hrs", "media jornada"
    const hoursMatch = lowerText.match(/(\d+)\s*(?:horas?|h|hrs?)/);
    if (hoursMatch) {
      constraints.hours = parseInt(hoursMatch[1], 10);
    } else if (lowerText.includes('media jornada') || lowerText.includes('jornada parcial')) {
      // Assume media jornada is 20 hours per week? We'll leave it null and let the planner handle it.
      // But we can set a default? We'll not set hours and let the planner know it's ambiguous.
    }

    // Salary: look for patterns like "600 euros", "600€", "600 EUR", "600 al mes"
    const salaryMatch = lowerText.match(/(\d+)\s*(?:euros?|€|eur)/);
    if (salaryMatch) {
      constraints.salary = parseInt(salaryMatch[1], 10);
      constraints.currency = 'EUR';
    }

    // Frequency: look for "al mes", "mensual", "por semana", "semanal", "por hora", "horario"
    if (lowerText.includes('al mes') || lowerText.includes('mensual')) {
      constraints.frequency = 'monthly';
    } else if (lowerText.includes('por semana') || lowerText.includes('semanal')) {
      constraints.frequency = 'weekly';
    } else if (lowerText.includes('por hora') || lowerText.includes('horario')) {
      constraints.frequency = 'hourly';
    }

    // Category: we assume "trabajo" or "empleo" or "trabajo" is the category for job search.
    // We can look for keywords: trabajo, empleo, vacante, puesto, trabajo.
    const categoryKeywords = ['trabajo', 'empleo', 'vacante', 'puesto'];
    const foundCategory = categoryKeywords.find(keyword => lowerText.includes(keyword));
    let category = 'trabajo'; // default
    if (foundCategory) {
      category = foundCategory;
    }

    // Intent: we can derive from the category and the action verb.
    // The action verb is usually at the beginning: "Encuéntrame", "Busco", "Quiero", etc.
    // Verbs are normalized to canonical English intents so downstream consumers
    // (planner, resolver) share one stable vocabulary; the planner renders them
    // back to Spanish for human-readable output.
    const verbMap: Record<string, string> = {
      'encuéntrame': 'find',
      'encontrar': 'find',
      'busco': 'find',
      'buscar': 'find',
      'quiero': 'want',
      'necesito': 'need'
    };
    const intentMatch = lowerText.match(/^(encuéntrame|encontrar|busco|buscar|quiero|necesito)\s+/i);
    let intent = 'find'; // fallback to a safe default
    let intentVerb: string | undefined;
    if (intentMatch) {
      const verb = intentMatch[1].toLowerCase();
      intentVerb = verbMap[verb] ?? verb; // canonical intent
      intent = intentVerb;
    }
    // Preserve the source-language verb for human-readable rendering downstream.
    const spanishVerbs: Record<string, string> = {
      'encuéntrame': 'encontrar',
      'encontrar': 'encontrar',
      'busco': 'buscar',
      'buscar': 'buscar',
      'quiero': 'querer',
      'necesito': 'necesitar'
    };
    const sourceVerb = intentMatch ? spanishVerbs[intentMatch[1].toLowerCase()] : undefined;

    // Preferences: look for words like "remoto", "presencial", "híbrido"
    // Note: contract-related words like "freelance", "contrato", "tiempo parcial", "tiempo completo" 
    // go to contractType, not preferences
    const preferences: string[] = [];
    const preferenceKeywords = [
      { keyword: 'remoto', value: 'remote' },
      { keyword: 'presencial', value: 'onsite' },
      { keyword: 'híbrido', value: 'hybrid' }
    ];
    for (const { keyword, value } of preferenceKeywords) {
      if (lowerText.includes(keyword)) {
        preferences.push(value);
      }
    }

    // Location: we don't have a location in the example, but we can look for "en [location]" or "en [city]"
    // We'll leave it empty for now.

    // Contract type: we can infer from keywords like "part-time", "full-time", "freelance", "contract"
    const contractTypeKeywords = [
      { keyword: 'tiempo parcial', value: 'part-time' },
      { keyword: 'tiempo completo', value: 'full-time' },
      { keyword: 'freelance', value: 'freelance' },
      { keyword: 'contrato', value: 'contract' }
    ];
    let contractType: string | undefined;
    for (const { keyword, value } of contractTypeKeywords) {
      if (lowerText.includes(keyword)) {
        contractType = value;
        break;
      }
    }
    if (contractType) {
      constraints.contractType = contractType;
    }

    // Missing data: we can list what we didn't find.
    const missingData: string[] = [];
    if (!constraints.hours) missingData.push('hours');
    if (!constraints.salary) missingData.push('salary');
    if (!constraints.frequency) missingData.push('frequency');
    if (!constraints.location) missingData.push('location');
    if (!constraints.modality) missingData.push('modality');
    if (!constraints.contractType) missingData.push('contractType');

    // Ambiguities: we can note ambiguities in the interpretation.
    const ambiguities: string[] = [];
    if (lowerText.includes('media jornada') || lowerText.includes('jornada parcial')) {
      ambiguities.push('The term "media jornada" or "jornada parcial" may refer to different hour counts depending on the country or company.');
    }
    if (lowerText.includes('al mes') && !constraints.frequency) {
      ambiguities.push('The frequency "al mes" is assumed to be monthly, but could be interpreted differently.');
    }

    return {
      originalTitle: text,
      intent,
      intentVerb: sourceVerb,
      category,
      constraints,
      preferences,
      missingData,
      ambiguities
    };
  }
}
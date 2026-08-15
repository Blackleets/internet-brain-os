import { describe, it, expect, beforeEach } from 'vitest';
import { GoalPlanner } from './goal-planner';
import { UserGoalInterpreter } from './goal-interpreter';
import { UserGoal } from './user-goal-contract';
import { GoalPlan } from './goal-plan-contract';

describe('GoalPlanner', () => {
  let planner: GoalPlanner;
  let interpreter: UserGoalInterpreter;

  beforeEach(() => {
    planner = new GoalPlanner();
    interpreter = new UserGoalInterpreter();
  });

  it('should create a plan for a job goal with hours and salary', () => {
    const text = 'Encuéntrame un trabajo de 20 horas que pague 600 euros al mes';
    const userGoal: UserGoal = interpreter.interpret(text);
    const plan: GoalPlan = planner.createPlan(userGoal);

    expect(plan.userGoal).toEqual(userGoal);
    expect(plan.interpretation).toContain('encontrar un trabajo');
    expect(plan.interpretation).toContain('20 horas');
    expect(plan.interpretation).toContain('600 EUR');
    expect(plan.interpretation).toContain('mensual');
    
    // Check criteria
    expect(plan.criteria.length).toBeGreaterThan(0);
    const hoursCriterion = plan.criteria.find(c => c.description.includes('Jornada de 20 horas'));
    expect(hoursCriterion).toBeDefined();
    expect(hoursCriterion?.confirmed).toBe(false);
    
    const salaryCriterion = plan.criteria.find(c => c.description.includes('Salario de 600 EUR'));
    expect(salaryCriterion).toBeDefined();
    expect(salaryCriterion?.confirmed).toBe(false);
    
    // Check queries
    expect(Array.isArray(plan.queries)).toBe(true);
    expect(plan.queries.length).toBeGreaterThan(0);
    expect(plan.queries.some(q => q.includes('trabajo 20 horas'))).toBe(true);
    expect(plan.queries.some(q => q.includes('trabajo 20h'))).toBe(true);
    expect(plan.queries.some(q => q.includes('trabajo 600 euros'))).toBe(true);
    expect(plan.queries.some(q => q.includes('trabajo 600 EUR'))).toBe(true);
    
    // Check sources
    expect(Array.isArray(plan.sources)).toBe(true);
    expect(plan.sources).toContain('LinkedIn');
    expect(plan.sources).toContain('Indeed');
    
    // Check capabilities
    expect(Array.isArray(plan.capabilities)).toBe(true);
    expect(plan.capabilities).toContain('public_web_research');
    
    // Check risks
    expect(Array.isArray(plan.risks)).toBe(true);
    expect(plan.risks.length).toBeGreaterThan(0);
    
    // Check limits
    expect(Array.isArray(plan.limits)).toBe(true);
    expect(plan.limits.length).toBeGreaterThan(0);
    expect(plan.limits.some(l => l.includes('Máximo 20 horas'))).toBe(true);
    expect(plan.limits.some(l => l.includes('Búsqueda limitada'))).toBe(true);
    
    // Check state
    expect(plan.state).toBe('draft');
    
    // Check next action
    expect(plan.nextAction).toBe('Execute discovery queries');
  });

  it('should create a plan for a goal with media jornada', () => {
    const text = 'Busco empleo media jornada 600 euros';
    const userGoal: UserGoal = interpreter.interpret(text);
    const plan: GoalPlan = planner.createPlan(userGoal);

    expect(plan.userGoal).toEqual(userGoal);
    expect(plan.interpretation).toContain('buscar un empleo');
    // Note: media jornada doesn't set hours, so interpretation won't have hours
    
    // Check criteria - hours should not be present since we didn't detect it
    const hoursCriterion = plan.criteria.find(c => c.description.includes('Jornada de'));
    // We might not have hours criterion since we didn't set it in constraints
    // But we should have salary criterion
    const salaryCriterion = plan.criteria.find(c => c.description.includes('Salario de 600 EUR'));
    expect(salaryCriterion).toBeDefined();
    expect(salaryCriterion?.confirmed).toBe(false);
    
    // Check queries - should include media jornada variations
    expect(plan.queries.some(q => q.includes('empleo media jornada'))).toBe(true);
    expect(plan.queries.some(q => q.includes('empleo jornada parcial'))).toBe(true);
  });

  it('should create a plan for a goal with remote preference', () => {
    const text = 'Quiero trabajo remoto de 20 horas que pague 600 euros al mes';
    const userGoal: UserGoal = interpreter.interpret(text);
    const plan: GoalPlan = planner.createPlan(userGoal);

    expect(plan.userGoal).toEqual(userGoal);
    expect(plan.interpretation).toContain('querer un trabajo');
    expect(plan.interpretation).toContain('20 horas');
    expect(plan.interpretation).toContain('600 EUR');
    expect(plan.interpretation).toContain('mensual');
    expect(plan.interpretation).toContain('preferiendo remote');
    
    // Check criteria
    const hoursCriterion = plan.criteria.find(c => c.description.includes('Jornada de 20 horas'));
    expect(hoursCriterion).toBeDefined();
    expect(hoursCriterion?.confirmed).toBe(false);
    
    // Check queries - should include remote variations
    expect(plan.queries.some(q => q.includes('trabajo remoto'))).toBe(true);
    expect(plan.queries.some(q => q.includes('trabajo desde casa'))).toBe(true);
  });

  it('should create a plan for a goal with freelance contract type', () => {
    const text = 'Busco trabajo freelance 20 horas 600 euros al mes';
    const userGoal: UserGoal = interpreter.interpret(text);
    const plan: GoalPlan = planner.createPlan(userGoal);

    expect(plan.userGoal).toEqual(userGoal);
    expect(plan.interpretation).toContain('encontrar un trabajo');
    expect(plan.interpretation).toContain('20 horas');
    expect(plan.interpretation).toContain('600 EUR');
    expect(plan.interpretation).toContain('mensual');
    
    // Check criteria - should have contract type
    const contractCriterion = plan.criteria.find(c => c.description.includes('Tipo de contrato: freelance'));
    expect(contractCriterion).toBeDefined();
    expect(contractCriterion?.confirmed).toBe(false);
    
    // Check queries - should include freelance variations
    expect(plan.queries.some(q => q.includes('trabajo freelance'))).toBe(true);
    expect(plan.queries.some(q => q.includes('trabajo autónomo'))).toBe(true);
  });

  it('should create a plan for a goal with hourly frequency', () => {
    const text = 'Encuéntrame trabajo de 20 horas a 30 euros por hora';
    const userGoal: UserGoal = interpreter.interpret(text);
    const plan: GoalPlan = planner.createPlan(userGoal);

    expect(plan.userGoal).toEqual(userGoal);
    expect(plan.interpretation).toContain('encontrar un trabajo');
    expect(plan.interpretation).toContain('20 horas');
    expect(plan.interpretation).toContain('30 EUR');
    expect(plan.interpretation).toContain('horario');
    
    // Check criteria
    const hoursCriterion = plan.criteria.find(c => c.description.includes('Jornada de 20 horas'));
    expect(hoursCriterion).toBeDefined();
    expect(hoursCriterion?.confirmed).toBe(false);
    
    const salaryCriterion = plan.criteria.find(c => c.description.includes('Salario de 30 EUR'));
    expect(salaryCriterion).toBeDefined();
    expect(salaryCriterion?.confirmed).toBe(false);
    
    // Check queries - should include hourly variations
    expect(plan.queries.some(q => q.includes('trabajo 30 euros por hora'))).toBe(true);
    expect(plan.queries.some(q => q.includes('trabajo 30 EUR horario'))).toBe(true);
  });
});
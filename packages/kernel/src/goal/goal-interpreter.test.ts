import { describe, it, expect, beforeEach } from 'vitest';
import { UserGoalInterpreter } from './goal-interpreter';
import { UserGoal } from './user-goal-contract';

describe('UserGoalInterpreter', () => {
  let interpreter: UserGoalInterpreter;

  beforeEach(() => {
    interpreter = new UserGoalInterpreter();
  });

  it('should interpret a job goal with hours and salary', () => {
    const text = 'Encuéntrame un trabajo de 20 horas que pague 600 euros al mes';
    const result: UserGoal = interpreter.interpret(text);

    expect(result.originalTitle).toBe(text);
    expect(result.intent).toBe('find');
    expect(result.category).toBe('trabajo');
    expect(result.constraints.hours).toBe(20);
    expect(result.constraints.salary).toBe(600);
    expect(result.constraints.currency).toBe('EUR');
    expect(result.constraints.frequency).toBe('monthly');
    // We expect location, modality, contractType to be undefined (not set)
    expect(result.constraints.location).toBeUndefined();
    expect(result.constraints.modality).toBeUndefined();
    expect(result.constraints.contractType).toBeUndefined();
    // Preferences: we didn't specify any, so empty array
    expect(result.preferences).toEqual([]);
    // Missing data: we expect location, modality, contractType to be missing
    expect(result.missingData).toEqual(expect.arrayContaining(['location', 'modality', 'contractType']));
    // Ambiguities: we expect an ambiguity about media jornada? Not in this text.
    // But note: we didn't have media jornada, so we don't expect that ambiguity.
    // However, we might have an ambiguity about the frequency? We set it to monthly from 'al mes', so no ambiguity.
    // We'll just check that ambiguities is an array.
    expect(Array.isArray(result.ambiguities)).toBe(true);
  });

  it('should interpret a goal with media jornada', () => {
    const text = 'Busco empleo media jornada 600 euros';
    const result: UserGoal = interpreter.interpret(text);

    expect(result.originalTitle).toBe(text);
    expect(result.intent).toBe('find');
    expect(result.category).toBe('empleo');
    // Hours: we don't set hours for media jornada, so it should be undefined
    expect(result.constraints.hours).toBeUndefined();
    expect(result.constraints.salary).toBe(600);
    expect(result.constraints.currency).toBe('EUR');
    // Frequency: we don't have explicit frequency, so undefined
    expect(result.constraints.frequency).toBeUndefined();
    // Preferences: none
    expect(result.preferences).toEqual([]);
    // Missing data: we expect hours, frequency, location, modality, contractType
    expect(result.missingData).toEqual(expect.arrayContaining(['hours', 'frequency', 'location', 'modality', 'contractType']));
    // Ambiguities: we expect an ambiguity about media jornada
    expect(result.ambiguities).toEqual(expect.arrayContaining([
      expect.stringContaining('media jornada')
    ]));
  });

  it('should interpret a goal with remote preference', () => {
    const text = 'Quiero trabajo remoto de 20 horas que pague 600 euros al mes';
    const result: UserGoal = interpreter.interpret(text);

    expect(result.originalTitle).toBe(text);
    expect(result.intent).toBe('want');
    expect(result.category).toBe('trabajo');
    expect(result.constraints.hours).toBe(20);
    expect(result.constraints.salary).toBe(600);
    expect(result.constraints.currency).toBe('EUR');
    expect(result.constraints.frequency).toBe('monthly');
    // Preferences: should include 'remote'
    expect(result.preferences).toEqual(expect.arrayContaining(['remote']));
    // Missing data: location, modality, contractType (but note: we have remote preference, which might imply modality? We don't set modality from preference.)
    expect(result.missingData).toEqual(expect.arrayContaining(['location', 'modality', 'contractType']));
  });

  it('should interpret a goal with freelance contract type', () => {
    const text = 'Busco trabajo freelance 20 horas 600 euros al mes';
    const result: UserGoal = interpreter.interpret(text);

    expect(result.originalTitle).toBe(text);
    expect(result.intent).toBe('find');
    expect(result.category).toBe('trabajo');
    expect(result.constraints.hours).toBe(20);
    expect(result.constraints.salary).toBe(600);
    expect(result.constraints.currency).toBe('EUR');
    expect(result.constraints.frequency).toBe('monthly');
    // Contract type: should be freelance
    expect(result.constraints.contractType).toBe('freelance');
    // Preferences: none? We didn't add freelance to preferences, but we did set contractType.
    // We don't set preferences for contract type, so preferences should be empty.
    expect(result.preferences).toEqual([]);
    // Missing data: location, modality
    expect(result.missingData).toEqual(expect.arrayContaining(['location', 'modality']));
  });

  it('should interpret a goal with hourly frequency', () => {
    const text = 'Encuéntrame trabajo de 20 horas a 30 euros por hora';
    const result: UserGoal = interpreter.interpret(text);

    expect(result.originalTitle).toBe(text);
    expect(result.intent).toBe('find');
    expect(result.category).toBe('trabajo');
    expect(result.constraints.hours).toBe(20);
    expect(result.constraints.salary).toBe(30);
    expect(result.constraints.currency).toBe('EUR');
    expect(result.constraints.frequency).toBe('hourly');
    // Missing data: location, modality, contractType
    expect(result.missingData).toEqual(expect.arrayContaining(['location', 'modality', 'contractType']));
  });
});
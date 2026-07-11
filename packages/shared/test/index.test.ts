import { describe, expect, test } from 'vitest';
import { 
  Case, 
  Evidence, 
  Report, 
  SkillDefinition, 
  LLMRequest,
  createConfidence
} from '../src/index';

describe('Public API smoke test', () => {
  test('exports are defined', () => {
    expect(Case).toBeDefined();
    expect(Evidence).toBeDefined();
    expect(Report).toBeDefined();
    expect(SkillDefinition).toBeDefined();
    expect(LLMRequest).toBeDefined();
    expect(createConfidence).toBeDefined();
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell = readFileSync(new URL('../apps/dashboard/components/efesto-product-shell.tsx', import.meta.url), 'utf8');
const goals = readFileSync(new URL('../apps/local-kernel/goals.mjs', import.meta.url), 'utf8');
const enrichment = readFileSync(new URL('../apps/local-kernel/goal-intent-enrichment.mjs', import.meta.url), 'utf8');

describe('G5.4 one-line Goal intent contract', () => {
  it('keeps the active Home submission simple instead of adding category/price controls', () => {
    expect(shell).toContain("body: JSON.stringify({ title: preparedGoal, keywords: keywordsFromGoal(preparedGoal), priority: 2 })");
    expect(shell).not.toContain('name="categories"');
    expect(shell).not.toContain('name="location"');
  });

  it('makes the Kernel the owner of deterministic Goal intent enrichment', () => {
    expect(goals).toContain("import { enrichGoalIntent, GOAL_CATEGORIES } from './goal-intent-enrichment.mjs';");
    expect(goals).toContain('const intent = enrichGoalIntent({ title, categories: suppliedCategories, keywords: suppliedKeywords, keywordLimit: 12 });');
    expect(enrichment).toContain('MAX_INFERRED_CATEGORIES = 4');
    expect(enrichment).toContain('extractNumericGoalKeywords');
  });

  it('preserves explicit category authority and never infers unsupported action capabilities', () => {
    expect(enrichment).toContain("'job', 'grant', 'client', 'offer', 'tool', 'food', 'aid', 'learning'");
    expect(enrichment).not.toContain("'purchase'");
    expect(enrichment).not.toContain("'payment'");
    expect(enrichment).not.toContain("'login'");
  });
});

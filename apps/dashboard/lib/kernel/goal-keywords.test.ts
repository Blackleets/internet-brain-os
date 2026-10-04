import { describe, expect, it } from 'vitest';
import { keywordsFromGoal } from './goal-keywords';

describe('keywordsFromGoal', () => {
  it('drops the stopwords the Kernel ignores and keeps the subject words in order', () => {
    // Lewis's real rider Goal line: before this, "quiero" was stored as a Mission keyword.
    expect(keywordsFromGoal('quiero budcar empleo de ryder o delivery en españa')).toEqual(['budcar', 'empleo', 'ryder', 'delivery', 'españa']);
    expect(keywordsFromGoal('Busca empleo en Mercadona')).toEqual(['empleo', 'mercadona']);
    expect(keywordsFromGoal('Rust lifetimes explained')).toEqual(['rust', 'lifetimes']);
  });

  it('de-duplicates and caps at eight keywords', () => {
    expect(keywordsFromGoal('rust rust RUST')).toEqual(['rust']);
    expect(keywordsFromGoal('quiero esto')).toEqual(['quiero', 'esto']);
    expect(keywordsFromGoal('uno dos tres cuatro cinco seis siete ocho nueve diez once')).toHaveLength(8);
  });
});

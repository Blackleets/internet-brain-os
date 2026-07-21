import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import * as kernel from '../src';

const packageRoot = resolve(process.cwd(), 'packages/kernel');
const kernelRuntime = kernel as Record<string, unknown>;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('kernel runtime package contract', () => {
  test('does not declare a JavaScript runtime main while configured for declaration-only emit', () => {
    const packageJson = readJson(resolve(packageRoot, 'package.json'));
    const tsconfig = readJson(resolve(packageRoot, 'tsconfig.json'));
    const compilerOptions = tsconfig.compilerOptions as Record<string, unknown> | undefined;

    expect(packageJson.main).toBe('dist/index.js');
    expect(compilerOptions?.emitDeclarationOnly).not.toBe(true);
    expect(compilerOptions?.module).toBe('CommonJS');
  });

  test('root entrypoint exports every public runtime contract from public-api', () => {
    expect(kernelRuntime.ClaimManager).toBeTypeOf('function');
    expect(kernelRuntime.ClaimExtractionEngine).toBeTypeOf('function');
    expect(kernelRuntime.fingerprintEvidence).toBeTypeOf('function');
    expect(kernelRuntime.KnowledgeGraph).toBeTypeOf('function');
    expect(kernelRuntime.validateKnowledgeGraph).toBeTypeOf('function');
    expect(kernelRuntime.ClaimKnowledgeProjector).toBeTypeOf('function');
    expect(kernelRuntime.MockLLMAdapter).toBeTypeOf('function');
    expect(kernelRuntime.runResearchQualityGate).toBeTypeOf('function');
    expect(kernelRuntime.validateResearchOutput).toBeTypeOf('function');
  });
});

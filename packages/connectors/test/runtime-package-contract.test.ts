import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('@internet-brain-os/connectors runtime package contract', () => {
  it('emits a private CommonJS runtime for local-kernel use', () => {
    const packageJson = JSON.parse(readFileSync(resolve('packages/connectors/package.json'), 'utf8'));
    const tsconfig = JSON.parse(readFileSync(resolve('packages/connectors/tsconfig.json'), 'utf8'));
    expect(packageJson.private).toBe(true);
    expect(packageJson.main).toBe('dist/index.js');
    expect(packageJson.types).toBe('dist/index.d.ts');
    expect(packageJson.exports['.'].require).toBe('./dist/index.js');
    expect(tsconfig.compilerOptions.emitDeclarationOnly).toBe(false);
    expect(tsconfig.compilerOptions.module).toBe('CommonJS');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('Node');
  });
});

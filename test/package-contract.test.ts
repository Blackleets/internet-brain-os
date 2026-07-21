import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

interface PackageJson {
  readonly name?: string;
  readonly private?: boolean;
  readonly main?: string;
  readonly types?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

const workspaceRoot = process.cwd();

function readJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson;
}

function workspacePackageJsonPaths(): string[] {
  const roots = ['packages', 'apps'];
  return roots.flatMap((root) => {
    const rootPath = join(workspaceRoot, root);
    return readdirSync(rootPath)
      .map((name) => join(rootPath, name, 'package.json'))
      .filter((path) => existsSync(path));
  });
}

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('workspace package contract', () => {
  test('non-private workspace packages declare both runtime and declaration entrypoints', () => {
    const publicPackages = workspacePackageJsonPaths()
      .map((path) => ({ path, packageJson: readJson(path) }))
      .filter(({ packageJson }) => packageJson.private !== true);

    for (const { path, packageJson } of publicPackages) {
      expect(packageJson.main, `${relative(workspaceRoot, path)} must declare main`).toBeTypeOf('string');
      expect(packageJson.types, `${relative(workspaceRoot, path)} must declare types`).toBeTypeOf('string');
    }
  });

  test('private declaration-only packages do not pretend to publish a runtime entrypoint', () => {
    const privatePackages = workspacePackageJsonPaths()
      .map((path) => ({ path, packageJson: readJson(path) }))
      .filter(({ packageJson }) => packageJson.private === true);

    for (const { path, packageJson } of privatePackages) {
      if (packageJson.main === undefined && packageJson.types === undefined) continue;
      expect(packageJson.main, `${relative(workspaceRoot, path)} with types must also declare main`).toBeTypeOf('string');
      expect(packageJson.types, `${relative(workspaceRoot, path)} with main must also declare types`).toBeTypeOf('string');
    }
  });

  test('workspace package imports are declared as workspace dependencies', () => {
    for (const packageJsonPath of workspacePackageJsonPaths()) {
      const packageRoot = packageJsonPath.replace(/[\\/]package\.json$/, '');
      const packageJson = readJson(packageJsonPath);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const source = sourceFiles(join(packageRoot, 'src'))
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n');
      const imports = new Set<string>();
      const workspaceImportPattern = /@internet-brain-os\/(shared|kernel|obsidian|connectors|skills|agents)/g;
      let match = workspaceImportPattern.exec(source);
      while (match) {
        imports.add(`@internet-brain-os/${match[1]}`);
        match = workspaceImportPattern.exec(source);
      }
      imports.delete(packageJson.name ?? '');

      imports.forEach((importedPackage) => {
        expect(dependencies[importedPackage], `${relative(workspaceRoot, packageJsonPath)} imports ${importedPackage}`).toBe('workspace:*');
      });
    }
  });
});

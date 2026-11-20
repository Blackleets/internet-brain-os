// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentsView } from './efesto-product-views';

afterEach(cleanup);

describe('Agentes v3: Hermes appears once with its real logo', () => {
  it('renders a single Hermes header with the bundled logo, status and action', () => {
    const { container } = render(<AgentsView onSettings={() => undefined} onNewGoal={() => undefined} connected={false} />);
    expect(screen.getAllByText('Hermes Agent')).toHaveLength(1);
    expect(container.querySelectorAll('.agent-hero')).toHaveLength(1);
    expect(container.querySelector('.agent-hero img')?.getAttribute('src')).toBe('/brand/agents/hermes.png');
    expect(container.querySelector('.agent-status')).toBeNull();
    expect(container.querySelectorAll('li.agent-card')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Conectar Hermes Agent' })).toBeTruthy();
    expect(screen.getByText('Conecta primero el Kernel')).toBeTruthy();
  });
});

describe('design v1: the notice is in flow, never floating', () => {
  it('ships the in-flow toast contract and drops the old floating phone rule', () => {
    const v1 = ['app/efesto-design-v1.css', 'apps/dashboard/app/efesto-design-v1.css'].find((p) => existsSync(p))!;
    const css = readFileSync(v1, 'utf8');
    expect(css).toMatch(/\.efesto-stage:has\(> \.efesto-toast\)/);
    expect(css).toMatch(/\.efesto-toast,\s*\n\.efesto-product\.has-tabbar \.efesto-toast \{\s*\n\s*position: static;/);
    const legacy = ['app/efesto-home-v2.css', 'apps/dashboard/app/efesto-home-v2.css'].find((p) => existsSync(p))!;
    expect(readFileSync(legacy, 'utf8')).not.toMatch(/\.efesto-toast[^{]*\{ top: calc\(58px/);
  });
});

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

describe('mobile toast sits at the top', () => {
  it('ships the phone rule that moves the toast under the header', () => {
    const file = ['app/efesto-home-v2.css', 'apps/dashboard/app/efesto-home-v2.css'].find((p) => existsSync(p))!;
    expect(readFileSync(file, 'utf8')).toMatch(/max-width: 720px[\s\S]*\.efesto-toast[^{]*\{ top: calc\(58px[^}]*bottom: auto/);
  });
});

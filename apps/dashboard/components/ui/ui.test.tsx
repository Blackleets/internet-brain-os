// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Panel } from './panel';
import { StatusBadge } from './status-badge';

describe('dashboard UI primitives', () => {
  it('renders a labelled panel heading and its content', () => {
    render(
      <Panel title="Estado del sistema">
        <p>El Kernel está disponible.</p>
      </Panel>,
    );

    expect(screen.getByRole('heading', { name: 'Estado del sistema' })).toBeTruthy();
    expect(screen.getByText('El Kernel está disponible.')).toBeTruthy();
  });

  it('communicates a healthy state with visible text and a decorative icon', () => {
    render(<StatusBadge state="healthy" />);

    expect(screen.getByText('Saludable')).toBeTruthy();
    expect(screen.getByTestId('status-icon').getAttribute('aria-hidden')).toBe('true');
  });
});

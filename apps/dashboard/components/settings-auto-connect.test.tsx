// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from './efesto-product-views';

afterEach(cleanup);
const base = { connecting: false, rememberSession: false, onConnect: (e: { preventDefault(): void }) => e.preventDefault(), onDisconnect: () => {}, onRefresh: () => {} };

describe('Ajustes: local auto-connect first, manual fields behind Avanzado', () => {
  it('offers one "Conectar automáticamente" button; URL/token/pairing code are inside Avanzado', () => {
    const onLocalConnect = vi.fn();
    const { container } = render(<SettingsView {...base} connected={false} onLocalConnect={onLocalConnect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar automáticamente' }));
    expect(onLocalConnect).toHaveBeenCalled();
    const advanced = container.querySelector('details.connection-advanced');
    expect(advanced?.hasAttribute('open')).toBe(false);
    for (const label of ['URL del Kernel', 'Token privado', 'Código de emparejamiento']) expect(advanced?.querySelector(`[aria-label="${label}"]`)).toBeTruthy();
    expect((advanced?.querySelector('[aria-label="URL del Kernel"]') as HTMLInputElement).defaultValue).toBe('http://127.0.0.1:4310');
  });
  it('when connected shows just "Conectado" and no secret fields', () => {
    const { container } = render(<SettingsView {...base} connected kernelBaseUrl="http://127.0.0.1:4310" />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(container.querySelector('[aria-label="Token privado"]')).toBeNull();
  });
});

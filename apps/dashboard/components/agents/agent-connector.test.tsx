// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentConnector, ConnectionsSheet, workerSetupCommands } from './agent-connector';
import type { AgentsSnapshot } from '../../lib/kernel/agents';

afterEach(cleanup);
const NOW = Date.parse('2026-10-04T12:00:00.000Z');
const snapshot = (state: 'never' | 'online' | 'history', extra = {}): AgentsSnapshot => ({ agents: [{ id: 'hermes', label: 'Hermes Agent', state, onlineWindowMs: 120_000, queuedMissions: 0, ...extra }] });

describe('workerSetupCommands', () => {
  it('fills the connected Kernel URL and reads the token from the private file, never inline', () => {
    for (const shell of ['bash', 'powershell'] as const) {
      const commands = workerSetupCommands('http://127.0.0.1:4310', shell);
      expect(commands.configure).toContain('http://127.0.0.1:4310');
      expect(commands.configure).toMatch(/kernel-api-token/);
      expect(commands.doctor).toBe('pnpm hermes:worker:doctor');
      expect(commands.run).toContain('hermes:mission-worker');
    }
  });
});

describe('AgentConnector', () => {
  it('shows the bundled Hermes identity while retaining the Kernel disconnected state', () => {
    const { container } = render(<AgentConnector connected={true} agents={snapshot('never')} onConnectKernel={() => {}} onTest={async () => undefined} now={() => NOW} />);
    expect(container.querySelector('.agent-status-mark img')?.getAttribute('src')).toBe('/brand/sources/hermes.ico');
    expect(container.querySelector('.agent-status')?.getAttribute('data-tone')).not.toBe('ok');
  });
  it('without a Kernel: asks to connect it first and cannot test', () => {
    const onConnectKernel = vi.fn();
    render(<AgentConnector connected={false} onConnectKernel={onConnectKernel} onTest={async () => undefined} now={() => NOW} />);
    expect(screen.getByRole('heading', { name: 'Conecta primero el Kernel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Conectar Kernel/ }));
    expect(onConnectKernel).toHaveBeenCalled();
    expect((screen.getByRole('button', { name: /Probar conexión/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Probar conexión" re-reads the Kernel and fails honestly until the Kernel saw the agent', async () => {
    const onTest = vi.fn<() => Promise<AgentsSnapshot | undefined>>()
      .mockResolvedValueOnce(snapshot('never'))
      .mockResolvedValueOnce(snapshot('online', { lastSeenAt: '2026-10-04T11:59:55.000Z', lastSeenVia: 'ping' }));
    render(<AgentConnector connected kernelUrl="http://127.0.0.1:4310" agents={snapshot('never')} onConnectKernel={() => undefined} onTest={onTest} now={() => NOW} />);
    expect(screen.getByRole('heading', { name: 'Ningún agente conectado' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Probar conexión/ }));
    await waitFor(() => expect(screen.getByText(/Aún no: el Kernel no ha recibido a Hermes Agent/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Probar conexión/ }));
    await waitFor(() => expect(screen.getByText('Funciona: el Kernel recibió a Hermes Agent hace 5 s (comprobación del doctor).')).toBeTruthy());
    expect(onTest).toHaveBeenCalledTimes(2);
  });

  it('an older Kernel without /api/agents is reported, not faked', async () => {
    render(<AgentConnector connected kernelUrl="http://127.0.0.1:4000" onConnectKernel={() => undefined} onTest={async () => undefined} now={() => NOW} />);
    expect(screen.getByRole('heading', { name: 'Estado de agentes no disponible' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Probar conexión/ }));
    await waitFor(() => expect(screen.getByText('No se pudo comprobar: este Kernel no publica el estado de agentes.')).toBeTruthy());
  });

  it('switches the copyable setup between bash and PowerShell and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AgentConnector connected kernelUrl="http://127.0.0.1:4310" agents={snapshot('history')} onConnectKernel={() => undefined} onTest={async () => undefined} now={() => NOW} />);
    expect(screen.getByLabelText('Configuración del worker').textContent).toContain('export HEPHAESTUS_KERNEL_URL="http://127.0.0.1:4310"');
    fireEvent.click(screen.getByRole('radio', { name: 'Windows PowerShell' }));
    expect(screen.getByLabelText('Configuración del worker').textContent).toContain('$env:HEPHAESTUS_KERNEL_URL = "http://127.0.0.1:4310"');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar: Configuración del worker' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('$env:HEPHAESTUS_API_TOKEN = (Get-Content')));
    await waitFor(() => expect(screen.getByText('Copiado')).toBeTruthy());
  });
});

describe('ConnectionsSheet', () => {
  it('is a labelled dialog with the Kernel row, closes on Escape, and links to Kernel settings', () => {
    const onClose = vi.fn();
    const onManageKernel = vi.fn();
    render(<ConnectionsSheet kernelOnline connected kernelUrl="http://127.0.0.1:4310" agents={snapshot('history')} onConnectKernel={() => undefined} onTest={async () => undefined} onManageKernel={onManageKernel} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Kernel y agentes' });
    expect(dialog.textContent).toContain('Kernel listo');
    fireEvent.click(screen.getByRole('button', { name: /Gestionar Kernel/ }));
    expect(onManageKernel).toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

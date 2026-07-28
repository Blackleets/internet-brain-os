// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectionStore } from '../../lib/session/connection-store';
import { ChatDock } from './chat-dock';

const token = 'local-kernel-token-that-is-long-enough';
const provider = {
  id: 'local',
  type: 'ollama',
  label: 'Ollama local',
  baseUrl: 'http://127.0.0.1:11434',
  models: ['qwen3:4b'],
  hasCredential: true,
  managedBy: 'environment',
};

afterEach(() => {
  cleanup();
  connectionStore.clear();
  vi.unstubAllGlobals();
});

describe('ChatDock', () => {
  it('loads real providers and sends a bounded conversation through the Kernel', async () => {
    connectionStore.set({ baseUrl: 'http://127.0.0.1:4000', token });
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input.toString()).pathname;
      expect(new Headers(init?.headers).get('x-hephaestus-token')).toBe(token);
      if (path === '/api/chat/providers') return Response.json({ ok: true, providers: [provider] });
      if (path === '/api/chat/conversations') return Response.json({ ok: true, conversations: [] });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        providerId: 'local',
        model: 'qwen3:4b',
        messages: [{ role: 'user', content: 'Explícame este caso' }],
      });
      return new Response([
        JSON.stringify({ type: 'conversation', conversationId: 'conversation-1' }),
        JSON.stringify({ type: 'delta', delta: 'Respuesta ' }),
        JSON.stringify({ type: 'delta', delta: 'trazable.' }),
        JSON.stringify({ type: 'done', conversationId: 'conversation-1', response: { model: 'qwen3:4b' } }),
        '',
      ].join('\n'), { headers: { 'content-type': 'application/x-ndjson' } });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<ChatDock />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Ollama local' })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Explícame este caso' } });
    fireEvent.submit(screen.getByLabelText('Mensaje').closest('form')!);

    await waitFor(() => expect(screen.getByText('Respuesta trazable.')).toBeTruthy());
    expect(screen.getByText(/Salida no verificada/)).toBeTruthy();
  });

  it('opens persisted local history and starts a clean conversation', async () => {
    connectionStore.set({ baseUrl: 'http://127.0.0.1:4000', token });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(input.toString()).pathname;
      if (path === '/api/chat/providers') return Response.json({ ok: true, providers: [provider] });
      if (path === '/api/chat/conversations') return Response.json({
        ok: true,
        conversations: [{ id: 'conversation-1', title: 'Caso local', providerId: 'local', model: 'qwen3:4b', messageCount: 2, updatedAt: '2026-07-28T12:00:00.000Z' }],
      });
      return Response.json({
        ok: true,
        conversation: {
          id: 'conversation-1',
          title: 'Caso local',
          providerId: 'local',
          model: 'qwen3:4b',
          messageCount: 2,
          updatedAt: '2026-07-28T12:00:00.000Z',
          messages: [{ role: 'user', content: 'Pregunta guardada' }, { role: 'assistant', content: 'Respuesta guardada', model: 'qwen3:4b' }],
        },
      });
    }));
    render(<ChatDock />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ollama local' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Historial de conversaciones' }));
    await waitFor(() => expect(screen.getByText('Caso local')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caso local' }));
    await waitFor(() => expect(screen.getByText('Respuesta guardada')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.queryByText('Respuesta guardada')).toBeNull();
  });

  it('clears a typed provider credential immediately after submission', async () => {
    connectionStore.set({ baseUrl: 'http://127.0.0.1:4000', token });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input.toString()).pathname;
      if (path === '/api/chat/providers' && init?.method === 'POST') return Response.json({ ok: true });
      if (path === '/api/chat/providers') return Response.json({ ok: true, providers: [] });
      return Response.json({ ok: true, conversations: [] });
    }));
    render(<ChatDock />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar modelos' }));
    const credential = screen.getByLabelText('Clave privada') as HTMLInputElement;
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Proveedor' } });
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'proveedor' } });
    fireEvent.change(screen.getByLabelText('URL base'), { target: { value: 'https://api.example.com' } });
    fireEvent.change(screen.getByLabelText('Modelos'), { target: { value: 'modelo-1' } });
    fireEvent.change(credential, { target: { value: 'private-key-value' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Añadir proveedor' }).closest('form')!);
    await waitFor(() => expect(credential.value).toBe(''));
  });
});

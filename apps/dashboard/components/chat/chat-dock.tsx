'use client';

import { Bot, Plus, Send, Settings2, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { KernelClient } from '../../lib/kernel/client';
import { connectionStore } from '../../lib/session/connection-store';

type Provider = {
  id: string;
  type: 'ollama' | 'openai-compatible';
  label: string;
  baseUrl: string;
  models: string[];
  hasCredential: boolean;
  managedBy: 'environment' | 'user';
};
type Message = { role: 'user' | 'assistant'; content: string; model?: string };

export function ChatDock() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const selected = providers.find((item) => item.id === providerId);
  const configured = providers.length > 0;
  const conversation = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages]);

  useEffect(() => { void loadProviders(); }, []);
  useEffect(() => {
    if (!selected) {
      const first = providers[0];
      setProviderId(first?.id ?? '');
      setModel(first?.models[0] ?? '');
    } else if (!selected.models.includes(model)) setModel(selected.models[0] ?? '');
  }, [providers, selected, model]);

  async function loadProviders() {
    try {
      const body = await kernel().get('/api/chat/providers', parseProviders);
      setProviders(body);
      setError(undefined);
    } catch {
      setError('El Kernel aún no tiene proveedores de conversación disponibles.');
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || !providerId || !model || pending) return;
    const nextMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setPrompt('');
    setPending(true);
    setError(undefined);
    try {
      const response = await kernel(120_000).request('/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ providerId, model, messages: [...conversation, { role: 'user', content }] }),
      }, parseCompletion);
      setMessages((current) => [...current, { role: 'assistant', content: response.content, model: response.model }]);
    } catch {
      setError('El proveedor no respondió. No se guardó ninguna respuesta ni memoria.');
    } finally {
      setPending(false);
    }
  }

  async function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const type = String(fields.get('type')) as Provider['type'];
    const apiKeyInput = form.elements.namedItem('apiKey');
    try {
      await kernel().request('/api/chat/providers', {
        method: 'POST',
        body: JSON.stringify({
          id: String(fields.get('id')),
          type,
          label: String(fields.get('label')),
          baseUrl: String(fields.get('baseUrl')),
          models: String(fields.get('models')).split(',').map((value) => value.trim()).filter(Boolean),
          ...(type === 'openai-compatible' ? { apiKey: String(fields.get('apiKey')) } : {}),
        }),
      }, parseProviderMutation);
      form.reset();
      setError(undefined);
      await loadProviders();
    } catch {
      setError('No se pudo guardar el proveedor. Revisa URL HTTPS, modelos y credencial.');
    } finally {
      if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.value = '';
    }
  }

  async function removeProvider(id: string) {
    try {
      await kernel().request(`/api/chat/providers/${encodeURIComponent(id)}`, { method: 'DELETE' }, parseOk);
      await loadProviders();
    } catch {
      setError('No se pudo eliminar el proveedor local.');
    }
  }

  return (
    <section className="chat-console" id="chat" aria-label="Consola multi-modelo">
      {messages.length ? <div className="chat-thread" aria-live="polite">{messages.map((message, index) => (
        <article className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}>
          <strong>{message.role === 'user' ? 'Tú' : message.model ?? 'Modelo'}</strong>
          <p>{message.content}</p>
          {message.role === 'assistant' ? <small><ShieldCheck size={12} /> Salida no verificada · no admitida en memoria</small> : null}
        </article>
      ))}</div> : null}

      {settings ? <div className="provider-settings">
        <header><div><strong>Modelos y proveedores</strong><span>Las credenciales se guardan solo en el Kernel local.</span></div><button type="button" onClick={() => setSettings(false)} aria-label="Cerrar configuración"><X size={16} /></button></header>
        <ul>{providers.map((provider) => <li key={provider.id}><div><strong>{provider.label}</strong><span>{provider.models.join(' · ')} · {provider.managedBy === 'environment' ? 'entorno privado' : 'configuración local'}</span></div>{provider.managedBy === 'user' ? <button type="button" onClick={() => removeProvider(provider.id)} aria-label={`Eliminar ${provider.label}`}><Trash2 size={14} /></button> : null}</li>)}</ul>
        <form className="provider-form" onSubmit={addProvider}>
          <label>Tipo<select name="type" defaultValue="openai-compatible"><option value="openai-compatible">OpenAI compatible</option><option value="ollama">Ollama local</option></select></label>
          <label>Nombre<input name="label" required placeholder="Mi proveedor" /></label>
          <label>ID<input name="id" required pattern="[a-z0-9][a-z0-9._-]*" placeholder="mi-proveedor" /></label>
          <label>URL base<input name="baseUrl" type="url" required placeholder="https://api.openai.com" /></label>
          <label>Modelos<input name="models" required placeholder="modelo-1, modelo-2" /></label>
          <label>Clave privada<input name="apiKey" type="password" autoComplete="new-password" placeholder="No se devuelve al navegador" /></label>
          <button type="submit"><Plus size={14} /> Añadir proveedor</button>
        </form>
      </div> : null}

      <form className="chat-composer" onSubmit={send}>
        <div className="chat-model">
          <Bot size={15} />
          <select aria-label="Proveedor" value={providerId} onChange={(event) => setProviderId(event.target.value)} disabled={!configured}>
            {!configured ? <option>Sin proveedor</option> : providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.label}</option>)}
          </select>
          <select aria-label="Modelo" value={model} onChange={(event) => setModel(event.target.value)} disabled={!selected}>
            {(selected?.models ?? []).map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <textarea aria-label="Mensaje" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={configured ? 'Pregunta, analiza o prepara una investigación…' : 'Añade un modelo o proveedor para comenzar…'} rows={1} disabled={!configured || pending} />
        <button className="chat-settings-button" type="button" onClick={() => setSettings((value) => !value)} aria-label="Configurar modelos"><Settings2 size={18} /></button>
        <button className="chat-send-button" type="submit" disabled={!prompt.trim() || !configured || pending} aria-label="Enviar mensaje"><Send size={18} /></button>
      </form>
      <p className="chat-boundary"><ShieldCheck size={12} /> Los modelos conversan; Hephaestus conserva la autoridad sobre Evidence y memoria.</p>
      {error ? <p className="chat-error" aria-live="polite">{error}</p> : null}
    </section>
  );
}

function kernel(timeoutMs = 30_000) {
  const connection = connectionStore.get();
  if (!connection) throw new Error('Kernel is not connected');
  return new KernelClient({ ...connection, timeoutMs });
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response');
  return value as Record<string, unknown>;
}
function parseProviders(value: unknown): Provider[] {
  const body = object(value);
  if (body.ok !== true || !Array.isArray(body.providers)) throw new Error('Invalid providers');
  return body.providers.map((value) => {
    const item = object(value);
    if (typeof item.id !== 'string' || typeof item.label !== 'string' || !Array.isArray(item.models)) throw new Error('Invalid provider');
    return item as Provider;
  });
}
function parseCompletion(value: unknown): { content: string; model: string } {
  const body = object(value);
  const response = object(body.response);
  if (body.ok !== true || typeof response.content !== 'string' || typeof response.model !== 'string') throw new Error('Invalid completion');
  return { content: response.content, model: response.model };
}
function parseProviderMutation(value: unknown) { const body = object(value); if (body.ok !== true) throw new Error('Invalid provider'); return body; }
function parseOk(value: unknown) { const body = object(value); if (body.ok !== true) throw new Error('Invalid response'); return body; }

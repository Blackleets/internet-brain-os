'use client';

import { Bot, History, MessageSquarePlus, Plus, Send, Settings2, ShieldCheck, Square, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
type Message = { id?: string; role: 'user' | 'assistant'; content: string; model?: string };
type ConversationSummary = { id: string; title: string; providerId: string; model: string; messageCount: number; updatedAt: string };
type Conversation = ConversationSummary & { messages: Message[] };
type StreamEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'delta'; delta: string }
  | { type: 'done'; conversationId: string; response: { model: string } }
  | { type: 'error'; code: string; error: string };

export function ChatDock() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [history, setHistory] = useState(false);
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const selected = providers.find((item) => item.id === providerId);
  const configured = providers.length > 0;
  const conversation = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages]);

  useEffect(() => { void Promise.all([loadProviders(), loadConversations()]); }, []);
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

  async function loadConversations() {
    try {
      const body = await kernel().get('/api/chat/conversations', parseConversations);
      setConversations(body);
    } catch {
      setConversations([]);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || !providerId || !model || pending) return;
    const nextMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages([...nextMessages, { role: 'assistant', content: '', model }]);
    setPrompt('');
    setPending(true);
    setError(undefined);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await kernel(120_000).streamNdjson<StreamEvent>('/api/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          model,
          ...(conversationId ? { conversationId } : {}),
          messages: [...conversation, { role: 'user', content }],
        }),
      }, async (event) => {
        if (event.type === 'conversation') setConversationId(event.conversationId);
        if (event.type === 'delta') {
          setMessages((current) => current.map((message, index) => index === current.length - 1
            ? { ...message, content: `${message.content}${event.delta}` }
            : message));
        }
        if (event.type === 'done') {
          setConversationId(event.conversationId);
          setMessages((current) => current.map((message, index) => index === current.length - 1
            ? { ...message, model: event.response.model }
            : message));
        }
        if (event.type === 'error') throw new Error(event.code);
      }, abort.signal);
      await loadConversations();
    } catch {
      if (abort.signal.aborted) setError('Generación detenida. La respuesta parcial no se guardó en el historial.');
      else setError('El proveedor no respondió. No se guardó ninguna respuesta ni memoria.');
    } finally {
      setPending(false);
      abortRef.current = undefined;
    }
  }

  async function openConversation(id: string) {
    try {
      const conversation = await kernel().get(`/api/chat/conversations/${encodeURIComponent(id)}`, parseConversation);
      setConversationId(conversation.id);
      setProviderId(conversation.providerId);
      setModel(conversation.model);
      setMessages(conversation.messages);
      setHistory(false);
      setError(undefined);
    } catch {
      setError('No se pudo abrir la conversación local.');
    }
  }

  function newConversation() {
    abortRef.current?.abort();
    setConversationId('');
    setMessages([]);
    setHistory(false);
    setError(undefined);
  }

  async function removeConversation(id: string) {
    try {
      await kernel().request(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }, parseOk);
      if (conversationId === id) newConversation();
      await loadConversations();
    } catch {
      setError('No se pudo eliminar la conversación local.');
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

      {history ? <div className="chat-history">
        <header><div><strong>Conversaciones locales</strong><span>Separadas de Evidence y memoria controlada.</span></div><button type="button" onClick={() => setHistory(false)} aria-label="Cerrar historial"><X size={16} /></button></header>
        {conversations.length ? <ul>{conversations.map((item) => <li key={item.id}>
          <button type="button" onClick={() => openConversation(item.id)} aria-label={`Abrir ${item.title}`}><strong>{item.title}</strong><span>{item.model} · {item.messageCount} mensajes</span></button>
          <button type="button" onClick={() => removeConversation(item.id)} aria-label={`Eliminar conversación ${item.title}`}><Trash2 size={14} /></button>
        </li>)}</ul> : <p>No hay conversaciones guardadas todavía.</p>}
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
        <button className="chat-new-button" type="button" onClick={newConversation} aria-label="Nueva conversación"><MessageSquarePlus size={18} /></button>
        <button className="chat-history-button" type="button" onClick={() => { setHistory((value) => !value); setSettings(false); }} aria-label="Historial de conversaciones"><History size={18} /></button>
        <textarea aria-label="Mensaje" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={configured ? 'Pregunta, analiza o prepara una investigación…' : 'Añade un modelo o proveedor para comenzar…'} rows={1} disabled={!configured || pending} />
        <button className="chat-settings-button" type="button" onClick={() => { setSettings((value) => !value); setHistory(false); }} aria-label="Configurar modelos"><Settings2 size={18} /></button>
        {pending
          ? <button className="chat-stop-button" type="button" onClick={() => abortRef.current?.abort()} aria-label="Detener generación"><Square size={16} fill="currentColor" /></button>
          : <button className="chat-send-button" type="submit" disabled={!prompt.trim() || !configured} aria-label="Enviar mensaje"><Send size={18} /></button>}
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
function parseConversations(value: unknown): ConversationSummary[] {
  const body = object(value);
  if (body.ok !== true || !Array.isArray(body.conversations)) throw new Error('Invalid conversations');
  return body.conversations as ConversationSummary[];
}
function parseConversation(value: unknown): Conversation {
  const body = object(value);
  const conversation = object(body.conversation);
  if (body.ok !== true || typeof conversation.id !== 'string' || !Array.isArray(conversation.messages)) throw new Error('Invalid conversation');
  return conversation as Conversation;
}
function parseProviderMutation(value: unknown) { const body = object(value); if (body.ok !== true) throw new Error('Invalid provider'); return body; }
function parseOk(value: unknown) { const body = object(value); if (body.ok !== true) throw new Error('Invalid response'); return body; }

"use client";

import {
  Bot, Boxes, BrainCircuit, CheckCircle2, ChevronDown, ChevronRight, CircleGauge,
  Copy, Database, ExternalLink, FileSearch, FolderSearch, History, KeyRound, Link2,
  Menu, MessageSquare, MessageSquarePlus, Mic, Network, PanelLeftClose, Plug,
  Plus, Radio, Search, Send, Settings, ShieldCheck, Sparkles, SquarePen, Workflow, X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { KernelUrlError, normalizeKernelBaseUrl } from "../lib/kernel/url";

type Mode = "chat" | "research" | "entities" | "relations" | "knowledge" | "agents" | "automations" | "settings";
type Message = { role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; messages?: Message[] };
type ResearchDraft = { id: string; topic: string };
type Provider = { id: string; type?: string; label: string; baseUrl?: string; models: string[]; managedBy?: string };
type CaseRecord = { id: string; title?: string; status?: string; createdAt?: string };
type Mission = { id: string; goalId?: string; agent?: string; status?: string; executionPhase?: string; cadence?: string; createdAt?: string };
type EvidenceRecord = {
  id?: string; caseId?: string; sourceUrl?: string; summary?: string; confidence?: number;
  capturedAt?: string; entityIds?: string[]; relationshipIds?: string[]; tags?: string[];
};
type CaseDetail = { case: Record<string, unknown>; evidence: EvidenceRecord[] };
type Connection = { baseUrl: string; token: string };
type Bootstrap = { kernel?: string; hermes?: string; obsidian?: string; pairing?: string; overall?: string; message?: string };
type BrainPhase = "offline" | "ready" | "queued" | "investigating" | "verifying" | "forged" | "thinking";
const OWNER_CONNECTION_KEY = "hephaestus.owner.connection.v1";

const tools = [
  { id: "research", label: "Investigación", icon: FolderSearch, hint: "Crear caso con evidencia" },
  { id: "entities", label: "Entidades", icon: Boxes, hint: "Índice verificado" },
  { id: "relations", label: "Relaciones", icon: Network, hint: "Grafo con procedencia" },
  { id: "knowledge", label: "Conocimiento", icon: Database, hint: "Memoria controlada" },
  { id: "agents", label: "Agentes", icon: Bot, hint: "Hermes y otros agentes" },
  { id: "automations", label: "Automatizaciones", icon: Workflow, hint: "Flujos con confirmación" },
] satisfies Array<{ id: Mode; label: string; icon: typeof FolderSearch; hint: string }>;

const starters = [
  { mode: "research", icon: FileSearch, title: "Investigar un tema", copy: "Abrir un caso y exigir fuentes" },
  { mode: "relations", icon: Network, title: "Explorar conexiones", copy: "Ver relaciones con procedencia" },
  { mode: "knowledge", icon: ShieldCheck, title: "Revisar memoria", copy: "Auditar qué fue admitido" },
  { mode: "agents", icon: Bot, title: "Ejecutar un agente", copy: "Trabajar bajo límites del Kernel" },
] satisfies Array<{ mode: Mode; icon: typeof FileSearch; title: string; copy: string }>;

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [kernel, setKernel] = useState<"offline" | "checking" | "online">("offline");
  const [kernelMessage, setKernelMessage] = useState("");
  const [provider, setProvider] = useState("Sin modelo");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadQuery, setThreadQuery] = useState("");
  const [researchDrafts, setResearchDrafts] = useState<ResearchDraft[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseDetails, setCaseDetails] = useState<Record<string, CaseDetail>>({});
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [toast, setToast] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<Bootstrap>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [rememberedDevice, setRememberedDevice] = useState(false);
  const connectionRef = useRef<Connection | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoConnectRef = useRef(false);

  const title = useMemo(() => mode === "chat" ? "Nueva conversación" : tools.find((item) => item.id === mode)?.label ?? "Configuración", [mode]);
  const selectedProvider = providers.find((item) => item.id === provider);
  const visibleThreads = useMemo(() => {
    const query = threadQuery.trim().toLocaleLowerCase("es");
    return query ? threads.filter((thread) => thread.title.toLocaleLowerCase("es").includes(query)) : threads;
  }, [threadQuery, threads]);
  const canSend = kernel === "online" && Boolean(selectedProvider && model) && prompt.trim().length > 0;
  const activeMission = missions.find((item) => ["running", "queued", "waiting_for_agent"].includes(item.status ?? ""));
  const brainPhase: BrainPhase = kernel !== "online" ? "offline"
    : isStreaming ? "thinking"
    : activeMission?.executionPhase === "verifying" ? "verifying"
    : activeMission?.executionPhase === "investigating" || activeMission?.status === "running" ? "investigating"
    : activeMission?.status === "queued" || activeMission?.status === "waiting_for_agent" ? "queued"
    : missions[0]?.executionPhase === "forged" || missions[0]?.status === "completed" ? "forged"
    : "ready";

  useEffect(() => {
    if (autoConnectRef.current) return;
    autoConnectRef.current = true;
    const saved = readOwnerConnection();
    if (!saved) return;
    setRememberedDevice(true);
    void connectWithCredentials(saved, { remember: true, automatic: true });
  }, []);

  function newChat() {
    if (messages.length) {
      const first = messages.find((message) => message.role === "user")?.content ?? "Conversación";
      setThreads((current) => [{ id: crypto.randomUUID(), title: first.slice(0, 34), messages }, ...current]);
    }
    setMessages([]);
    setPrompt("");
    setMode("chat");
  }

  async function openThread(thread: Thread) {
    const connection = connectionRef.current;
    if (!connection) return;
    try {
      const body = await kernelJson(connection, `/api/chat/conversations/${encodeURIComponent(thread.id)}`);
      const conversation = object(body.conversation);
      setMessages(Array.isArray(conversation.messages) ? conversation.messages as Message[] : []);
      const nextProvider = typeof conversation.providerId === "string" ? conversation.providerId : "";
      const nextModel = typeof conversation.model === "string" ? conversation.model : "";
      if (nextProvider) setProvider(nextProvider);
      if (nextModel) setModel(nextModel);
      setMode("chat");
    } catch {
      setToast("No se pudo abrir la conversación del Kernel.");
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) return;
    if (!canSend) {
      setToast("No se envió nada. Conecta el Kernel y selecciona un modelo real.");
      return;
    }
    const connection = connectionRef.current;
    if (!connection || !selectedProvider) return;
    const userContent = prompt.trim();
    const nextMessages = [...messages, { role: "user" as const, content: userContent }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setPrompt("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    try {
      const response = await fetch(`${connection.baseUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/x-ndjson",
          "x-hephaestus-token": connection.token,
        },
        body: JSON.stringify({
          providerId: selectedProvider.id,
          model,
          messages: nextMessages,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("stream unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            const event = JSON.parse(line) as { type?: string; delta?: string };
            if (event.type === "delta" && event.delta) {
              setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: `${item.content}${event.delta}` } : item));
            }
          }
          newline = buffer.indexOf("\n");
        }
      }
      await refreshKernelData(connection);
    } catch {
      if (!controller.signal.aborted) setToast("El proveedor no respondió. No se guardó una respuesta falsa.");
    } finally {
      setIsStreaming(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const baseUrl = String(fields.get("baseUrl") ?? "").replace(/\/+$/, "");
    const token = String(fields.get("token") ?? "");
    const remember = fields.get("rememberDevice") === "on";
    const tokenInput = form.elements.namedItem("token");
    if (tokenInput instanceof HTMLInputElement) tokenInput.value = "";
    await connectWithCredentials({ baseUrl, token }, { remember });
  }

  async function connectWithCredentials(connection: Connection, options: { remember: boolean; automatic?: boolean }) {
    const token = connection.token;
    setKernel("checking");
    setKernelMessage(options.automatic ? "Reconectando este dispositivo con el Kernel local…" : "");
    try {
      const baseUrl = normalizeKernelBaseUrl(connection.baseUrl);
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new KernelHttpError(response.status);
      const verifiedConnection = { baseUrl, token };
      const [providerBody, caseBody, missionBody, conversationBody] = await Promise.all([
        kernelJson(verifiedConnection, "/api/chat/providers"),
        kernelJson(verifiedConnection, "/api/cases"),
        kernelJson(verifiedConnection, "/api/agent-missions"),
        kernelJson(verifiedConnection, "/api/chat/conversations"),
      ]);
      const bootstrapResponse = await fetch(`${baseUrl}/bootstrap/status`, { cache: "no-store" });
      if (bootstrapResponse.ok) setBootstrap(await bootstrapResponse.json() as Bootstrap);
      const nextProviders = Array.isArray(providerBody.providers) ? providerBody.providers as Provider[] : [];
      connectionRef.current = verifiedConnection;
      if (options.remember) {
        writeOwnerConnection(verifiedConnection);
        setRememberedDevice(true);
      } else {
        clearOwnerConnection();
        setRememberedDevice(false);
      }
      setProviders(nextProviders);
      setCases(Array.isArray(caseBody.cases) ? caseBody.cases as CaseRecord[] : []);
      setMissions(Array.isArray(missionBody.missions) ? missionBody.missions as Mission[] : []);
      setThreads(Array.isArray(conversationBody.conversations) ? conversationBody.conversations as Thread[] : []);
      setKernel("online");
      setKernelMessage("Kernel conectado. Casos, misiones, modelos e historial provienen del almacenamiento local.");
      setProvider(nextProviders[0]?.id ?? "Sin modelo");
      setModel(nextProviders[0]?.models?.[0] ?? "");
    } catch (error) {
      connectionRef.current = null;
      setProviders([]);
      setCases([]);
      setMissions([]);
      setBootstrap({});
      setKernel("offline");
      setKernelMessage(connectionFailureMessage(error, options.automatic === true));
    }
  }

  function forgetDevice() {
    abortRef.current?.abort();
    clearOwnerConnection();
    connectionRef.current = null;
    setRememberedDevice(false);
    setKernel("offline");
    setKernelMessage("Este navegador olvidó la URL y el token local.");
    setProviders([]);
    setCases([]);
    setMissions([]);
    setThreads([]);
    setBootstrap({});
    setProvider("Sin modelo");
    setModel("");
  }

  function reconnect() {
    const connection = connectionRef.current ?? readOwnerConnection();
    if (!connection) {
      setMode("settings");
      setKernelMessage("Introduce el token local una vez para autorizar este dispositivo.");
      return;
    }
    void connectWithCredentials(connection, { remember: rememberedDevice, automatic: true });
  }

  async function createResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const topic = String(form.get("topic") ?? "").trim();
    if (!topic) return;
    setResearchDrafts((current) => [{ id: crypto.randomUUID(), topic }, ...current]);
    event.currentTarget.reset();
    setToast(connectionRef.current
      ? "Borrador preparado. Confirma Ejecutar para crear el Goal y la misión de Hermes."
      : "Borrador creado en esta sesión. Conecta el Kernel para ejecutarlo.");
  }

  async function executeResearch(draft: ResearchDraft) {
    const connection = connectionRef.current;
    if (!connection) {
      setToast("Conecta el Kernel antes de confirmar esta misión.");
      return;
    }
    try {
      const goalBody = await kernelJson(connection, "/api/goals", {
        method: "POST",
        body: JSON.stringify({ title: draft.topic, keywords: draft.topic.split(/\s+/).slice(0, 8), priority: 2 }),
      });
      const goal = object(goalBody.goal);
      const goalId = typeof goal.id === "string" ? goal.id : "";
      if (!goalId) throw new Error("invalid goal");
      await kernelJson(connection, `/api/goals/${encodeURIComponent(goalId)}/missions`, {
        method: "POST",
        body: JSON.stringify({ confirmed: true, agent: "hermes", cadence: "manual" }),
      });
      setResearchDrafts((current) => current.filter((item) => item.id !== draft.id));
      await refreshKernelData(connection);
      setToast("Goal creado y misión confirmada para Hermes.");
    } catch {
      setToast("El Kernel rechazó la misión. Revisa que Hermes esté instalado y autorizado.");
    }
  }

  async function createAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const connection = connectionRef.current;
    if (!connection) return setToast("Conecta el Kernel antes de guardar una automatización.");
    const form = event.currentTarget;
    const data = new FormData(form);
    const topic = String(data.get("topic") ?? "").trim();
    const cadence = String(data.get("cadence") ?? "manual");
    if (!topic) return;
    try {
      const goalBody = await kernelJson(connection, "/api/goals", {
        method: "POST",
        body: JSON.stringify({ title: topic, keywords: topic.split(/\s+/).slice(0, 8), priority: 2 }),
      });
      const goal = object(goalBody.goal);
      const goalId = typeof goal.id === "string" ? goal.id : "";
      if (!goalId) throw new Error("invalid goal");
      await kernelJson(connection, `/api/goals/${encodeURIComponent(goalId)}/missions`, {
        method: "POST",
        body: JSON.stringify({ confirmed: true, agent: "hermes", cadence }),
      });
      await refreshKernelData(connection);
      form.reset();
      setToast("Automatización persistida como misión confirmada del Kernel.");
    } catch {
      setToast("El Kernel rechazó la automatización. No se guardó un flujo ficticio.");
    }
  }

  async function openCase(caseId: string) {
    setSelectedCaseId(caseId);
    if (caseDetails[caseId]) return;
    const connection = connectionRef.current;
    if (!connection) return setToast("Conecta el Kernel para leer la evidencia del Case.");
    try {
      const body = await kernelJson(connection, `/api/browser/case/${encodeURIComponent(caseId)}`);
      const caseRecord = object(body.case);
      const evidence = Array.isArray(body.evidence) ? body.evidence as EvidenceRecord[] : [];
      setCaseDetails((current) => ({ ...current, [caseId]: { case: caseRecord, evidence } }));
    } catch {
      setToast("El Kernel no pudo abrir ese Case o su Evidence.");
    }
  }

  async function refreshKernelData(connection: Connection) {
    const [caseBody, missionBody, conversationBody] = await Promise.all([
      kernelJson(connection, "/api/cases"),
      kernelJson(connection, "/api/agent-missions"),
      kernelJson(connection, "/api/chat/conversations"),
    ]);
    setCases(Array.isArray(caseBody.cases) ? caseBody.cases as CaseRecord[] : []);
    setMissions(Array.isArray(missionBody.missions) ? missionBody.missions as Mission[] : []);
    setThreads(Array.isArray(conversationBody.conversations) ? conversationBody.conversations as Thread[] : []);
  }

  async function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const connection = connectionRef.current;
    if (!connection) return setToast("Conecta primero el Kernel.");
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = String(data.get("type") ?? "openai-compatible");
    const label = String(data.get("label") ?? "").trim();
    try {
      await kernelJson(connection, "/api/chat/providers", {
        method: "POST",
        body: JSON.stringify({
          id: label.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, ""),
          type,
          label,
          baseUrl: String(data.get("providerUrl") ?? "").trim(),
          models: String(data.get("models") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
          apiKey: String(data.get("apiKey") ?? "").trim(),
        }),
      });
      const body = await kernelJson(connection, "/api/chat/providers");
      const next = Array.isArray(body.providers) ? body.providers as Provider[] : [];
      setProviders(next);
      if (next.length) {
        setProvider(next[next.length - 1].id);
        setModel(next[next.length - 1].models[0] ?? "");
      }
      form.reset();
      setToast("Proveedor guardado de forma privada en el Kernel.");
    } catch {
      setToast("El Kernel rechazó el proveedor. Revisa URL, modelos y credencial.");
    }
  }

  function startVoice() {
    const BrowserSpeech = (window as unknown as { webkitSpeechRecognition?: new () => {
      lang: string; interimResults: boolean; start: () => void;
      onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onerror: () => void;
    } }).webkitSpeechRecognition;
    if (!BrowserSpeech) return setToast("El dictado no está disponible en este navegador.");
    const speech = new BrowserSpeech();
    speech.lang = "es-ES";
    speech.interimResults = false;
    speech.onresult = (event) => setPrompt((current) => `${current}${current ? " " : ""}${event.results[0][0].transcript}`);
    speech.onerror = () => setToast("No se pudo iniciar el micrófono.");
    speech.start();
  }

  return (
    <div className={`app ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <button className="logo" onClick={newChat}><span><BrainCircuit /></span><strong>Internet Brain</strong></button>
          <button className="icon-button collapse" onClick={() => setSidebarOpen(false)} aria-label="Ocultar barra lateral"><PanelLeftClose /></button>
        </div>
        <button className="new-chat" onClick={newChat}><SquarePen /><span>Nueva conversación</span><kbd>⌘ K</kbd></button>
        <label className="side-search"><Search /><input aria-label="Buscar conversaciones" type="search" value={threadQuery} onChange={(event) => setThreadQuery(event.target.value)} placeholder="Buscar conversaciones" /></label>

        <div className="nav-section">
          <span className="nav-label">ESPACIOS</span>
          {tools.map(({ id, label, icon: Icon, hint }) => (
            <button className={mode === id ? "active" : ""} key={id} onClick={() => setMode(id)}>
              <Icon /><span><strong>{label}</strong><small>{hint}</small></span>
            </button>
          ))}
        </div>

        <div className="history-section">
          <div className="nav-label"><span>RECIENTES</span><History /></div>
          {visibleThreads.length ? visibleThreads.map((thread) => <button className="history-item" key={thread.id} onClick={() => openThread(thread)}><MessageSquare /><span>{thread.title}</span></button>)
            : <p className="history-empty">{threads.length ? "No hay conversaciones que coincidan." : "Tus conversaciones aparecerán aquí."}</p>}
        </div>

        <div className="sidebar-footer">
          <button className="kernel-row" onClick={() => kernel === "online" ? reconnect() : setMode("settings")}><span className={`status-dot ${kernel}`} /><span><strong>{kernel === "online" ? "Kernel conectado" : "Kernel local"}</strong><small>{kernel === "online" ? "Comprobar conexión" : rememberedDevice ? "Reconexión preparada" : "Sin conexión"}</small></span><ChevronRight /></button>
          <button className="profile-row" onClick={() => setMode("settings")}><span className="avatar">B</span><span><strong>Blackleets</strong><small>Owner workspace</small></span><Settings /></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)}><Menu /></button>}
            <button className="conversation-title" onClick={() => setMode("chat")}>{title}<ChevronDown /></button>
          </div>
          <button className={`context-button connection-button ${kernel}`} onClick={() => kernel === "online" ? reconnect() : setMode("settings")}><span className={`status-dot ${kernel}`} /><span>{kernel === "online" ? "Kernel online" : kernel === "checking" ? "Conectando…" : "Conectar"}</span><Settings /></button>
        </header>

        <section className="conversation">
          {mode === "chat" && (
            messages.length ? <ThreadView messages={messages} provider={provider} phase={brainPhase} /> : <Welcome onStart={setMode} phase={brainPhase} />
          )}
          {mode === "research" && <Research drafts={researchDrafts} onCreate={createResearch} onExecute={executeResearch} kernel={kernel} />}
          {mode === "entities" && <EvidenceWorkspace kind="entities" cases={cases} selectedId={selectedCaseId} detail={caseDetails[selectedCaseId]} onOpen={openCase} kernel={kernel} bootstrap={bootstrap} />}
          {mode === "relations" && <EvidenceWorkspace kind="relations" cases={cases} selectedId={selectedCaseId} detail={caseDetails[selectedCaseId]} onOpen={openCase} kernel={kernel} bootstrap={bootstrap} />}
          {mode === "knowledge" && <EvidenceWorkspace kind="knowledge" cases={cases} selectedId={selectedCaseId} detail={caseDetails[selectedCaseId]} onOpen={openCase} kernel={kernel} bootstrap={bootstrap} />}
          {mode === "agents" && <AgentWorkspace kernel={kernel} missions={missions} bootstrap={bootstrap} onConfigure={() => setMode("settings")} />}
          {mode === "automations" && <AutomationWorkspace kernel={kernel} missions={missions} onCreate={createAutomation} />}
          {mode === "settings" && <SettingsWorkspace kernel={kernel} message={kernelMessage} onConnect={connect} onReconnect={reconnect} onForgetDevice={forgetDevice} rememberedDevice={rememberedDevice} onAddProvider={addProvider} providers={providers} bootstrap={bootstrap} />}
        </section>

        <div className="composer-wrap">
          <form className="composer" onSubmit={send}>
            {toast && <div className="composer-toast"><ShieldCheck /><span>{toast}</span><button type="button" onClick={() => setToast("")}><X /></button></div>}
            <textarea aria-label="Mensaje" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={1} placeholder="Escribe, investiga o analiza…" onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} />
            <div className="composer-bottom">
              <div className="composer-left">
                <button type="button" className="add-button" onClick={() => setMode("research")} aria-label="Añadir contexto"><Plus /></button>
                <div className="composer-tools"><button type="button" onClick={() => setMode("research")}><FileSearch /> Investigar</button><button type="button" onClick={() => setMode("knowledge")}><ShieldCheck /> Evidencia</button></div>
                <div className="model-control">
                  <button type="button" className="model-trigger" onClick={() => setModelMenuOpen((open) => !open)} aria-expanded={modelMenuOpen}>
                    <ProviderLogo provider={selectedProvider} />
                    <strong>{model || "Seleccionar modelo"}</strong><ChevronDown />
                  </button>
                  {modelMenuOpen && <div className="model-menu">
                    <header><span>{kernel === "online" ? "Modelos disponibles" : "Conexión requerida"}</span><button type="button" onClick={() => { setModelMenuOpen(false); setMode("settings"); }}><Settings /> Gestionar</button></header>
                    {kernel !== "online" ? <div className="model-connect-state"><Radio /><strong>Conecta tu Kernel local</strong><p>Los modelos aparecerán aquí exactamente como estén configurados en tu equipo.</p><button type="button" onClick={() => { setModelMenuOpen(false); setMode("settings"); }}>Conectar ahora</button></div>
                    : providers.length ? providers.flatMap((item) => item.models.map((modelName) => (
                      <button type="button" className={provider === item.id && model === modelName ? "selected" : ""} key={`${item.id}:${modelName}`} onClick={() => {
                        setProvider(item.id); setModel(modelName); setModelMenuOpen(false);
                      }}><ProviderLogo provider={item} /><span><strong>{modelName}</strong><small>{item.label}</small></span>{provider === item.id && model === modelName && <CheckCircle2 />}</button>
                    ))) : <div className="model-connect-state"><Sparkles /><strong>No hay proveedores instalados</strong><p>Añade Ollama o un endpoint OpenAI-compatible desde Conexiones.</p><button type="button" onClick={() => { setModelMenuOpen(false); setMode("settings"); }}>Añadir proveedor</button></div>}
                  </div>}
                </div>
              </div>
              <div className="composer-right">
                <button type="button" className="voice-button" onClick={startVoice} aria-label="Dictar mensaje"><Mic /></button>
                <button className="send-button" disabled={!prompt.trim()} aria-label="Enviar"><Send /></button>
              </div>
            </div>
          </form>
          <p>Hephaestus mantiene las respuestas del modelo separadas de Evidence y memoria.</p>
        </div>
      </main>
    </div>
  );
}

function Welcome({ onStart, phase }: { onStart: (mode: Mode) => void; phase: BrainPhase }) {
  const state = brainState(phase);
  return <div className="welcome">
    <div className={`brain-stage brain-${phase}`} onPointerMove={moveBrainFocus} onPointerLeave={resetBrainFocus}>
      <NeuralField phase={phase} />
      <div className="brain-image-frame">
        <Image src="/internet-brain-core.webp" alt="Cerebro digital completo de Hephaestus recibiendo señales" width={1060} height={454} priority sizes="(max-width: 680px) 720px, 1060px" />
      </div>
    </div>
    <div className={`brain-telemetry brain-${phase}`}><i /><strong>{state.label}</strong><span>{state.detail}</span></div>
    <div className="welcome-copy">
      <span>HEPHAESTUS INTELLIGENCE FORGE</span>
      <h1>¿Qué quieres investigar hoy?</h1>
      <p>Investiga, conecta evidencia y construye memoria confiable sin permitir que un modelo reescriba la verdad.</p>
    </div>
    <div className="starter-grid">{starters.map(({ mode, icon: Icon, title, copy }) => <button key={mode} onClick={() => onStart(mode)}><Icon /><span><strong>{title}</strong><small>{copy}</small></span><ChevronRight /></button>)}</div>
    <div className="truth-strip"><ShieldCheck /><span><strong>Sin datos inventados.</strong> Los contadores, casos y relaciones solo aparecen cuando el Kernel los entrega.</span></div>
  </div>;
}

function NeuralField({ phase }: { phase: BrainPhase }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetCanvas = canvas;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!context) return;

    const energyByPhase: Record<BrainPhase, number> = {
      offline: .18, ready: .48, queued: .58, investigating: 1,
      verifying: .82, forged: .72, thinking: .95,
    };
    const energy = energyByPhase[phase];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let nodes: Array<{ angle: number; radius: number; speed: number; size: number; wobble: number }> = [];

    function resize() {
      const bounds = targetCanvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      targetCanvas.width = Math.max(1, Math.round(width * ratio));
      targetCanvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(26 + energy * 38);
      nodes = Array.from({ length: count }, (_, index) => ({
        angle: (index / count) * Math.PI * 2 + Math.random() * .28,
        radius: Math.min(width, height) * (.4 + Math.random() * .95),
        speed: (.00008 + Math.random() * .00018) * (index % 2 ? 1 : -1),
        size: .55 + Math.random() * 1.35,
        wobble: Math.random() * Math.PI * 2,
      }));
    }

    function draw(timestamp: number) {
      context.clearRect(0, 0, width, height);
      const centerX = width * .52;
      const centerY = height * .48;
      const cyan = phase === "verifying" ? "89, 231, 180" : "72, 204, 255";
      const violet = phase === "forged" ? "190, 96, 255" : "148, 90, 255";
      const positions = nodes.map((node) => {
        if (!reduceMotion) node.angle += node.speed * (650 + energy * 900);
        const breathing = Math.sin(timestamp * .0007 + node.wobble) * 8 * energy;
        return {
          x: centerX + Math.cos(node.angle) * (node.radius + breathing) * 1.65,
          y: centerY + Math.sin(node.angle) * (node.radius + breathing) * .62,
          size: node.size,
        };
      });

      context.lineWidth = .65;
      for (let index = 0; index < positions.length; index += 1) {
        const point = positions[index];
        for (let next = index + 1; next < Math.min(index + 5, positions.length); next += 1) {
          const peer = positions[next];
          const distance = Math.hypot(point.x - peer.x, point.y - peer.y);
          if (distance < 115) {
            context.strokeStyle = `rgba(${index % 2 ? cyan : violet},${(1 - distance / 115) * .16 * energy})`;
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(peer.x, peer.y);
            context.stroke();
          }
        }
        context.fillStyle = `rgba(${index % 3 ? cyan : violet},${.18 + energy * .42})`;
        context.shadowColor = `rgba(${index % 3 ? cyan : violet},.75)`;
        context.shadowBlur = 7 * energy;
        context.beginPath();
        context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        context.fill();
      }

      if (phase !== "offline") {
        for (let stream = 0; stream < 12; stream += 1) {
          const progress = ((timestamp * (.00006 + stream * .000003) + stream / 12) % 1);
          const eased = 1 - Math.pow(1 - progress, 2.2);
          const fromLeft = stream % 2 === 0;
          const startX = fromLeft ? -20 : width + 20;
          const controlY = height * (.18 + (stream % 5) * .16);
          const x = startX + (centerX - startX) * eased;
          const y = controlY + (centerY - controlY) * eased + Math.sin(progress * Math.PI) * (fromLeft ? 28 : -28);
          const trailX = startX + (centerX - startX) * Math.max(0, eased - .045);
          const trailY = controlY + (centerY - controlY) * Math.max(0, eased - .045);
          context.strokeStyle = `rgba(${fromLeft ? cyan : violet},${.1 + energy * .28})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(trailX, trailY);
          context.lineTo(x, y);
          context.stroke();
          context.fillStyle = `rgba(${fromLeft ? cyan : violet},${.45 + energy * .5})`;
          context.shadowColor = `rgba(${fromLeft ? cyan : violet},1)`;
          context.shadowBlur = 12;
          context.beginPath();
          context.arc(x, y, 1.2 + energy * 1.25, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.shadowBlur = 0;
      const pulse = reduceMotion ? .45 : (timestamp * .00022 * Math.max(.35, energy)) % 1;
      context.strokeStyle = `rgba(${phase === "verifying" ? cyan : violet},${(1 - pulse) * .22 * Math.max(.4, energy)})`;
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(centerX + width * .08, centerY + height * .24, 52 + pulse * 175, 12 + pulse * 38, 0, 0, Math.PI * 2);
      context.stroke();
      frame = window.requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(targetCanvas);
    resize();
    frame = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [phase]);

  return <canvas ref={canvasRef} className="neural-field" aria-hidden="true" />;
}

function moveBrainFocus(event: ReactPointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - .5) * 12;
  const y = ((event.clientY - bounds.top) / bounds.height - .5) * 8;
  event.currentTarget.style.setProperty("--brain-x", `${x}px`);
  event.currentTarget.style.setProperty("--brain-y", `${y}px`);
}

function resetBrainFocus(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--brain-x", "0px");
  event.currentTarget.style.setProperty("--brain-y", "0px");
}

function ThreadView({ messages, provider, phase }: { messages: Message[]; provider: string; phase: BrainPhase }) {
  const state = brainState(phase);
  return <div className="thread"><div className={`activity-header brain-${phase}`}><Image src="/internet-brain-core.webp" alt="" width={72} height={40} /><div><small>HEPHAESTUS LIVE</small><strong>{state.label}</strong><span>{state.detail}</span></div><i /></div>{messages.map((message, index) => <article className={message.role} key={index}>
    <div className="message-avatar">{message.role === "user" ? "B" : <BrainCircuit />}</div>
    <div><header><strong>{message.role === "user" ? "Tú" : provider}</strong>{message.role === "assistant" && <span><ShieldCheck /> No admitido en memoria</span>}</header><p>{message.content}</p></div>
  </article>)}</div>;
}

function Research({ drafts, onCreate, onExecute, kernel }: { drafts: ResearchDraft[]; onCreate: (event: FormEvent<HTMLFormElement>) => void; onExecute: (draft: ResearchDraft) => void; kernel: string }) {
  return <Workspace heading="Investigación" eyebrow="Evidence-first workflow" icon={FileSearch} copy="Convierte una pregunta en un caso con fuentes, claims y decisiones auditables.">
    <form className="research-form" onSubmit={onCreate}><label>Pregunta de investigación<textarea name="topic" rows={5} placeholder="¿Qué quieres comprobar con evidencia?" required /></label><div className="form-row"><label>Profundidad<select name="depth"><option>Estándar</option><option>Rápida</option><option>Profunda</option></select></label><label>Agente<select><option>Hermes</option></select></label></div><div className="guardrail"><ShieldCheck /><span>Hermes puede buscar y proponer. Hephaestus conserva la autoridad.</span></div><button><Plus /> Crear borrador de caso</button></form>
    <section className="record-panel"><header><span>Borradores de esta sesión</span><b>{drafts.length}</b></header>{drafts.length ? drafts.map((draft) => <article key={draft.id}><FileSearch /><div><strong>{draft.topic}</strong><small>{kernel === "online" ? "Requiere tu confirmación para crear la misión" : "Kernel requerido para ejecutar"}</small></div><button type="button" disabled={kernel !== "online"} onClick={() => onExecute(draft)} aria-label={`Ejecutar ${draft.topic}`}>Ejecutar</button></article>) : <HonestEmpty icon={FileSearch} title="No hay casos todavía" copy="Crea el primero sin simular resultados." />}</section>
  </Workspace>;
}

function AgentWorkspace({ kernel, missions, bootstrap, onConfigure }: { kernel: string; missions: Mission[]; bootstrap: Bootstrap; onConfigure: () => void }) {
  const hermesReady = bootstrap.hermes === "ready";
  const activeHermesMission = missions.find((mission) => mission.agent === "hermes" && ["running", "queued"].includes(mission.status ?? ""));
  return <Workspace heading="Agentes e integraciones" eyebrow="Controlled execution" icon={Bot} copy="Conecta agentes, modelos y herramientas sin entregarles autoridad directa sobre Evidence o memoria.">
    <section className="integration-hero">
      <div><small>AGENT BRIDGE</small><h2>Un solo Kernel. Muchos agentes.</h2><p>Cada integración recibe capacidades acotadas; Hephaestus valida los resultados antes de conservarlos.</p></div>
      <button onClick={onConfigure}><Plug /> Gestionar conexiones</button>
    </section>
    <section className="hermes-panel">
      <div className="hermes-logo" aria-label="Hermes Agent, Nous Research"><span>H</span><Bot /></div>
      <div className="hermes-copy"><small>AGENTE DE INVESTIGACIÓN · NOUS RESEARCH</small><h2>Hermes Agent</h2><p>Ejecuta investigación pública mediante el adaptador oficial configurado por el propietario. Sus findings vuelven al Kernel para validación, deduplicación y Evidence.</p></div>
      <span className={`integration-status ${hermesReady && kernel === "online" ? "active" : ""}`}><i />{kernel !== "online" ? "Kernel requerido" : hermesReady ? activeHermesMission ? `Misión ${activeHermesMission.executionPhase ?? activeHermesMission.status}` : "Instalado · esperando misión" : hermesStatusLabel(bootstrap.hermes)}</span>
      <button onClick={onConfigure}><Settings /> Configuración precisa</button>
      <div className="hermes-contract">
        <span><b>Runtime</b>{bootstrap.hermes ?? "sin detectar"}</span>
        <span><b>Bridge</b>{kernel === "online" ? "autenticado" : "desconectado"}</span>
        <span><b>Worker</b>{activeHermesMission ? activeHermesMission.status ?? "activo" : "en espera"}</span>
        <span><b>Autoridad</b>Kernel-only</span>
      </div>
    </section>
    <div className="integration-grid supporting-integrations">
      <IntegrationCard icon={Database} name="Obsidian" category="Memoria y notas" description="Proyecta recibos y conocimiento admitido hacia tu vault local." status={kernel !== "online" ? "Kernel requerido" : bootstrap.obsidian === "ready" ? "Conectado" : `Obsidian ${bootstrap.obsidian ?? "sin configurar"}`} active={bootstrap.obsidian === "ready"} action={onConfigure} />
      <IntegrationCard icon={Radio} name="Efesto Extension" category="Captura web" description="Envía contexto visible firmado desde el navegador al Kernel." status={kernel !== "online" ? "Kernel requerido" : bootstrap.pairing === "paired" ? "Conectado" : "Emparejamiento requerido"} active={bootstrap.pairing === "paired"} action={onConfigure} />
      <IntegrationCard icon={Link2} name="Agent Bridge API" category="Agentes compatibles" description="Conecta otro agente mediante claim, lease, results y failures verificables." status="Contrato disponible" active action={() => {
        navigator.clipboard?.writeText("/api/agent-missions/claim · /results · /failures");
      }} actionLabel="Copiar rutas" />
    </div>
    {missions.length ? <section className="record-panel"><header><span>Misiones reales</span><b>{missions.length}</b></header>{missions.map((mission) => <article key={mission.id}><Bot /><div><strong>{mission.agent ?? "hermes"}</strong><small>{mission.executionPhase ?? mission.status ?? "estado desconocido"} · {mission.id}</small></div></article>)}</section> : <HonestEmpty icon={History} title="Sin ejecuciones verificadas" copy="Los runs aparecerán aquí únicamente después de ser reclamados por un agente conectado." />}
  </Workspace>;
}

function AutomationWorkspace({ kernel, missions, onCreate }: { kernel: string; missions: Mission[]; onCreate: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Workspace heading="Automatizaciones" eyebrow="Confirmed mission intents" icon={Workflow} copy="Guarda misiones confirmadas para Hermes. El worker puede ejecutar cada misión una vez; la repetición automática todavía requiere el scheduler del Kernel.">
    <div className="automation-grid">
      <form className="automation-form" onSubmit={onCreate}>
        <header><Workflow /><div><small>NUEVA MISIÓN PROGRAMADA</small><strong>Objetivo y frecuencia</strong></div></header>
        <label>Qué debe investigar o vigilar<input name="topic" placeholder="Ej. Cambios semanales en agentes de IA" required /></label>
        <label>Cadencia solicitada<select name="cadence" defaultValue="manual"><option value="manual">Solo una vez</option><option value="daily">Diaria (scheduler pendiente)</option><option value="weekly">Semanal (scheduler pendiente)</option></select></label>
        <div className="guardrail"><ShieldCheck /><span>El Kernel conserva la cadencia como intención. Esta página no simula recurrencia ni inicia procesos locales.</span></div>
        <button disabled={kernel !== "online"}><Plus /> Guardar misión confirmada</button>
      </form>
      <section className="record-panel automation-runs">
        <header><span>Misiones del Kernel</span><b>{missions.length}</b></header>
        {missions.length ? missions.map((mission) => <article key={mission.id}><Workflow /><div><strong>{mission.agent ?? "hermes"} · {mission.cadence ?? "manual"}</strong><small>{mission.executionPhase ?? mission.status ?? "estado no publicado"} · {mission.id}</small></div></article>)
          : <HonestEmpty icon={Workflow} title="Sin automatizaciones persistidas" copy={kernel === "online" ? "Crea la primera misión real." : "Conecta el Kernel para leer y guardar misiones."} />}
      </section>
    </div>
  </Workspace>;
}

function SettingsWorkspace({ kernel, message, onConnect, onReconnect, onForgetDevice, rememberedDevice, onAddProvider, providers, bootstrap }: {
  kernel: string; message: string; onConnect: (event: FormEvent<HTMLFormElement>) => void;
  onReconnect: () => void; onForgetDevice: () => void; rememberedDevice: boolean;
  onAddProvider: (event: FormEvent<HTMLFormElement>) => void; providers: Provider[]; bootstrap: Bootstrap;
}) {
  const kernelReady = kernel === "online";
  return <Workspace heading="Centro de conexiones" eyebrow="Owner control plane" icon={Settings} copy="Una sola vista para Kernel, Hermes, Obsidian, extensión y modelos. Cada estado proviene de tu proceso local.">
    <div className="settings-grid">
      <form className="settings-card owner-connect-card" onSubmit={onConnect}>
        <header><Radio /><strong>Este dispositivo</strong><b className={kernel}>{kernelReady ? "autorizado" : kernel}</b></header>
        {rememberedDevice ? <div className="device-memory"><ShieldCheck /><div><strong>Reconexión privada activada</strong><span>La URL y el token quedan solo en este navegador. El Launcher debe estar ejecutándose en tu PC.</span></div></div> : <>
          <label>URL del Kernel<input name="baseUrl" type="url" defaultValue="http://127.0.0.1:4000" required /></label>
          <label>Token privado<input name="token" type="password" autoComplete="off" placeholder="Token del Launcher local" required /></label>
          <label className="remember-device"><input name="rememberDevice" type="checkbox" /><span><strong>Recordar solo en este dispositivo</strong><small>Nuevos usuarios empiezan sin acceso y deben usar sus propios datos.</small></span></label>
        </>}
        <div className="settings-actions">
          {rememberedDevice ? <button type="button" onClick={onReconnect}>{kernel === "checking" ? "Comprobando…" : "Reconectar"}</button> : <button>{kernel === "checking" ? "Comprobando…" : "Autorizar dispositivo"}</button>}
          {(rememberedDevice || kernelReady) && <button type="button" className="secondary-action" onClick={onForgetDevice}>{rememberedDevice ? "Olvidar dispositivo" : "Desconectar"}</button>}
        </div>
        {message&&<p>{message}</p>}
      </form>
      <section className="settings-card health-card"><header><ShieldCheck /><strong>Readiness real</strong><b className={bootstrap.overall === "ready" ? "online" : ""}>{bootstrap.overall ?? "sin conexión"}</b></header>
        <IntegrationHealth label="Kernel" value={bootstrap.kernel ?? (kernelReady ? "ready" : "offline")} ready={kernelReady} />
        <IntegrationHealth label="Hermes" value={bootstrap.hermes ?? "sin detectar"} ready={bootstrap.hermes === "ready"} />
        <IntegrationHealth label="Obsidian" value={bootstrap.obsidian ?? "sin configurar"} ready={bootstrap.obsidian === "ready"} />
        <IntegrationHealth label="Extensión" value={bootstrap.pairing ?? "sin emparejar"} ready={bootstrap.pairing === "paired"} />
        <p className="readiness-note">No se usan porcentajes ni estados de relleno. “Ready” significa que el Kernel lo verificó.</p>
      </section>
    </div>
    <section className="integration-control">
      <header><div><small>RUTA DE ARRANQUE VERIFICABLE</small><h2>Launcher → Kernel → Hermes → Evidence → Obsidian</h2></div><span>Sin atajos de seguridad</span></header>
      <div className="integration-control-grid">
        <article><div className="integration-brand kernel-brand"><BrainCircuit /></div><div><small>NÚCLEO LOCAL</small><h3>Hephaestus Kernel</h3><p>El Launcher conserva token, identidad y configuración privada fuera de GitHub.</p></div><span className={`integration-status ${kernelReady ? "active" : ""}`}><i />{kernelReady ? "Conectado" : "Launcher requerido"}</span></article>
        <article><div className="integration-brand" aria-label="Hermes Agent"><Bot /></div><div><small>NOUS RESEARCH</small><h3>Hermes Agent</h3><p>El worker incluido reclama misiones confirmadas; no escribe Evidence ni memoria directamente.</p></div><span className={`integration-status ${bootstrap.hermes === "ready" ? "active" : ""}`}><i />{hermesStatusLabel(bootstrap.hermes)}</span></article>
        <article><div className="integration-brand"><Database aria-label="Obsidian" /></div><div><small>VAULT LOCAL</small><h3>Obsidian</h3><p>Solo recibe proyecciones admitidas. La ruta real se guarda en el Launcher de tu PC.</p></div><span className={`integration-status ${bootstrap.obsidian === "ready" ? "active" : ""}`}><i />{bootstrap.obsidian === "ready" ? "Vault conectado" : bootstrap.obsidian ?? "Sin configurar"}</span></article>
        <article><div className="integration-brand"><Radio aria-label="Chrome" /></div><div><small>CAPTURA FIRMADA</small><h3>Efesto Extension</h3><p>Se empareja con código de un solo uso y conserva su token únicamente en la extensión.</p></div><span className={`integration-status ${bootstrap.pairing === "paired" ? "active" : ""}`}><i />{bootstrap.pairing === "paired" ? "Emparejada" : "Emparejamiento requerido"}</span></article>
      </div>
      <div className="launcher-steps">
        <CommandStep number="01" title="Reparar y registrar la ruta real de Obsidian" command={'pnpm efesto:launcher repair --obsidian-dir "C:\\Ruta\\Real\\TuVault"'} />
        <CommandStep number="02" title="Levantar Kernel y worker Hermes" command="pnpm run kernel:serve" />
        <CommandStep number="03" title="Verificar todo el bootstrap" command="pnpm efesto:launcher status" />
        <CommandStep number="04" title="Abrir el centro local de emparejamiento" command="pnpm efesto:launcher open" />
      </div>
      <p className="integration-truth"><ShieldCheck /> La web puede reconectar automáticamente; por seguridad el navegador no puede iniciar procesos de Windows. Deja el Launcher al inicio de sesión para abrir la plataforma ya conectada.</p>
    </section>
    <div className="settings-grid provider-settings">
      <form className="settings-card provider-form" onSubmit={onAddProvider}>
        <header><Plus /><strong>Añadir proveedor</strong><b>Kernel-owned</b></header>
        <div className="form-row"><label>Tipo<select name="type"><option value="ollama">Ollama local</option><option value="openai-compatible">OpenAI compatible</option></select></label><label>Nombre<input name="label" placeholder="OpenRouter, Groq…" required /></label></div>
        <label>Endpoint<input name="providerUrl" type="url" placeholder="https://api.example.com/v1" required /></label>
        <label>Modelos<input name="models" placeholder="modelo-1, modelo-2" required /></label>
        <label>Credencial privada<input name="apiKey" type="password" autoComplete="off" placeholder="No requerida para Ollama" /></label>
        <button disabled={kernel !== "online"}><Plug /> Guardar en el Kernel</button>
      </form>
      <section className="settings-card provider-card"><header><Sparkles /><strong>Proveedores instalados</strong><b>{providers.length}</b></header>{providers.length ? <div className="provider-list">{providers.map((provider) => <article key={provider.id}><ProviderLogo provider={provider} /><div><strong>{provider.label}</strong><small>{provider.models.join(" · ")}</small></div><b>activo</b></article>)}</div> : <HonestEmpty icon={KeyRound} title="Sin proveedores visibles" copy="Añade Ollama o cualquier endpoint OpenAI-compatible. No se inventarán modelos." />}</section>
    </div>
  </Workspace>;
}

function IntegrationHealth({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div className="health-row"><span>{label}</span><strong className={ready ? "ready" : ""}><i />{value}</strong></div>;
}

function IntegrationCard({ logo, icon: Icon, name, category, description, status, active, action, actionLabel = "Configurar" }: { logo?: string; icon?: typeof Link2; name: string; category: string; description: string; status: string; active?: boolean; action: () => void; actionLabel?: string }) {
  return <article className="integration-card"><div className="integration-logo">{logo ? <Image src={logo} alt="" width={24} height={24} unoptimized /> : Icon ? <Icon /> : <Plug />}</div><div className="integration-copy"><small>{category}</small><h3>{name}</h3><p>{description}</p></div><span className={`integration-status ${active ? "active" : ""}`}><i />{status}</span><button onClick={action}>{actionLabel === "Copiar rutas" ? <Copy /> : <Settings />}{actionLabel}</button></article>;
}

function CommandStep({ number, title, command }: { number: string; title: string; command: string }) {
  return <div className="command-step"><span>{number}</span><div><strong>{title}</strong><code>{command}</code></div><button onClick={() => navigator.clipboard?.writeText(command)} aria-label={`Copiar ${title}`}><Copy /></button></div>;
}

function hermesStatusLabel(status?: string) {
  if (status === "ready") return "Hermes verificado";
  if (status === "missing") return "Hermes no instalado";
  if (status === "invalid") return "Adaptador inválido";
  if (status === "failed") return "Diagnóstico fallido";
  return "Sin diagnóstico";
}

function brainState(phase: BrainPhase) {
  if (phase === "thinking") return { label: "Procesando conversación", detail: "Modelo transmitiendo" };
  if (phase === "investigating") return { label: "Investigando fuentes", detail: "Hermes ejecutando" };
  if (phase === "verifying") return { label: "Verificando evidencia", detail: "Kernel validando" };
  if (phase === "queued") return { label: "Misión preparada", detail: "Esperando agente" };
  if (phase === "forged") return { label: "Evidence forjada", detail: "Resultado persistido" };
  if (phase === "ready") return { label: "Kernel online", detail: "Listo para trabajar" };
  return { label: "Esperando Kernel", detail: "Sin actividad simulada" };
}

function ProviderLogo({ provider }: { provider?: Provider }) {
  return <span className="provider-logo" aria-label={provider?.label ?? "Modelo"}><Sparkles /></span>;
}

function EvidenceWorkspace({ kind, cases, selectedId, detail, onOpen, kernel, bootstrap }: {
  kind: "entities" | "relations" | "knowledge"; cases: CaseRecord[]; selectedId: string; detail?: CaseDetail;
  onOpen: (id: string) => void; kernel: string; bootstrap: Bootstrap;
}) {
  const config = kind === "entities"
    ? { icon: Boxes, eyebrow: "Índice derivado de Evidence", title: "Entidades", copy: "Muestra únicamente entityIds emitidos por el Kernel; nunca genera nombres de relleno." }
    : kind === "relations"
      ? { icon: Network, eyebrow: "Grafo con procedencia", title: "Relaciones", copy: "Cada relación visible procede de Evidence del Case seleccionado." }
      : { icon: Database, eyebrow: "Evidence y memoria controlada", title: "Conocimiento", copy: "Inspecciona recibos reales y el estado del puente local de Obsidian." };
  const ids = detail?.evidence.flatMap((item) => kind === "entities" ? item.entityIds ?? [] : item.relationshipIds ?? []) ?? [];
  const uniqueIds = Array.from(new Set(ids));

  return <Workspace heading={config.title} eyebrow={config.eyebrow} icon={config.icon} copy={config.copy}>
    <div className="evidence-browser">
      <section className="case-index">
        <header><span>Cases del Kernel</span><b>{cases.length}</b></header>
        {cases.length ? cases.map((record) => <button className={selectedId === record.id ? "active" : ""} key={record.id} onClick={() => onOpen(record.id)}>
          <FileSearch /><span><strong>{record.title ?? record.id}</strong><small>{record.status ?? "estado no publicado"} · {record.createdAt ?? "fecha no disponible"}</small></span><ChevronRight />
        </button>) : <HonestEmpty icon={FileSearch} title="No hay Cases" copy={kernel === "online" ? "El Kernel devolvió una colección vacía." : "Conecta el Kernel para leer Cases reales."} />}
      </section>
      <section className="evidence-detail">
        {!selectedId ? <HonestEmpty icon={config.icon} title="Selecciona un Case" copy="La proyección se calcula al abrir su Evidence real." />
          : !detail ? <HonestEmpty icon={Radio} title="Consultando el Kernel" copy="No se muestran datos hasta recibir una respuesta válida." />
          : kind === "knowledge" ? <>
            <header className="detail-status"><div><small>CASE SELECCIONADO</small><strong>{recordTitle(detail.case, selectedId)}</strong></div><span className={`integration-status ${bootstrap.obsidian === "ready" ? "active" : ""}`}><i />Obsidian {bootstrap.obsidian ?? "sin configurar"}</span></header>
            {detail.evidence.length ? <div className="evidence-receipts">{detail.evidence.map((item, index) => <article key={item.id ?? index}><ShieldCheck /><div><strong>{item.summary ?? item.sourceUrl ?? item.id ?? `Evidence ${index + 1}`}</strong><small>{item.sourceUrl ?? "Fuente no publicada"} · {typeof item.confidence === "number" ? `confianza ${Math.round(item.confidence * 100)}%` : "confianza no publicada"}</small>{item.tags?.length ? <p>{item.tags.join(" · ")}</p> : null}</div></article>)}</div>
              : <HonestEmpty icon={ShieldCheck} title="Case sin Evidence publicada" copy="El Case existe, pero el Kernel todavía no devolvió recibos." />}
          </> : <>
            <header className="detail-status"><div><small>PROYECCIÓN DEL KERNEL</small><strong>{recordTitle(detail.case, selectedId)}</strong></div><b>{uniqueIds.length}</b></header>
            {uniqueIds.length ? <div className={`projection-list ${kind}`}>{uniqueIds.map((id) => <article key={id}>{kind === "entities" ? <Boxes /> : <Network />}<div><strong>{id}</strong><small>Referenciado por Evidence del Case</small></div></article>)}</div>
              : <HonestEmpty icon={config.icon} title={`Sin ${kind === "entities" ? "entidades" : "relaciones"} proyectadas`} copy={`El Kernel devolvió Evidence, pero aún no pobló ${kind === "entities" ? "entityIds" : "relationshipIds"}. No se dibuja un grafo ficticio.`} />}
          </>}
      </section>
    </div>
  </Workspace>;
}

function recordTitle(record: Record<string, unknown>, fallback: string) {
  return typeof record.title === "string" ? record.title : typeof record.question === "string" ? record.question : fallback;
}

function Workspace({ heading, eyebrow, icon: Icon, copy, children }: { heading: string; eyebrow: string; icon: typeof FileSearch; copy: string; children: ReactNode }) {
  return <div className="workspace"><header className="workspace-heading"><span><Icon /></span><div><small>{eyebrow}</small><h1>{heading}</h1><p>{copy}</p></div></header><div className="workspace-content">{children}</div></div>;
}

function HonestEmpty({ icon: Icon, title, copy }: { icon: typeof FileSearch; title: string; copy: string }) {
  return <div className="honest-empty"><Icon /><strong>{title}</strong><p>{copy}</p></div>;
}

async function kernelJson(connection: Connection, path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${connection.baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      "x-hephaestus-token": connection.token,
      ...Object.fromEntries(new Headers(init.headers)),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new KernelHttpError(response.status);
  return object(await response.json());
}

class KernelHttpError extends Error {
  constructor(readonly status: number) {
    super(`Kernel request failed: ${status}`);
    this.name = "KernelHttpError";
  }
}

function connectionFailureMessage(error: unknown, automatic: boolean) {
  if (error instanceof KernelUrlError) {
    return error.code === "NON_LOOPBACK_KERNEL_URL"
      ? "Bloqueado: el token solo puede enviarse a localhost o 127.0.0.1."
      : "La URL del Kernel no es válida. Usa http://127.0.0.1:4000 sin rutas adicionales.";
  }
  if (error instanceof KernelHttpError && error.status === 401) {
    return "El Kernel respondió, pero rechazó el token. Copia de nuevo el token privado del Launcher.";
  }
  if (error instanceof KernelHttpError && error.status === 403) {
    return "El Kernel respondió, pero este origen no está autorizado. Añade la URL exacta de la preview a HEPHAESTUS_DASHBOARD_ORIGINS.";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "El Kernel tardó demasiado en responder. Comprueba que el Launcher siga activo en el puerto configurado.";
  }
  return automatic
    ? "La conexión está guardada, pero el Launcher local no responde o el navegador bloqueó el acceso local. Inícialo y pulsa Reconectar."
    : "No se alcanzó el Kernel local. Comprueba el Launcher, el puerto y el permiso de red local del navegador.";
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Kernel response");
  return value as Record<string, unknown>;
}

function readOwnerConnection(): Connection | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(OWNER_CONNECTION_KEY) ?? "null") as Partial<Connection> | null;
    if (!value || typeof value.baseUrl !== "string" || typeof value.token !== "string" || !value.baseUrl || !value.token) return null;
    return { baseUrl: value.baseUrl.replace(/\/+$/, ""), token: value.token };
  } catch {
    clearOwnerConnection();
    return null;
  }
}

function writeOwnerConnection(connection: Connection) {
  window.localStorage.setItem(OWNER_CONNECTION_KEY, JSON.stringify(connection));
}

function clearOwnerConnection() {
  if (typeof window !== "undefined") window.localStorage.removeItem(OWNER_CONNECTION_KEY);
}

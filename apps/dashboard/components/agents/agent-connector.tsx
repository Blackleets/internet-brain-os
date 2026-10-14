'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Copy, PlugZap, RefreshCw, X } from 'lucide-react';
import type { AgentStatus, AgentsSnapshot } from '../../lib/kernel/agents';
import { agentConnectionCopy, connectionTestResult } from '../../lib/kernel/agent-connection-copy';

export type ShellKind = 'bash' | 'powershell';

/** Copyable worker setup. The token is read from the Kernel's private file; it is never shown here. */
export function workerSetupCommands(kernelUrl: string, shell: ShellKind): { configure: string; doctor: string; run: string } {
  if (shell === 'powershell') {
    return {
      configure: [
        `$env:HEPHAESTUS_KERNEL_URL = "${kernelUrl}"`,
        '$env:HEPHAESTUS_API_TOKEN = (Get-Content ".hephaestus\\kernel-api-token" -Raw).Trim()',
        '$env:HEPHAESTUS_HERMES_COMMAND = (Get-Command node).Source',
        `$env:HEPHAESTUS_HERMES_ARGS_JSON = '["scripts/hermes-efesto-adapter.mjs"]'`,
        '$env:HEPHAESTUS_HERMES_EXECUTABLE = (Get-Command hermes).Source',
      ].join('\n'),
      doctor: 'pnpm hermes:worker:doctor',
      run: 'while ($true) { pnpm -s hermes:mission-worker; Start-Sleep -Seconds 15 }',
    };
  }
  return {
    configure: [
      `export HEPHAESTUS_KERNEL_URL="${kernelUrl}"`,
      'export HEPHAESTUS_API_TOKEN="$(cat .hephaestus/kernel-api-token)"',
      'export HEPHAESTUS_HERMES_COMMAND="$(command -v node)"',
      `export HEPHAESTUS_HERMES_ARGS_JSON='["scripts/hermes-efesto-adapter.mjs"]'`,
      'export HEPHAESTUS_HERMES_EXECUTABLE="$(command -v hermes)"',
    ].join('\n'),
    doctor: 'pnpm hermes:worker:doctor',
    run: 'while true; do pnpm -s hermes:mission-worker; sleep 15; done',
  };
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 2200);
  }
  return <div className="agent-code">
    <pre aria-label={label}><code>{text}</code></pre>
    <button type="button" onClick={() => void copy()} aria-label={`Copiar: ${label}`}>
      {copied === 'ok' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-live="polite">{copied === 'ok' ? 'Copiado' : copied === 'failed' ? 'Selecciona y copia' : 'Copiar'}</span>
    </button>
  </div>;
}

/** Real agent logos, bundled under public/brand/agents (see provenance.json); never hotlinked. */
export const AGENT_LOGOS = Object.freeze({
  hermes: '/brand/agents/hermes.png',
  claude: '/brand/agents/claude.png',
  cursor: '/brand/agents/cursor.png',
} as const);
type AgentLogoId = keyof typeof AGENT_LOGOS;
const AGENT_INITIALS: Record<AgentLogoId, string> = { hermes: 'H', claude: 'C', cursor: 'Cu' };

function AgentLogo({ agent }: { agent: AgentLogoId }) {
  const [failed, setFailed] = useState(false);
  return <span className="agent-logo" aria-hidden="true">
    {failed
      ? <span>{AGENT_INITIALS[agent]}</span>
      // Local bundled asset only; no remote optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={AGENT_LOGOS[agent]} alt="" width={32} height={32} decoding="async" onError={() => setFailed(true)} />}
  </span>;
}

const MCP_AGENTS: readonly { id: 'claude' | 'cursor'; name: string; howto: string }[] = [
  { id: 'claude', name: 'Claude', howto: 'En Claude Desktop: Ajustes → Desarrollador → Editar configuración (claude_desktop_config.json).' },
  { id: 'cursor', name: 'Cursor', howto: 'En Cursor: Settings → MCP → Add new MCP server (archivo mcp.json).' },
];

const MCP_CONFIG = JSON.stringify({
  mcpServers: {
    efesto: {
      command: 'node',
      args: ['C:\\Users\\TU_USUARIO\\AppData\\Local\\Efesto\\app\\apps\\local-kernel\\mcp-server.mjs'],
      env: { HEPHAESTUS_DATA_DIR: 'C:\\Users\\TU_USUARIO\\AppData\\Local\\Efesto\\kernel-data' },
    },
  },
}, null, 2);

type ConnectorProps = {
  connected: boolean;
  kernelUrl?: string;
  agents?: AgentsSnapshot;
  /** Missions read in the same refresh: a settled Mission is never shown as being worked on. */
  missions?: readonly { id: string; status?: string }[];
  onConnectKernel: () => void;
  /** Re-reads GET /api/agents from the Kernel; resolves undefined when the Kernel does not publish it. */
  onTest: () => Promise<AgentsSnapshot | undefined>;
  now?: () => number;
};

/**
 * Agent connection, step by step. Every state shown comes from the Kernel (GET /api/agents): the
 * dashboard cannot mark an agent as connected, and "Probar conexión" passes only when the Kernel
 * itself recorded a recent contact from the agent (doctor ping, mission poll, claim or result).
 */
export function AgentConnector({ connected, kernelUrl, agents, missions, onConnectKernel, onTest, now = Date.now, variant = 'sheet' }: ConnectorProps & { variant?: 'sheet' | 'hero' }) {
  const [shell, setShell] = useState<ShellKind>('bash');
  const [advanced, setAdvanced] = useState(false);
  const [mcpOpen, setMcpOpen] = useState<string>();
  const advancedId = useId();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const [, setTick] = useState(0);
  const statusId = useId();
  useEffect(() => { const id = setInterval(() => setTick((value) => value + 1), 15_000); return () => clearInterval(id); }, []);
  const hermes: AgentStatus | undefined = agents?.agents.find((agent) => agent.id === 'hermes') ?? agents?.agents[0];
  const available = connected && Boolean(agents);
  const copy = connected ? agentConnectionCopy(hermes, available, now(), missions) : { tone: 'off' as const, short: 'Sin Kernel', title: 'Conecta primero el Kernel', detail: 'El estado de los agentes lo publica el Kernel; sin él no hay nada que comprobar.' };
  const commands = workerSetupCommands(kernelUrl ?? 'http://127.0.0.1:4000', shell);
  const agentReady = hermes?.state === 'working' || hermes?.state === 'online';

  async function test() {
    setTesting(true);
    setResult(undefined);
    try {
      const next = await onTest();
      const agent = next?.agents.find((item) => item.id === 'hermes') ?? next?.agents[0];
      setResult(connectionTestResult(agent, Boolean(next), now()));
    } catch {
      setResult({ ok: false, message: 'No se pudo comprobar: el Kernel no respondió.' });
    } finally {
      setTesting(false);
    }
  }

  const hermesButton = !connected
    ? { label: 'Conectar', aria: 'Conectar Hermes Agent', action: onConnectKernel }
    : agentReady
      ? { label: 'Conectado · comprobar', aria: 'Comprobar Hermes Agent', action: () => void test() }
      : { label: 'Conectar', aria: 'Conectar Hermes Agent', action: () => void test() };

  const hermesAction = <>
        <button type="button" className="agent-connect" aria-label={hermesButton.aria} onClick={hermesButton.action} disabled={testing}>
          {testing ? <RefreshCw className="is-spinning" aria-hidden="true" /> : agentReady ? <Check aria-hidden="true" /> : <PlugZap aria-hidden="true" />}
          {testing ? 'Comprobando…' : hermesButton.label}
        </button>
        {result ? <p className="agent-test-result" data-ok={result.ok ? 'true' : 'false'} role="status">{result.ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{result.message}</p> : null}
  </>;

  return <div className="agent-connector" data-variant={variant}>
    {variant === 'hero' ? <section className="agent-hero" data-tone={copy.tone} aria-labelledby={statusId}>
      <span className="agent-mark agent-mark-logo" aria-hidden="true"><AgentLogo agent="hermes" /><i /></span>
      <div className="agent-hero-text">
        <small>NOUS RESEARCH</small>
        <h2>Hermes Agent</h2>
        <p>Busca e investiga por ti con límites claros. Solo se muestra como hallazgo lo que el Kernel verifica con una fuente real.</p>
        <p className="agent-hero-status" role="status"><i aria-hidden="true" /><strong id={statusId}>{copy.title}</strong> · {copy.detail}</p>
        <div className="agent-hero-action">{hermesAction}</div>
      </div>
    </section> : <section className="agent-status" data-tone={copy.tone} aria-labelledby={statusId}>
      <span className="agent-status-mark" aria-hidden="true"><AgentLogo agent="hermes" /><i /></span>
      <div>
        <small>HERMES AGENT · ESTADO DEL KERNEL</small>
        <h3 id={statusId}>{copy.title}</h3>
        <p role="status">{copy.detail}</p>
      </div>
    </section>}

    <ul className="agent-cards" aria-label="Agentes">
      {variant === 'hero' ? null : <li className="agent-card" data-ready={agentReady ? 'true' : undefined}>
        <AgentLogo agent="hermes" />
        <div className="agent-card-text">
          <strong>Hermes Agent</strong>
          <small>{connected ? copy.short : 'Sin Kernel'}</small>
          <p>Investiga en la web para tus objetivos. Con el instalador de Windows, Efesto lo arranca solo.</p>
        </div>
        {hermesAction}
      </li>}
      {MCP_AGENTS.map((agent) => <li key={agent.id} className="agent-card">
        <AgentLogo agent={agent.id} />
        <div className="agent-card-text">
          <strong>{agent.name}</strong>
          <small>Solo lectura · se configura en {agent.name}</small>
          <p>Consulta tu memoria verificada desde {agent.name}. No puede cambiar nada en Efesto.</p>
        </div>
        <button type="button" className="agent-connect" aria-label={`Conectar ${agent.name}`} aria-expanded={mcpOpen === agent.id} onClick={() => setMcpOpen(mcpOpen === agent.id ? undefined : agent.id)}>
          <PlugZap aria-hidden="true" />Conectar
        </button>
        {mcpOpen === agent.id ? <div className="agent-card-howto">
          <p>{agent.howto} Añade este bloque y reinicia {agent.name}. Cambia las rutas por las de tu instalación (en Windows: <code>%LOCALAPPDATA%\\Efesto</code>).</p>
          <CopyBlock label={`Configuración MCP para ${agent.name}`} text={MCP_CONFIG} />
        </div> : null}
      </li>)}
    </ul>

    <button type="button" className="agent-advanced-toggle" aria-expanded={advanced} aria-controls={advancedId} onClick={() => setAdvanced((value) => !value)}>
      <ChevronRight aria-hidden="true" />Avanzado
    </button>
    {advanced ? <div id={advancedId} className="agent-advanced">
    <ol className="agent-steps">
      <li>
        <span className="agent-step-n" aria-hidden="true">1</span>
        <div>
          <strong>Configura el worker donde está Hermes</strong>
          <p>Solo si Hermes está en otro equipo o no usas el instalador. En una terminal, en la carpeta de Efesto. El token no aparece aquí: el comando lo lee del archivo privado del Kernel.</p>
          <div className="agent-shells" role="radiogroup" aria-label="Terminal">
            {(['bash', 'powershell'] as const).map((kind) => <button key={kind} type="button" role="radio" aria-checked={shell === kind} onClick={() => setShell(kind)}>{kind === 'bash' ? 'macOS / Linux' : 'Windows PowerShell'}</button>)}
          </div>
          <CopyBlock label="Configuración del worker" text={commands.configure} />
        </div>
      </li>
      <li>
        <span className="agent-step-n" aria-hidden="true">2</span>
        <div>
          <strong>Comprueba la conexión</strong>
          <p>El doctor verifica el token contra el Kernel y deja constancia del contacto. Después, pulsa «Conectar» en Hermes Agent.</p>
          <CopyBlock label="Doctor del worker" text={commands.doctor} />
        </div>
      </li>
      <li>
        <span className="agent-step-n" aria-hidden="true">3</span>
        <div>
          <strong>Déjalo recogiendo misiones</strong>
          <p>Cada ciclo reclama una misión confirmada, investiga y termina; el bucle recoge las siguientes.</p>
          <CopyBlock label="Worker en bucle" text={commands.run} />
        </div>
      </li>
    </ol>
    <p className="agent-other">Cualquier agente puede trabajar para Efesto con el mismo contrato: reclama con <code>POST /api/agent-missions/claim</code> y devuelve candidatos a <code>/api/agent-missions/:id/results</code>. El Kernel lee y verifica cada fuente; el agente nunca escribe Evidence ni Finds. Hoy el Kernel registra todo worker de misiones como «Hermes».</p>
    </div> : null}
  </div>;
}

type SheetProps = ConnectorProps & { kernelOnline: boolean; onManageKernel: () => void; onClose: () => void };

/** The top-bar connector: Kernel + agent status in one honest sheet (bottom sheet on phones). */
export function ConnectionsSheet({ kernelOnline, onManageKernel, onClose, ...connector }: SheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeLatest = useRef(onClose);
  closeLatest.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Escape must close even when focus fell to <body> (e.g. after a button disabled itself while testing).
    const onDocumentKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) closeLatest.current(); };
    document.addEventListener('keydown', onDocumentKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onDocumentKey); };
  }, []);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
  }
  const sheet = <div className="connections-root" onKeyDown={onKeyDown}>
    <div className="connections-scrim" aria-hidden="true" onClick={onClose} />
    <div className="connections-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <span className="connections-grip" aria-hidden="true" />
      <header className="connections-head">
        <div><small>CONEXIONES</small><h2 id={titleId}>Kernel y agentes</h2></div>
        <button ref={closeRef} type="button" className="connections-close" onClick={onClose} aria-label="Cerrar conexiones"><X aria-hidden="true" /></button>
      </header>
      <div className="connections-body">
        <section className="connections-kernel" data-online={kernelOnline ? 'true' : 'false'}>
          <span aria-hidden="true" />
          <div><strong>{kernelOnline ? 'Kernel listo' : 'Kernel sin respuesta'}</strong><small>{connector.kernelUrl}</small></div>
          <button type="button" onClick={onManageKernel}>Gestionar Kernel <ChevronRight aria-hidden="true" /></button>
        </section>
        <AgentConnector {...connector} />
      </div>
    </div>
  </div>;
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

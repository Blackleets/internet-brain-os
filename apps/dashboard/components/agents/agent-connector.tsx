'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Check, ChevronRight, Copy, PlugZap, RefreshCw, X } from 'lucide-react';
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

type ConnectorProps = {
  connected: boolean;
  kernelUrl?: string;
  agents?: AgentsSnapshot;
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
export function AgentConnector({ connected, kernelUrl, agents, onConnectKernel, onTest, now = Date.now }: ConnectorProps) {
  const [shell, setShell] = useState<ShellKind>('bash');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const [, setTick] = useState(0);
  const statusId = useId();
  useEffect(() => { const id = setInterval(() => setTick((value) => value + 1), 15_000); return () => clearInterval(id); }, []);
  const hermes: AgentStatus | undefined = agents?.agents.find((agent) => agent.id === 'hermes') ?? agents?.agents[0];
  const available = connected && Boolean(agents);
  const copy = connected ? agentConnectionCopy(hermes, available, now()) : { tone: 'off' as const, short: 'Sin Kernel', title: 'Conecta primero el Kernel', detail: 'El estado de los agentes lo publica el Kernel; sin él no hay nada que comprobar.' };
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

  return <div className="agent-connector">
    <section className="agent-status" data-tone={copy.tone} aria-labelledby={statusId}>
      <span className="agent-status-mark" aria-hidden="true"><Bot /><i /></span>
      <div>
        <small>HERMES AGENT · ESTADO DEL KERNEL</small>
        <h3 id={statusId}>{copy.title}</h3>
        <p role="status">{copy.detail}</p>
      </div>
    </section>

    <ol className="agent-steps">
      <li data-done={connected ? 'true' : undefined}>
        <span className="agent-step-n" aria-hidden="true">{connected ? <Check /> : '1'}</span>
        <div>
          <strong>Conecta el Kernel</strong>
          {connected
            ? <p>Conectado a <code>{kernelUrl}</code>.</p>
            : <><p>El agente trabaja a través de tu Kernel local.</p><button type="button" className="agent-inline-action" onClick={onConnectKernel}>Conectar Kernel <ChevronRight aria-hidden="true" /></button></>}
        </div>
      </li>
      <li>
        <span className="agent-step-n" aria-hidden="true">2</span>
        <div>
          <strong>Configura el worker donde está Hermes</strong>
          <p>En una terminal, en la carpeta de Efesto. El token no aparece aquí: el comando lo lee del archivo privado del Kernel.</p>
          <div className="agent-shells" role="radiogroup" aria-label="Terminal">
            {(['bash', 'powershell'] as const).map((kind) => <button key={kind} type="button" role="radio" aria-checked={shell === kind} onClick={() => setShell(kind)}>{kind === 'bash' ? 'macOS / Linux' : 'Windows PowerShell'}</button>)}
          </div>
          <CopyBlock label="Configuración del worker" text={commands.configure} />
        </div>
      </li>
      <li data-done={agentReady ? 'true' : undefined}>
        <span className="agent-step-n" aria-hidden="true">{agentReady ? <Check /> : '3'}</span>
        <div>
          <strong>Comprueba la conexión</strong>
          <p>El doctor verifica el token contra el Kernel y deja constancia del contacto. Después, pulsa «Probar conexión».</p>
          <CopyBlock label="Doctor del worker" text={commands.doctor} />
          <button type="button" className="agent-test" onClick={() => void test()} disabled={!connected || testing}>
            {testing ? <RefreshCw className="is-spinning" aria-hidden="true" /> : <PlugZap aria-hidden="true" />}{testing ? 'Comprobando…' : 'Probar conexión'}
          </button>
          {result ? <p className="agent-test-result" data-ok={result.ok ? 'true' : 'false'} role="status">{result.ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}{result.message}</p> : null}
        </div>
      </li>
      <li>
        <span className="agent-step-n" aria-hidden="true">4</span>
        <div>
          <strong>Déjalo recogiendo misiones</strong>
          <p>Cada ciclo reclama una misión confirmada, investiga y termina; el bucle recoge las siguientes.</p>
          <CopyBlock label="Worker en bucle" text={commands.run} />
        </div>
      </li>
    </ol>

    <details className="agent-other">
      <summary>¿Otro agente?</summary>
      <p>Cualquier agente puede trabajar para Efesto con el mismo contrato: reclama con <code>POST /api/agent-missions/claim</code> y devuelve candidatos a <code>/api/agent-missions/:id/results</code>. El Kernel lee y verifica cada fuente; el agente nunca escribe Evidence ni Finds. Hoy el Kernel registra todo worker de misiones como «Hermes».</p>
      <p>Para que un cliente MCP (Claude, Cursor…) consulte tu memoria verificada en solo lectura, registra <code>apps/local-kernel/mcp-server.mjs</code> con <code>HEPHAESTUS_DATA_DIR</code> y <code>HEPHAESTUS_API_TOKEN</code> (ver MCP_SERVER.md).</p>
    </details>
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

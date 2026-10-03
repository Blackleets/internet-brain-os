import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { OwnerOnly } from "@/components/owner-only";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { IconAgents, IconExternal, IconLock } from "@/components/icons";
import { AGENT_TOOLS, agentManifest } from "@/lib/agent/protocol";
import {
  agentEndpoints,
  grokConnector,
  hermesConnector,
  openClawConnector,
  openClawSkill,
} from "@/lib/agent/connectors";
import { KERNEL_PACKET_PROTOCOL } from "@/lib/kernel/packet";
import { AGENT_STEPS } from "@/lib/ui/first-use";
import { AGENT_CHOICES } from "@/lib/agent/presence";
import { useAgentPresence } from "@/lib/agent/presence-store";

export const Route = createFileRoute("/agentes")({
  component: () => (
    <OwnerOnly>
      <AgentsPage />
    </OwnerOnly>
  ),
});

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

function AgentsPage() {
  const origin = useMemo(
    () => (typeof window === "undefined" ? "https://efesto-kernel.vercel.app" : window.location.origin),
    [],
  );
  const endpoints = agentEndpoints(origin);
  const grok = grokConnector(origin);
  const hermes = hermesConnector(origin);
  const openclaw = openClawConnector(origin);
  const skill = openClawSkill(origin);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [openJson, setOpenJson] = useState<string | null>(null);
  const expected = useAgentPresence((state) => state.expected);
  const setExpected = useAgentPresence((state) => state.setExpected);
  const setLive = useAgentPresence((state) => state.setLive);

  async function probe() {
    if (busy || goal.trim().length < 3) return;
    setBusy(true);
    setLog(null);
    try {
      const response = await fetch("/api/agent/forge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          agent: AGENT_CHOICES.find((item) => item.id === expected)?.label,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        incomplete?: boolean;
        reason?: string;
        packet?: { packetHash?: string; evidence?: unknown[]; findings?: unknown[] };
      };
      if (!data.ok) {
        setLog(
          [
            "Investigación incompleta",
            data.reason || "El Kernel no admitió evidencia.",
            data.packet?.packetHash ? `Huella ${data.packet.packetHash}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
        return;
      }
      setLog(
        [
          data.incomplete ? "Paquete forjado · incompleto" : "Paquete forjado · sellado",
          `Huella ${data.packet?.packetHash ?? "—"}`,
          `Evidencia ${data.packet?.evidence?.length ?? 0}`,
          `Hallazgos ${data.packet?.findings?.length ?? 0}`,
          expected
            ? `${AGENT_CHOICES.find((item) => item.id === expected)?.label} consultó el Kernel. El bot no admite.`
            : "El modelo no admite. El Kernel sí.",
        ].join("\n"),
      );
    } catch (error) {
      setLog(error instanceof Error ? error.message : "El agente no pudo contactar el Kernel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agentes"
        description="Si no tienes un agente, no lo necesitas: ve a Forja, escribe y pulsa Forjar. Hermes, Grok u OpenClaw solo sirven si consultan este Kernel en vez de inventar."
      />

      <Panel className="p-5">
        <p className="kicker">Si no tienes un agente</p>
        <p className="mt-2 font-display text-xl tracking-tight">Úsalo tú. El Kernel ya está aquí.</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          No hace falta Hermes, MCP ni JSON. Escribes el objetivo, ves las fuentes, lees el sello.
          Un agente entra después, si quieres que otro modelo deje de hablar por su cuenta.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg">
            Ir a forjar
          </Link>
          <Link to="/uso" className="inline-flex min-h-11 items-center px-3 text-sm text-accent">
            Cómo usarlo
          </Link>
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="kicker">Qué agente está conectado</p>
        <p className="mt-2 font-display text-xl tracking-tight">Dile a Efesto el nombre del bot</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Si usas Hermes, Grok u OpenClaw, elígelo. Cuando consulte el Kernel, la forja dirá su nombre.
          Si no tienes un agente, déjalo vacío: forjas tú.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {AGENT_CHOICES.map((choice) => (
            <Button
              key={choice.id}
              variant={expected === choice.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                const next = expected === choice.id ? null : choice.id;
                setExpected(next);
                if (next) {
                  setLive({
                    id: next,
                    label: choice.label,
                    at: new Date().toISOString(),
                    source: "local",
                  });
                } else {
                  setLive(null);
                }
              }}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-start gap-3">
          <IconAgents className="mt-1 size-5 text-accent" />
          <div>
            <p className="kicker">Si sí tienes un agente</p>
            <p className="mt-2 font-display text-xl tracking-tight">Los modelos responden. El Kernel admite.</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Un buscador devuelve enlaces. Un chatbot afirma. Efesto sella un paquete que otro agente puede
              verificar. Si no hay HTTPS público, el paquete queda incompleto. Nadie —ni Grok, ni Hermes, ni
              OpenClaw— puede marcar Completado por su cuenta.
            </p>
          </div>
        </div>
        <ul className="mt-5 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <IconLock className="size-3.5 text-accent" />
            El modelo no admite evidencia ni memoria
          </li>
          <li>El chat no escribe en el Kernel</li>
          <li>Sin HTTPS público no hay evidencia</li>
          <li>Un paquete incompleto nunca se llama Completado</li>
        </ul>
        <p className="mt-4 font-mono text-[11px] text-subtle">
          {KERNEL_PACKET_PROTOCOL} · {endpoints.mcp}
        </p>
      </Panel>

      <section className="grid gap-3 md:grid-cols-3">
        <AgentStepsCard title="Grok" steps={AGENT_STEPS.grok} />
        <AgentStepsCard title="Hermes" steps={AGENT_STEPS.hermes} />
        <AgentStepsCard title="OpenClaw" steps={AGENT_STEPS.openclaw} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <EndpointCard label="MCP" value={endpoints.mcp} note="Hermes y clientes MCP" />
        <EndpointCard label="OpenAPI" value={endpoints.openapi} note="Acciones de Grok" />
        <EndpointCard label="Forja REST" value={endpoints.forge} note="POST { goal }" />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <EndpointCard label="Verificar" value={endpoints.verify} note="POST { packet }" />
        <EndpointCard label="Clave Ed25519" value={endpoints.key} note="Clave pública de esta instancia" />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ConnectorCard
          title={grok.title}
          role={grok.role}
          hint={grok.hint}
          body={JSON.stringify(grok.mcp, null, 2)}
          extraLabel="OpenAPI"
          extraHref={grok.openapiUrl}
          open={openJson === "grok"}
          onToggle={() => setOpenJson(openJson === "grok" ? null : "grok")}
        />
        <ConnectorCard
          title={hermes.title}
          role={hermes.role}
          hint={hermes.hint}
          body={JSON.stringify(hermes.mcp, null, 2)}
          open={openJson === "hermes"}
          onToggle={() => setOpenJson(openJson === "hermes" ? null : "hermes")}
        />
        <ConnectorCard
          title={openclaw.title}
          role={openclaw.role}
          hint={openclaw.hint}
          body={JSON.stringify(openclaw.mcp, null, 2)}
          extraLabel="Skill"
          extraHref={openclaw.skillUrl}
          open={openJson === "openclaw"}
          onToggle={() => setOpenJson(openJson === "openclaw" ? null : "openclaw")}
        />
      </section>

      <Panel className="p-5">
        <p className="kicker">Herramientas del Kernel</p>
        <ul className="mt-4 space-y-3">
          {AGENT_TOOLS.map((tool) => (
            <li key={tool.name}>
              <p className="font-mono text-[12px] text-accent">{tool.name}</p>
              <p className="mt-1 text-sm text-muted">{tool.description}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-5">
        <p className="kicker">Probar forja para un agente</p>
        <p className="mt-2 text-sm text-muted">
          No entra en tu núcleo local. Devuelve un paquete que otro agente puede verificar. Si falla, verás
          Investigación incompleta — nunca Completado.
        </p>
        <Textarea
          className="mt-4 min-h-24"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Un objetivo, una afirmación, una norma…"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void probe()} disabled={busy || goal.trim().length < 3}>
            {busy ? "Forjando…" : "Forjar paquete"}
          </Button>
          <Button variant="secondary" onClick={() => copy(skill)}>
            Copiar skill OpenClaw
          </Button>
          <Link to="/verificar" className="inline-flex min-h-11 items-center px-3 text-sm text-accent">
            Notaría · verificar paquete
          </Link>
        </div>
        {log ? (
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted">
            {log}
          </pre>
        ) : null}
      </Panel>

      <p className="text-xs text-subtle">{agentManifest(origin).note}</p>
    </div>
  );
}

function AgentStepsCard({ title, steps }: { title: string; steps: readonly string[] }) {
  return (
    <Panel className="p-5">
      <p className="kicker">{title}</p>
      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
        {steps.map((line, index) => (
          <li key={line}>
            <span className="font-mono text-[11px] text-subtle">{String(index + 1).padStart(2, "0")} · </span>
            {line}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function EndpointCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Panel className="p-5">
      <p className="kicker">{label}</p>
      <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-muted">{value}</p>
      <p className="mt-2 text-xs text-subtle">{note}</p>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => copy(value)}>
        Copiar
      </Button>
    </Panel>
  );
}

function ConnectorCard({
  title,
  role,
  hint,
  body,
  extraLabel,
  extraHref,
  open,
  onToggle,
}: {
  title: string;
  role: string;
  hint: string;
  body: string;
  extraLabel?: string;
  extraHref?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Panel className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="mt-1 text-xs text-subtle">{role}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => copy(body)}>
          Copiar
        </Button>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{hint}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {open ? "Ocultar JSON" : "Ver JSON"}
        </Button>
        {extraHref && extraLabel ? (
          <a
            href={extraHref}
            className="inline-flex min-h-9 items-center gap-1 rounded-sm px-3 text-sm text-accent"
          >
            {extraLabel}
            <IconExternal className="size-3.5" />
          </a>
        ) : null}
      </div>
      {open ? (
        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted">
          {body}
        </pre>
      ) : null}
    </Panel>
  );
}

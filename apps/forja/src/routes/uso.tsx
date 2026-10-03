import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { AGENT_STEPS, FIRST_USE_STEPS, HOW_YOU_KNOW, WHY_NOT_PERPLEXITY } from "@/lib/ui/first-use";
import { useIsOwner } from "@/lib/ui/use-role";

export const Route = createFileRoute("/uso")({ component: UsePage });

function UsePage() {
  const owner = useIsOwner();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Cómo usarlo"
        description="No hace falta saber de IA. Escribes una pregunta cuya respuesta te importaría demostrar. Efesto busca en la web pública y sella lo que pudo probar."
      />

      <section className="space-y-3">
        {FIRST_USE_STEPS.map((step) => (
          <Panel key={step.n} className="p-5">
            <p className="kicker">{step.n}</p>
            <h2 className="mt-2 font-display text-xl tracking-tight">{step.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{step.body}</p>
          </Panel>
        ))}
      </section>

      <Panel className="p-5">
        <p className="kicker">Cómo sabes que funciona</p>
        <h2 className="mt-2 font-display text-xl tracking-tight">No es que “responda bien”</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          {HOW_YOU_KNOW.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          <Link to="/verificar" className="text-accent">
            Abrir Verificar
          </Link>
        </p>
      </Panel>

      <section className="grid gap-3 md:grid-cols-2">
        <Panel className="p-5">
          <p className="kicker">Perplexity</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{WHY_NOT_PERPLEXITY.perplexity}</p>
        </Panel>
        <Panel className="p-5">
          <p className="kicker">Efesto</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{WHY_NOT_PERPLEXITY.efesto}</p>
        </Panel>
      </section>
      <p className="max-w-2xl text-sm leading-relaxed text-muted">{WHY_NOT_PERPLEXITY.choose}</p>

      {owner ? (
      <Panel className="p-5">
        <p className="kicker">Hermes, Grok, OpenClaw</p>
        <h2 className="mt-2 font-display text-xl tracking-tight">Si no tienes un agente, no lo necesitas</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          La forja de esta pantalla ya es Efesto. Un agente solo vale si consulta el Kernel en vez de inventar.
          Si no sabes qué es MCP, ignóralo.
        </p>
        <ol className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
          {AGENT_STEPS.hermes.map((line, index) => (
            <li key={line}>
              <span className="font-mono text-[11px] text-subtle">{String(index + 1).padStart(2, "0")} · </span>
              {line}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm">
          <Link to="/agentes" className="text-accent">
            Pasos para Grok, Hermes y OpenClaw
          </Link>
        </p>
      </Panel>
      ) : null}
    </div>
  );
}

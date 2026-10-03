import { useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import { ModelSelector, useSelectedModelStatus } from "./model-selector";
import { WorkingMark } from "./working-status";
import { useKernel } from "@/lib/kernel/store";
import { relatedMemory } from "@/lib/kernel/related-memory";
import { runInvestigation } from "@/lib/research/run-investigation";
import { prepareGoal } from "@/lib/ui/golden-path";
import { useIsOwner } from "@/lib/ui/use-role";

const STARTERS = [
  "¿El Salvador sigue usando bitcoin como curso legal?",
  "¿OpenAI es una empresa cotizada en bolsa?",
  "Qué obliga el reglamento europeo de IA a los sistemas de alto riesgo",
];

export function GoalComposer() {
  const [text, setText] = useState("");
  const [prepared, setPrepared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const memory = useKernel((s) => s.memory);
  const findings = useKernel((s) => s.findings);
  const model = useSelectedModelStatus();
  const owner = useIsOwner();

  const related = useMemo(
    () => relatedMemory(prepared ?? text, memory, findings),
    [prepared, text, memory, findings],
  );

  function fillStarter(value: string) {
    setPrepared(null);
    setText(value);
    setError(null);
  }

  function prepare(raw?: string) {
    const result = prepareGoal(raw ?? text);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setText(result.text);
    setPrepared(result.text);
    setError(null);
  }

  async function confirm() {
    if (!prepared || busy) return;
    setError(null);
    setBusy(true);
    const goal = useKernel.getState().createGoal(prepared);
    navigate({ to: "/goals/$goalId", params: { goalId: goal.id } });
    try {
      await runInvestigation(goal.id, prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La investigación falló.");
      useKernel.getState().setGoalStage(goal.id, "failed", {
        blockedReason: err instanceof Error ? err.message : "Falló.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="composer" className="scroll-mt-24">
      {prepared && !busy ? (
        <div className="rounded-xl bg-surface p-5 shadow-border forge-heat" data-goal-prepared="true">
          <p className="kicker">Goal preparado</p>
          <p className="mt-2 font-display text-xl tracking-tight">{prepared}</p>
          <p className="mt-3 text-sm text-muted">
            Preparar no autoriza red. Confirmar abre el caso: el Kernel busca, retiene evidencia y
            se niega a inventar el resto.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void confirm()}>Confirmar y forjar</Button>
            <Button variant="secondary" onClick={() => setPrepared(null)}>
              Editar
            </Button>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl bg-surface p-3 shadow-border sm:p-4${busy ? " forge-heat" : ""}`}>
          <Textarea
            value={text}
            aria-label="Goal"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                prepare();
              }
            }}
            placeholder="¿Qué estás buscando?"
            className="min-h-28 border-0 bg-transparent px-3 shadow-none"
          />
          <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
            {owner ? (
              <ModelSelector task="interpret" align="down" className="min-w-0 max-w-[min(100%,20rem)]" />
            ) : (
              <p className="min-w-0 text-xs text-subtle">El Kernel retiene. El modelo no sella.</p>
            )}
            <Button onClick={() => prepare()} disabled={busy || text.trim().length < 3} className="shrink-0">
              {busy ? (
                <>
                  <WorkingMark live glyph="searching" className="size-5" />
                  Forjando…
                </>
              ) : (
                "Preparar Goal"
              )}
            </Button>
          </div>
        </div>
      )}
      {related.length ? (
        <div className="mt-3 rounded-lg bg-surface px-4 py-3 shadow-border">
          <p className="text-sm text-muted">
            El Kernel ya recuerda {related.length === 1 ? "esto" : `${related.length} cosas relacionadas`}.
            Lo usará como contexto, no como evidencia de este caso.
          </p>
          <ul className="mt-2 space-y-1">
            {related.map((hit) => (
              <li key={hit.memory.id}>
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: hit.memory.goalId }}
                  className="text-sm text-accent"
                >
                  {hit.memory.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : model.ready ? (
        <p className="mt-3 text-sm text-subtle">
          Preparar no busca. Confirmar forja. {model.label} interpretará extractos. El Kernel admite.
        </p>
      ) : (
        <p className="mt-3 text-sm text-subtle">Preparar no autoriza red · Shift+Enter nueva línea</p>
      )}
      {owner && !model.ready ? (
        <p className="mt-3 text-sm text-muted">
          Sin clave para {model.label}. El Kernel retendrá evidencia; el modelo no interpretará.{" "}
          <Link to="/settings" className="text-accent">
            Añadir clave
          </Link>
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <ul className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((item) => (
          <li key={item}>
            <button
              type="button"
              className="min-h-11 rounded-full bg-surface px-4 text-sm text-muted shadow-border hover:text-fg"
              onClick={() => fillStarter(item)}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

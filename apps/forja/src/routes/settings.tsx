import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { OwnerOnly } from "@/components/owner-only";
import { AuthSlot } from "@/components/auth-slot";
import { SessionLedger } from "@/components/session-ledger";
import { IconExport, IconLock } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";
import { admittedMemory } from "@/lib/kernel/authority";
import { downloadText } from "@/lib/kernel/export";
import { PROVIDER_IDS } from "@/lib/ai/types";
import { PROVIDER_META, defaultModelFor } from "@/lib/ai/catalog";
import { useAI, useHydrateAI } from "@/lib/ai/store";
import { listAIAvailability, probeProvider, refreshOpenRouterCatalog } from "@/lib/ai/server";
import type { ProviderId } from "@/lib/ai/types";

export const Route = createFileRoute("/settings")({
  component: () => (
    <OwnerOnly>
      <SettingsPage />
    </OwnerOnly>
  ),
});

function SettingsPage() {
  useHydrateAI();
  const goalCount = useKernel((s) => s.goals.length);
  const evidenceCount = useKernel((s) => s.evidence.length);
  const findingCount = useKernel((s) => s.findings.length);
  const memoryCount = useKernel((s) => admittedMemory(s.memory).length);
  const dossierCount = useKernel((s) => s.dossiers.length);
  const exportKernel = useKernel((s) => s.exportKernel);
  const importKernel = useKernel((s) => s.importKernel);
  const clearKernel = useKernel((s) => s.clearKernel);
  const [confirm, setConfirm] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Ajustes"
        description="Efesto es local-first. El Kernel de esta vista vive en tu navegador. Las claves de modelo no forman parte del Kernel."
      />
      <div className="mb-6">
        <AuthSlot />
      </div>
      <SessionLedger />
      <dl className="grid grid-cols-2 gap-3">
        {[
          ["Objetivos", goalCount],
          ["Dosieres", dossierCount],
          ["Evidencia", evidenceCount],
          ["Hallazgos", findingCount],
          ["Memoria", memoryCount],
        ].map(([label, value]) => (
          <Panel key={String(label)} className="p-4">
            <dt className="kicker">{label}</dt>
            <dd className="mt-2 font-display text-3xl tabular-nums">{value}</dd>
          </Panel>
        ))}
      </dl>
      <ProviderKeys />
      <ul className="mt-8 space-y-2 text-sm text-muted">
        <li className="flex items-center gap-2">
          <IconLock className="size-3.5 text-accent" />
          Evidencia antes que memoria.
        </li>
        <li>El modelo interpreta; el Kernel admite.</li>
        <li>
          Hermes, OpenClaw y Grok consultan el Kernel.{" "}
          <Link to="/agentes" className="text-accent">
            Conectar agentes
          </Link>
        </li>
        <li>Solo web pública HTTPS.</li>
        <li>Las acciones irreversibles no están en este camino.</li>
      </ul>
      <div className="mt-10 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            downloadText(
              `efesto-kernel-${new Date().toISOString().slice(0, 10)}.json`,
              exportKernel(),
              "application/json;charset=utf-8",
            )
          }
        >
          <IconExport className="size-4" />
          Exportar Kernel
        </Button>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-surface px-4 text-sm shadow-border">
          Reabrir núcleo
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setImportError(null);
              setImportNote(null);
              const reader = new FileReader();
              reader.onload = () => {
                const raw = typeof reader.result === "string" ? reader.result : "";
                const result = importKernel(raw);
                if (!result.ok) {
                  setImportError(result.reason);
                  return;
                }
                setImportNote("Núcleo reabierto en este navegador. No hay cuenta ni nube.");
              };
              reader.readAsText(file);
            }}
          />
        </label>
      </div>
      {importError ? <p className="mt-3 text-sm text-danger">{importError}</p> : null}
      {importNote ? <p className="mt-3 text-sm text-verified">{importNote}</p> : null}
      <p className="mt-3 text-xs text-subtle">
        El núcleo viaja en un archivo. Exportar aquí, reabrir en otro navegador. Sustituye el
        Kernel local. Las claves de modelo no viajan.
      </p>
      <Panel className="mt-10 p-5">
        <p className="kicker">Olvido local</p>
        <p className="mt-2 text-sm text-muted">
          Vacía este Kernel del navegador. Escribe OLVIDAR para confirmar. No hay copia
          en la nube. Las claves de modelo se quedan aparte.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="OLVIDAR"
            className="max-w-48"
            aria-label="Confirmación para vaciar el Kernel"
          />
          <Button
            variant="danger"
            disabled={confirm !== "OLVIDAR"}
            onClick={() => {
              clearKernel();
              setConfirm("");
            }}
          >
            Vaciar Kernel
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function ProviderKeys() {
  const keys = useAI((s) => s.keys);
  const setKey = useAI((s) => s.setKey);
  const clearKey = useAI((s) => s.clearKey);
  const setCatalog = useAI((s) => s.setCatalog);
  const setConnection = useAI((s) => s.setConnection);
  const connection = useAI((s) => s.connection);
  const fallbacks = useAI((s) => s.fallbacks);
  const setFallbacks = useAI((s) => s.setFallbacks);
  const [envAvail, setEnvAvail] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void listAIAvailability().then(setEnvAvail).catch(() => undefined);
  }, []);

  async function probe(id: ProviderId) {
    setBusy(id);
    setNote(null);
    try {
      const result = await probeProvider({
        data: {
          provider: id,
          model: defaultModelFor(id, { provider: useAI.getState().provider, model: useAI.getState().model }, useAI.getState().catalogs),
          apiKey: keys[id],
        },
      });
      setConnection(id, {
        ok: result.ok,
        at: new Date().toISOString(),
        error: result.ok ? undefined : result.error,
        source: keys[id] ? "key" : envAvail[id] ? "env" : "none",
      });
      setNote(result.ok ? `${id} respondió.` : result.error);
    } finally {
      setBusy(null);
    }
  }

  async function refreshRouter() {
    setBusy("openrouter");
    setNote(null);
    try {
      const result = await refreshOpenRouterCatalog({ data: { apiKey: keys.openrouter } });
      if (!result.ok) {
        setNote(result.error);
        return;
      }
      setCatalog("openrouter", result.models);
      setNote(`OpenRouter: ${result.models.length} modelos.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="mt-8 p-5">
      <p className="kicker">Proveedores</p>
      <p className="mt-2 text-sm text-muted">
        Las claves se guardan solo en este navegador. No entran en el Kernel, ni en Actividad, ni en un export, ni en un replay. Elige el mismo proveedor en el compositor. Probar comprueba que responde. Investigar usa esa clave para interpretar evidencia ya recuperada — nunca para admitirla.
      </p>
      <ul className="mt-4 space-y-4">
        {PROVIDER_IDS.map((id) => (
          <li key={id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-fg">{PROVIDER_META[id].label}</p>
              <p className="text-[11px] text-subtle">
                {keys[id] ? "clave local" : envAvail[id] ? "entorno" : "sin clave"}
              </p>
            </div>
            <p className="text-xs text-subtle">{PROVIDER_META[id].hint}</p>
            <Input
              type="password"
              autoComplete="off"
              value={keys[id] ?? ""}
              onChange={(event) => setKey(id, event.target.value)}
              placeholder={envAvail[id] ? "Usando la clave del entorno" : "API key"}
              aria-label={`Clave de ${PROVIDER_META[id].label}`}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy === id || (!keys[id] && !envAvail[id])} onClick={() => void probe(id)}>
                {busy === id ? "Comprobando…" : "Probar"}
              </Button>
              {id === "openrouter" ? (
                <Button size="sm" variant="ghost" disabled={busy === id} onClick={() => void refreshRouter()}>
                  Actualizar catálogo
                </Button>
              ) : null}
              {keys[id] ? (
                <Button size="sm" variant="ghost" onClick={() => clearKey(id)}>
                  Quitar clave
                </Button>
              ) : null}
            </div>
            {connection[id]?.ok ? (
              <p className="text-xs text-verified">Conexión comprobada. El modelo puede interpretar evidencia ya recuperada.</p>
            ) : connection[id]?.error ? (
              <p className="text-xs text-danger">{connection[id]?.error}</p>
            ) : !keys[id] && !envAvail[id] ? (
              <p className="text-xs text-subtle">Sin clave: la investigación retendrá evidencia y no inventará hallazgos.</p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <p className="text-sm text-fg">Fallback</p>
        <p className="mt-1 text-xs text-subtle">
          Si el modelo elegido falla, Efesto prueba el siguiente y deja constancia de cuál respondió de verdad.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={fallbacks.some((item) => item.provider === "openrouter")}
            onChange={(event) =>
              setFallbacks(
                event.target.checked
                  ? [{ provider: "openrouter", model: "anthropic/claude-sonnet-4" }]
                  : [],
              )
            }
          />
          Usar OpenRouter si el proveedor principal falla
        </label>
      </div>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
    </Panel>
  );
}

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  IconAgents,
  IconDossier,
  IconForge,
  IconGear,
  IconIngot,
  IconLedger,
  IconSeal,
  IconSight,
  IconVault,
  IconWatch,
  IconWire,
} from "./icons";
import { useKernel } from "@/lib/kernel/store";
import { latestDossierByGoal } from "@/lib/kernel/dossier";
import { useIsOwner } from "@/lib/ui/use-role";

const pages = [
  { to: "/", label: "Inicio", icon: IconForge },
  { to: "/uso", label: "Cómo usarlo", icon: IconSight },
  { to: "/goals", label: "Objetivos", icon: IconSight },
  { to: "/findings", label: "Hallazgos", icon: IconIngot },
  { to: "/evidence", label: "Evidencia", icon: IconSeal },
  { to: "/memory", label: "Memoria", icon: IconVault },
  { to: "/verificar", label: "Verificar paquete", icon: IconSeal },
  { to: "/activity", label: "Actividad", icon: IconLedger, owner: true },
  { to: "/agentes", label: "Agentes · Hermes, OpenClaw, Grok", icon: IconAgents, owner: true },
  { to: "/chat", label: "Conversación privada", icon: IconWire, owner: true },
  { to: "/settings", label: "Ajustes", icon: IconGear, owner: true },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const goals = useKernel((s) => s.goals);
  const findings = useKernel((s) => s.findings);
  const evidence = useKernel((s) => s.evidence);
  const dossiers = useKernel((s) => s.dossiers);
  const currentDossiers = latestDossierByGoal(dossiers);
  const watched = goals.filter((goal) => goal.watched);
  const owner = useIsOwner();
  const visiblePages = pages.filter((page) => owner || !("owner" in page && page.owner));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("efesto:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("efesto:command", onOpen);
    };
  }, []);

  function go(to: string) {
    setOpen(false);
    void navigate({ to });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-bg/70 px-4 pt-[12vh] backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar búsqueda"
        onClick={() => setOpen(false)}
      />
      <Command
        label="Buscar en el Kernel"
        className="relative z-10 overflow-hidden rounded-xl bg-surface-2 p-2 shadow-border-hover"
      >
        <Command.Input placeholder="Buscar objetivos, dosieres, evidencia…" autoFocus />
        <Command.List>
          <Command.Empty>Nada en el Kernel coincide.</Command.Empty>
          <Command.Group heading="Ir a">
            {visiblePages.map((page) => {
              const Icon = page.icon;
              return (
                <Command.Item key={page.to} onSelect={() => go(page.to)}>
                  <Icon className="size-4 text-accent" />
                  {page.label}
                </Command.Item>
              );
            })}
          </Command.Group>
          {watched.length ? (
            <Command.Group heading="En vigilancia">
              {watched.slice(0, 6).map((goal) => (
                <Command.Item
                  key={`watch-${goal.id}`}
                  value={`vigilancia ${goal.text} ${goal.lastWatchSummary ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/goals/$goalId", params: { goalId: goal.id } });
                  }}
                >
                  <IconWatch className="size-4 text-muted" />
                  <span className="line-clamp-1">{goal.text}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {currentDossiers.length ? (
            <Command.Group heading="Dosieres">
              {currentDossiers.slice(0, 6).map((dossier) => {
                const goal = goals.find((item) => item.id === dossier.goalId);
                return (
                  <Command.Item
                    key={dossier.id}
                    value={`dosier ${goal?.text ?? ""} ${dossier.sealHash}`}
                    onSelect={() => {
                      setOpen(false);
                      void navigate({
                        to: "/goals/$goalId",
                        params: { goalId: dossier.goalId },
                      });
                    }}
                  >
                    <IconDossier className="size-4 text-muted" />
                    <span className="line-clamp-1">{goal?.text ?? "Dosier sellado"}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ) : null}
          {goals.length ? (
            <Command.Group heading="Objetivos">
              {goals.slice(0, 8).map((goal) => (
                <Command.Item
                  key={goal.id}
                  value={`objetivo ${goal.text}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/goals/$goalId", params: { goalId: goal.id } });
                  }}
                >
                  <IconSight className="size-4 text-muted" />
                  <span className="line-clamp-1">{goal.text}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {findings.length ? (
            <Command.Group heading="Hallazgos">
              {findings.slice(0, 8).map((finding) => (
                <Command.Item
                  key={finding.id}
                  value={`hallazgo ${finding.title} ${finding.answer}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({
                      to: "/findings/$findingId",
                      params: { findingId: finding.id },
                    });
                  }}
                >
                  <IconIngot className="size-4 text-muted" />
                  <span className="line-clamp-1">{finding.title}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          {evidence.length ? (
            <Command.Group heading="Evidencia">
              {evidence.slice(0, 8).map((item) => (
                <Command.Item
                  key={item.id}
                  value={`evidencia ${item.title} ${item.sourceHost}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({
                      to: "/evidence/$evidenceId",
                      params: { evidenceId: item.id },
                    });
                  }}
                >
                  <IconSeal className="size-4 text-muted" />
                  <span className="line-clamp-1">
                    {item.sourceHost} · {item.title}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}

export function openCommandPalette() {
  window.dispatchEvent(new Event("efesto:command"));
}

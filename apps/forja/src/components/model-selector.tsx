import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { PROVIDER_META, modelsFor, recommendedFor } from "@/lib/ai/catalog";
import { PROVIDER_IDS, type AITask, type ProviderId } from "@/lib/ai/types";
import { useAI, useHydrateAI } from "@/lib/ai/store";
import { IconChevron } from "./icons";
import { cn } from "@/lib/utils";

function taskForPath(pathname: string): AITask {
  return pathname.startsWith("/chat") ? "chat" : "interpret";
}

function statusDot(ok?: boolean, hasKey?: boolean) {
  if (ok) return "bg-verified";
  if (hasKey) return "bg-accent";
  return "bg-subtle";
}

export function ProviderMark({
  provider,
  className,
}: {
  provider: ProviderId;
  className?: string;
}) {
  const cls = cn("size-4 shrink-0", className);
  if (provider === "xai") {
    return (
      <svg viewBox="0 0 16 16" className={cls} aria-hidden>
        <path d="M3 3.25 8 8l5-4.75M3 12.75 8 8l5 4.75" className="stroke-current" fill="none" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (provider === "openai") {
    return (
      <svg viewBox="0 0 16 16" className={cls} aria-hidden>
        <path d="M8 2.5 12.2 5v6L8 13.5 3.8 11V5L8 2.5z" className="stroke-current" fill="none" strokeWidth="1.3" />
        <circle cx="8" cy="8" r="1.4" className="fill-current" />
      </svg>
    );
  }
  if (provider === "anthropic") {
    return (
      <svg viewBox="0 0 16 16" className={cls} aria-hidden>
        <path d="M8 2.75 13 13.25H3L8 2.75z" className="stroke-current" fill="none" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
  }
  if (provider === "google") {
    return (
      <svg viewBox="0 0 16 16" className={cls} aria-hidden>
        <circle cx="6" cy="6" r="1.35" className="fill-current" />
        <circle cx="10" cy="6" r="1.35" className="fill-current" />
        <circle cx="6" cy="10" r="1.35" className="fill-current" />
        <circle cx="10" cy="10" r="1.35" className="fill-current" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={cls} aria-hidden>
      <circle cx="4.5" cy="8" r="1.5" className="stroke-current" fill="none" strokeWidth="1.2" />
      <circle cx="11.5" cy="5.5" r="1.5" className="stroke-current" fill="none" strokeWidth="1.2" />
      <circle cx="11.5" cy="10.5" r="1.5" className="stroke-current" fill="none" strokeWidth="1.2" />
      <path d="M5.9 7.3 10.1 5.9M5.9 8.7 10.1 10.1" className="stroke-current" fill="none" strokeWidth="1.2" />
    </svg>
  );
}

export function useSelectedModelStatus() {
  useHydrateAI();
  const provider = useAI((s) => s.provider);
  const model = useAI((s) => s.model);
  const keys = useAI((s) => s.keys);
  const catalogs = useAI((s) => s.catalogs);
  const connection = useAI((s) => s.connection);
  const fallbacks = useAI((s) => s.fallbacks);
  const envAvail = useAI((s) => s.envAvail) ?? {};
  const current = modelsFor(provider, catalogs).find((item) => item.id === model);
  const ready =
    Boolean(keys[provider]?.trim()) || Boolean(envAvail[provider]) || Boolean(connection[provider]?.ok);

  return {
    ready,
    provider,
    model,
    label: current?.label ?? model,
    providerLabel: PROVIDER_META[provider].label,
    catalogs,
    keys,
    connection,
    envAvail,
    fallbacks,
  };
}

export function ModelSelector({
  task: taskProp,
  align = "up",
  className,
}: {
  task?: AITask;
  align?: "up" | "down";
  className?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const task = taskProp ?? taskForPath(pathname);
  const status = useSelectedModelStatus();
  const select = useAI((s) => s.select);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const { provider, model, catalogs, keys, connection, envAvail, label, fallbacks } = status;

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (root.current?.contains(target) || popover.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = root.current?.querySelector("button");
    const node = popover.current;
    if (!trigger || !node) return;

    function place() {
      if (!trigger || !node) return;
      const t = trigger.getBoundingClientRect();
      const margin = 8;
      const nav = window.matchMedia("(max-width: 767px)").matches ? 72 : 8;
      const width = Math.min(360, window.innerWidth - margin * 2);
      node.style.width = `${width}px`;
      const height = node.offsetHeight;
      let top = align === "up" ? t.top - height - 8 : t.bottom + 8;
      let left = t.left;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
      if (left < margin) left = margin;
      if (top + height > window.innerHeight - nav) top = window.innerHeight - nav - height;
      if (top < margin) top = margin;
      node.style.top = `${top}px`;
      node.style.left = `${left}px`;
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, provider, model, align]);

  const models = useMemo(() => modelsFor(provider, catalogs), [provider, catalogs]);
  const recommended = recommendedFor(task, catalogs).filter((item) => item.provider === provider);
  const fallback = fallbacks[0];

  function connected(id: ProviderId) {
    return Boolean(keys[id]?.trim()) || Boolean(envAvail[id]) || connection[id]?.ok;
  }

  const availability = connected(provider)
    ? connection[provider]?.ok
      ? "Conectado."
      : envAvail[provider]
        ? "Clave del entorno disponible."
        : "Clave guardada en este navegador."
    : "Sin clave. Añádela en Ajustes.";

  const panel = open
    ? createPortal(
        <div
          ref={popover}
          className="fixed z-50 max-h-[min(24rem,calc(100dvh-6.5rem))] overflow-auto rounded-lg bg-bg-elevated p-3 shadow-border"
        >
          <p className="kicker">Modelo</p>
          <p className="mt-1 text-xs text-subtle">
            Interpreta. No admite. {task === "chat" ? "Conversación, no evidencia." : "Recomendado para interpretar."}
          </p>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {PROVIDER_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const next = modelsFor(id, catalogs)[0];
                  select(id, next?.id ?? model);
                }}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] uppercase tracking-[0.08em]",
                  id === provider ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg",
                )}
                aria-label={PROVIDER_META[id].label}
                aria-pressed={id === provider}
              >
                <ProviderMark provider={id} />
                <span className="max-w-full truncate">{PROVIDER_META[id].label}</span>
              </button>
            ))}
          </div>
          <ul className="mt-3 max-h-52 space-y-1 overflow-auto sm:max-h-64">
            {models.map((item) => {
              const rec = item.recommended?.includes(task) || recommended.some((row) => row.id === item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select(provider, item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm",
                      item.id === model ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ProviderMark provider={provider} className="size-3.5 text-subtle" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </span>
                    {rec ? <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-accent">recomendado</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-subtle">
            {availability}{" "}
            <Link to="/settings" className="text-accent" onClick={() => setOpen(false)}>
              Configurar
            </Link>
          </p>
          {fallback ? (
            <p className="mt-1 text-[11px] text-subtle">
              Si falla: {PROVIDER_META[fallback.provider].label}
              {modelsFor(fallback.provider, catalogs).find((item) => item.id === fallback.model)?.label
                ? ` · ${modelsFor(fallback.provider, catalogs).find((item) => item.id === fallback.model)?.label}`
                : ""}
              . Actividad registra el que respondió.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-subtle">Sin fallback. El Kernel retendrá evidencia si el modelo no responde.</p>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 max-w-full items-center gap-2 rounded-md bg-surface-2 px-2.5 pr-2 text-left text-fg hover:shadow-border-hover"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Modelo ${label}, ${PROVIDER_META[provider].label}`}
      >
        <ProviderMark provider={provider} className="text-accent" />
        <span className={cn("size-1.5 shrink-0 rounded-full", statusDot(connection[provider]?.ok, connected(provider)))} />
        <span className="min-w-0 truncate text-sm">{label}</span>
        <IconChevron className={cn("size-3.5 shrink-0 text-subtle transition-transform duration-150", open ? "-rotate-90" : "rotate-90")} />
      </button>
      {panel}
    </div>
  );
}

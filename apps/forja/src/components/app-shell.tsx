import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ActorChip } from "./actor-chip";
import { ForgeMark } from "./forge-mark";
import { Hearth } from "./hearth";
import { CommandPalette, openCommandPalette } from "./command-palette";
import {
  IconAgents,
  IconForge,
  IconGear,
  IconIngot,
  IconLedger,
  IconSeal,
  IconSearch,
  IconSight,
  IconVault,
  IconWire,
} from "./icons";
import { ThinkingBar } from "./thinking-bar";
import { cn } from "@/lib/utils";
import { useHydrateKernel, useKernel } from "@/lib/kernel/store";
import { useHydrateAI } from "@/lib/ai/store";
import { useIsOwner } from "@/lib/ui/use-role";
import { AuthSlot } from "./auth-slot";
import { SessionGuard } from "./session-guard";

const publicNav = [
  { to: "/", label: "Inicio", short: "Inicio", icon: IconForge },
  { to: "/goals", label: "Objetivos", short: "Objetivos", icon: IconSight },
  { to: "/findings", label: "Hallazgos", short: "Hallaz.", icon: IconIngot },
  { to: "/evidence", label: "Evidencia", short: "Evidenc.", icon: IconSeal },
  { to: "/memory", label: "Memoria", short: "Memoria", icon: IconVault },
] as const;

const ownerNav = [
  { to: "/activity", label: "Actividad", short: "Actividad", icon: IconLedger },
  { to: "/settings", label: "Ajustes", short: "Ajustes", icon: IconGear },
] as const;

const nav = [...publicNav, ...ownerNav];

const mobileNav = [
  { to: "/", label: "Inicio", short: "Inicio", icon: IconForge },
  { to: "/goals", label: "Objetivos", short: "Objetivos", icon: IconSight },
  { to: "/findings", label: "Hallazgos", short: "Hallaz.", icon: IconIngot },
  { to: "/evidence", label: "Evidencia", short: "Evidenc.", icon: IconSeal },
  { to: "/verificar", label: "Verificar", short: "Verificar", icon: IconSeal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrateKernel();
  useHydrateAI();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const goals = useKernel((s) => s.goals);
  const researching = goals.some((goal) => goal.status === "researching");
  const forging = goals.find((goal) => goal.status === "researching");
  const owner = useIsOwner();
  const desktopNav = owner ? nav : publicNav;

  if (pathname.startsWith("/api/") || pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-dvh text-fg">
      <Hearth live={researching} />
      <CommandPalette />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-52 flex-col border-r border-border bg-bg-elevated px-3 py-6 md:flex">
        <Link to="/" className="mb-10 flex items-center gap-3 px-2">
          <ForgeMark live={researching} />
          <span className="min-w-0">
            <span className="block font-display text-xl leading-none tracking-tight">Efesto</span>
            {owner ? <ActorChip className="mt-1" /> : <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-subtle">Forja</p>}
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {desktopNav.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium uppercase tracking-widest transition-colors duration-150 press",
                  active ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
                )}
              >
                <Icon className={cn("size-4", active ? "text-accent" : "text-muted")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-0.5 border-t border-border pt-3">
          {owner ? (
            <Link
              to="/agentes"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
                pathname === "/agentes" ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              <IconAgents className="size-4" />
              Agentes
            </Link>
          ) : null}
          <Link
            to="/verificar"
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
              pathname === "/verificar" ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            <IconSeal className="size-4" />
            Verificar
          </Link>
          <Link
            to="/uso"
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
              pathname === "/uso" ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            <IconSight className="size-4" />
            Cómo usarlo
          </Link>
          {owner ? (
            <Link
              to="/chat"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
                pathname === "/chat" ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
              )}
            >
              <IconWire className="size-4" />
              Conversación
            </Link>
          ) : null}
          {owner ? (
            <div className="px-3 pt-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-accent">Dueño</p>
              <AuthSlot />
            </div>
          ) : (
            <div className="px-3 pt-3">
              <AuthSlot />
            </div>
          )}
        </div>
      </aside>

      <div className="md:pl-52">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm md:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2 md:hidden">
            <ForgeMark live={researching} className="size-8" />
            <span className="min-w-0">
              <span className="block font-display text-lg leading-none">Efesto</span>
              {owner ? <ActorChip /> : null}
            </span>
          </Link>
          <p className="hidden font-display text-lg tracking-tight md:block">Efesto</p>
          <p className="hidden flex-1 text-center text-sm text-muted lg:block">
            {researching ? "Forjando · el Kernel no inventa el cierre" : "Evidencia primero · el modelo no sella"}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="grid size-11 place-items-center text-muted md:hidden"
              onClick={() => openCommandPalette()}
              aria-label="Buscar"
            >
              <IconSearch className="size-5" />
            </button>
            {owner ? (
              <Link
                to="/settings"
                className="grid size-11 place-items-center text-muted md:hidden"
                aria-label="Ajustes"
              >
                <IconGear className="size-5" />
              </Link>
            ) : null}
            <div className="hidden md:block">
              <AuthSlot />
            </div>
            <div className="md:hidden">
              <AuthSlot compact />
            </div>
            <Link
              to="/"
              hash="composer"
              className="inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg press"
            >
              Forjar
            </Link>
          </div>
        </header>
        <SessionGuard />
        {forging ? (
          <div className="border-b border-border bg-bg-elevated/80 px-4 py-2 backdrop-blur-sm md:px-8">
            <ThinkingBar
              live
              actor="Efesto"
              mode="Forjando"
              line={forging.text}
              goalId={forging.id}
            />
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10">
          {hydrated ? children : <p className="text-sm text-muted">Cargando el núcleo…</p>}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-bg-elevated/95 px-1 py-1 backdrop-blur-sm md:hidden">
        {mobileNav.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon className="size-4" />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

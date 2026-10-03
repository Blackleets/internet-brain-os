import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { OwnerOnly } from "@/components/owner-only";
import { ModelSelector, useSelectedModelStatus } from "@/components/model-selector";
import { IconLock, IconSend } from "@/components/icons";
import { WorkingMark, WorkingStatus } from "@/components/working-status";
import { useKernel } from "@/lib/kernel/store";
import { chatPrivately } from "@/lib/research/functions";
import { isProviderId, PROVIDER_META } from "@/lib/ai/catalog";
import { useAI, useHydrateAI } from "@/lib/ai/store";

type ChatSearch = { q?: string };

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: () => (
    <OwnerOnly>
      <ChatPage />
    </OwnerOnly>
  ),
});

function ChatPage() {
  useHydrateAI();
  const model = useSelectedModelStatus();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const chat = useKernel((s) => s.chat);
  const addChat = useKernel((s) => s.addChat);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootRef = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const value = q?.trim();
    if (!value || bootRef.current === value) return;
    bootRef.current = value;
    navigate({ to: "/chat", search: {}, replace: true });
    void send(value);
  }, [q, navigate]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chat.length, busy]);

  async function send(text: string) {
    const value = text.trim();
    if (value.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    addChat("user", value);
    setDraft("");
    const history = useKernel
      .getState()
      .chat.filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    try {
      const result = await chatPrivately({
        data: { messages: history, selection: useAI.getState().selection() },
      });
      if (!result.ok) {
        setError(result.error);
        addChat(
          "assistant",
          result.status === "BLOCKED"
            ? `No disponible: ${result.error}`
            : `Falló: ${result.error}`,
          result.invocation
            ? { provider: result.invocation.provider, model: result.invocation.model, latencyMs: result.invocation.latencyMs }
            : undefined,
        );
      } else {
        addChat(
          "assistant",
          result.text || "(sin respuesta)",
          result.invocation
            ? { provider: result.invocation.provider, model: result.invocation.model, latencyMs: result.invocation.latencyMs }
            : undefined,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló la conversación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-2xl flex-col md:min-h-[calc(100dvh-8rem)]">
      <PageHeader
        title="Conversación"
        description="Separada del Kernel. Esto no genera evidencia ni memoria."
      />
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {chat.length === 0 ? (
          <Panel className="flex items-start gap-3 p-5">
            <IconLock className="mt-0.5 size-4 text-accent" />
            <p className="text-sm text-muted">
              Empieza cuando quieras. Nada se forja aquí. Si necesitas la web pública,
              usa un objetivo.
            </p>
          </Panel>
        ) : (
          chat.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-8 rounded-lg bg-surface-2 px-4 py-3 text-sm"
                  : "mr-8 rounded-lg bg-surface px-4 py-3 text-sm shadow-border"
              }
            >
              {message.content}
              {message.role === "assistant" && message.model ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-subtle">
                  {(message.provider && isProviderId(message.provider)
                    ? PROVIDER_META[message.provider].label
                    : message.provider) ?? "modelo"}{" "}
                  · {message.model}
                  {typeof message.latencyMs === "number" ? ` · ${message.latencyMs} ms` : ""}
                </p>
              ) : null}
            </div>
          ))
        )}
        {busy ? (
          <WorkingStatus kind="chat" model={model.label} />
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {!model.ready ? (
        <p className="mt-3 text-sm text-muted">
          Sin clave para {model.label}. Esta conversación no investiga la web.{" "}
          <Link to="/settings" className="text-accent">
            Añadir clave
          </Link>
        </p>
      ) : null}
      <form
        className="mt-4 shrink-0 rounded-xl bg-surface p-2 shadow-border"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Escribe sin investigar la web…"
          className="min-h-20 border-0 bg-transparent shadow-none"
        />
        <div className="flex min-w-0 items-center justify-between gap-1 p-1">
          <ModelSelector task="chat" align="up" className="min-w-0 max-w-[min(100%,18rem)]" />
          <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label={busy ? "Forjando" : "Enviar"} className="shrink-0">
            {busy ? <WorkingMark live className="size-5" /> : <IconSend className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

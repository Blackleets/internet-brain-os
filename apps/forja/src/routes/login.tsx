import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ForgeMark } from "@/components/forge-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/panel";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && user) {
    return <Navigate to="/" />;
  }

  async function submitEmail() {
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim(),
              callbackURL: "/",
            })
          : await authClient.signIn.email({
              email: email.trim(),
              password,
              callbackURL: "/",
            });
      if (result.error) {
        setError(result.error.message || "No se pudo entrar.");
        setBusy(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center gap-3">
          <ForgeMark className="size-10" />
          <span>
            <span className="block font-display text-2xl leading-none">Efesto</span>
            <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-subtle">Taller del dueño</span>
          </span>
        </Link>
        <Panel className="p-5">
          <p className="kicker">Entrar</p>
          <h1 className="mt-2 font-display text-2xl tracking-tight">Identidad, no un chat</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Quien forja no necesita cuenta. El taller (claves, agentes, actividad) sí. Google, X o correo.
          </p>
          {authEnabled ? (
            <div className="mt-5 space-y-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
                >
                  Continuar con {provider.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">El acceso está desactivado.</p>
          )}
        </Panel>
        {authEnabled ? (
          <Panel className="p-5">
            <p className="kicker">{mode === "in" ? "Correo" : "Alta"}</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEmail();
              }}
            >
              {mode === "up" ? (
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nombre"
                  autoComplete="name"
                  aria-label="Nombre"
                />
              ) : null}
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Correo"
                autoComplete="email"
                aria-label="Correo"
                required
              />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                aria-label="Contraseña"
                required
                minLength={8}
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy || email.trim().length < 3 || password.length < 8}>
                {busy ? "Entrando…" : mode === "up" ? "Crear cuenta" : "Entrar con correo"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-3 text-sm text-accent"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
              }}
            >
              {mode === "in" ? "No tengo cuenta" : "Ya tengo cuenta"}
            </button>
          </Panel>
        ) : null}
        <p className="text-center text-sm text-subtle">
          <Link to="/" className="text-accent">
            Volver a forjar sin entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

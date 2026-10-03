import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { claimOwner, lockOwner, unlockOwner } from "@/lib/ui/role";
import { useIsOwner, useOwnerClaimed } from "@/lib/ui/use-role";

export function OwnerUnlock({ compact = false }: { compact?: boolean }) {
  const owner = useIsOwner();
  const claimed = useOwnerClaimed();
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (owner) {
    return (
      <Button variant="secondary" size={compact ? "sm" : "default"} onClick={() => lockOwner()}>
        Salir del taller
      </Button>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = claimed ? await unlockOwner(phrase) : await claimOwner(phrase);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setPhrase("");
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        type="password"
        autoComplete="current-password"
        value={phrase}
        onChange={(event) => setPhrase(event.target.value)}
        placeholder={claimed ? "Frase del dueño" : "Elige una frase de dueño"}
        aria-label="Frase del dueño"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || phrase.trim().length < 8}>
          {claimed ? "Entrar al taller" : "Soy el dueño"}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!compact ? (
        <p className="text-xs leading-relaxed text-subtle">
          La frase queda en este navegador. Quien forja no la necesita. No es una cuenta en la nube.
        </p>
      ) : null}
    </form>
  );
}

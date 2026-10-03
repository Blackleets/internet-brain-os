import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot({ compact = false }: { compact?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="size-11 animate-pulse rounded-full bg-surface" aria-hidden />;
  }
  if (!user) {
    return (
      <Link
        to="/login"
        className={
          compact
            ? "grid size-11 place-items-center text-sm text-muted"
            : "inline-flex min-h-11 items-center px-3 text-sm text-muted hover:text-fg"
        }
      >
        Entrar
      </Link>
    );
  }
  return (
    <div className={compact ? "max-w-[9rem] truncate" : "max-w-[12rem]"}>
      <UserButton />
    </div>
  );
}

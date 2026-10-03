import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isOwnerPage, type AppRole } from "./role.ts";

export function useIsOwner() {
  const { user, isPending } = useCurrentUserState();
  return Boolean(user) && !isPending;
}

export function useRole(): AppRole {
  return useIsOwner() ? "owner" : "user";
}

export function useOwnerClaimed() {
  return useIsOwner();
}

export { isOwnerPage };
export type { AppRole };

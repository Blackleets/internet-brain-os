import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/goals")({
  component: () => <Outlet />,
});

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/findings")({
  component: () => <Outlet />,
});

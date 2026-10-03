import { cn } from "@/lib/utils";

export function Hearth({ live = false }: { live?: boolean }) {
  return (
    <div className={cn("hearth", live && "hearth-live")} aria-hidden="true">
      <span className="ember" />
      <span className="ember" />
      <span className="ember" />
      <span className="ember" />
      <span className="ember" />
    </div>
  );
}

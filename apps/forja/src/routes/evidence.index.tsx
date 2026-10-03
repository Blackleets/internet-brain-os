import { createFileRoute, Link } from "@tanstack/react-router";
import { EvidencePanel } from "@/components/evidence-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { IconSeal } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";

export const Route = createFileRoute("/evidence/")({ component: EvidencePage });

function EvidencePage() {
  const evidence = useKernel((s) => s.evidence);
  return (
    <div>
      <PageHeader
        title="Evidencia"
        description="No es lo que el modelo dijo: es lo que se recuperó, con huella y procedencia."
      />
      {evidence.length === 0 ? (
        <EmptyState
          icon={<IconSeal className="size-5" />}
          title="El Kernel no retiene evidencia todavía"
          body="Una pista de búsqueda no entra aquí. Solo páginas públicas recuperadas y admitidas."
          action={
            <Link to="/" className="inline-flex min-h-11 items-center text-sm text-accent">
              Empezar un caso
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {evidence.map((item) => (
            <EvidencePanel key={item.id} evidence={item} />
          ))}
        </div>
      )}
    </div>
  );
}

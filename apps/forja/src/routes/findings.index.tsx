import { createFileRoute, Link } from "@tanstack/react-router";
import { FindingCard } from "@/components/finding-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { IconIngot } from "@/components/icons";
import { useKernel } from "@/lib/kernel/store";

export const Route = createFileRoute("/findings/")({ component: FindingsPage });

function FindingsPage() {
  const findings = useKernel((s) => s.findings);
  return (
    <div>
      <PageHeader
        title="Hallazgos"
        description="Un hallazgo es una interpretación. Solo existe si está ligado a evidencia observada."
      />
      {findings.length === 0 ? (
        <EmptyState
          icon={<IconIngot className="size-5" />}
          title="Todavía no hay hallazgos"
          body="El Kernel no inventa conclusiones. Primero retiene páginas públicas; después, si hay modelo, interpreta."
          action={
            <Link to="/" className="inline-flex min-h-11 items-center text-sm text-accent">
              Forjar un objetivo
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} showGoal />
          ))}
        </div>
      )}
    </div>
  );
}

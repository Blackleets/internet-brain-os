import { FIRST_USE_STEPS } from "@/lib/ui/first-use";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";

export const BRIEFING_KEY = "efesto.briefing.v1";

export function BriefingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  function dismiss() {
    try {
      sessionStorage.setItem(BRIEFING_KEY, "1");
    } catch {
      /* ignore */
    }
    onOpenChange(false);
    window.setTimeout(() => {
      document.getElementById("composer")?.querySelector("textarea")?.focus();
    }, 160);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : dismiss())}>
      <DialogContent
        title="Antes de forjar"
        description="El Kernel lee la web pública. Completado es un punzón, no un spinner. Si la página no cubre el Goal, el caso queda incompleto."
      >
        <ol className="space-y-3">
          {FIRST_USE_STEPS.map((step) => (
            <li key={step.n} className="rounded-lg bg-surface px-4 py-3 shadow-border">
              <p className="kicker">{step.n}</p>
              <p className="mt-1 text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={dismiss}>Entendido, a forjar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Link } from "@tanstack/react-router";
import { Panel } from "./panel";
import { FIRST_USE_STEPS } from "@/lib/ui/first-use";

export function FirstUse() {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-medium text-muted">Primera vez</h2>
        <Link to="/uso" className="text-sm text-accent">
          Cómo usarlo
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {FIRST_USE_STEPS.map((step) => (
          <Panel key={step.n} className="p-5">
            <p className="kicker">{step.n}</p>
            <h3 className="mt-2 text-sm font-medium">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

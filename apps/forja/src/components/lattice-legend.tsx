import type { CSSProperties } from "react";
import { affineOp, compose, latticeRest, toCss, type AffineKind, type ProjectionKind } from "@/lib/motion/mat4";

const STEPS = [
  { n: "01", title: "Recuperado", body: "HTTPS 200 y huella SHA-256. No es un hallazgo." },
  { n: "02", title: "Soporta", body: "La página cubre el Goal. Si no, se queda evidencia." },
  { n: "03", title: "Admitido", body: "Tú lo admites. El chat y Hermes no pueden." },
  { n: "04", title: "Sellado", body: "Completado solo si el Kernel selló. Nunca por un modelo." },
] as const;

export function LatticeLegend({
  projection = "perspective",
  affine = "identity",
}: {
  projection?: ProjectionKind;
  affine?: AffineKind;
}) {
  const ortho = projection === "ortho";
  const composed = affine !== "identity";
  return (
    <section className="enter-up enter-up-3">
      <p className="kicker">Lattice del Kernel</p>
      <ol className="lattice mt-3" data-projection={projection}>
        {STEPS.map((step, index) => (
          <li key={step.n} className="lattice-cell">
            <span
              className="lattice-step"
              title={step.body}
              tabIndex={0}
              style={{ "--rest": toCss(compose(affineOp(affine), latticeRest(index))) } as CSSProperties}
            >
              <span className="lattice-n">{step.n}</span>
              {step.title}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        {composed
          ? "Afín: x′ = Ax + t. Última fila (0,0,0,1). Conserva paralelas y el punto medio. No conserva ángulos (salvo rotación pura)."
          : ortho
            ? "Ortográfica: la última fila es (0,0,0,1). w no depende de Z. Las paralelas siguen paralelas; un chip lejano no se encoge."
            : "Perspectiva: w ∝ Z. Hay punto de fuga. Un HTTP 200 no cierra el caso — jwt.io se queda evidencia."}
      </p>
    </section>
  );
}

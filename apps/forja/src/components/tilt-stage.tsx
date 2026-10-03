import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useRef } from "react";
import { IDENTITY_CSS, tiltMatrix, toCss, type ProjectionKind } from "@/lib/motion/mat4";
import { cn } from "@/lib/utils";

export function TiltStage({
  className,
  children,
  max = 8,
  projection = "perspective",
}: {
  className?: string;
  children: ReactNode;
  max?: number;
  projection?: ProjectionKind;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function tilt(event: MouseEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty("--m", toCss(tiltMatrix(x, y, max)));
  }

  function reset() {
    ref.current?.style.setProperty("--m", IDENTITY_CSS);
  }

  return (
    <div
      ref={ref}
      className={cn("tilt-stage", className)}
      data-projection={projection}
      style={{ "--m": IDENTITY_CSS } as CSSProperties}
      onMouseMove={tilt}
      onMouseLeave={reset}
    >
      {children}
    </div>
  );
}

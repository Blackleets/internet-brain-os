import { useState } from "react";
import { AffineSwitch } from "./affine-switch";
import { LatticeLegend } from "./lattice-legend";
import { ProjectionSwitch } from "./projection-switch";
import { Dialog, DialogContent } from "./ui/dialog";
import type { AffineKind, ProjectionKind } from "@/lib/motion/mat4";

export function TallerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [projection, setProjection] = useState<ProjectionKind>("perspective");
  const [affine, setAffine] = useState<AffineKind>("identity");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Taller de proyección"
        description="Matrices 4×4 del lattice. No cambia el Kernel: Completado sigue siendo un sello."
      >
        <div className="space-y-4">
          <ProjectionSwitch value={projection} onChange={setProjection} />
          <AffineSwitch value={affine} onChange={setAffine} />
          <LatticeLegend projection={projection} affine={affine} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

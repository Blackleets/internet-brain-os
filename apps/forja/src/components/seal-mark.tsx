import { cn } from "@/lib/utils";

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function wedge(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r1, a0);
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r0, a1);
  const p3 = polar(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r1} ${r1} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} A ${r0} ${r0} 0 ${large} 0 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} Z`;
}

/** Cryptographic seal — geometry derived from the dossier hash, not decoration. */
export function SealMark({
  hash,
  className,
}: {
  hash: string;
  className?: string;
}) {
  const hex = hash.toLowerCase().replace(/[^0-9a-f]/g, "").padEnd(12, "0");
  const wedges = Array.from({ length: 12 }, (_, i) => {
    const n = Number.parseInt(hex[i] ?? "0", 16);
    const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
    return {
      d: wedge(16, 16, 7.2, 13.6, a0, a1),
      opacity: 0.18 + (n / 15) * 0.82,
    };
  });

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-12 shrink-0 text-accent", className)}
      aria-hidden
    >
      <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
      {wedges.map((item, i) => (
        <path key={i} d={item.d} fill="currentColor" opacity={item.opacity} />
      ))}
      <circle cx="16" cy="16" r="6.2" fill="#0b0a09" />
      <circle cx="16" cy="16" r="6.2" fill="none" stroke="currentColor" strokeWidth="0.9" />
      <circle cx="16" cy="16" r="1.35" fill="currentColor" />
    </svg>
  );
}

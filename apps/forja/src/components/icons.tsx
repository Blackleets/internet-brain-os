import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ className, title, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** London anvil + blade — home / forge */
export function IconForge(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12.6 9.6 12 9.6 10.7 17.8 10.7 20.2 12 20.2 13.7 17.2 14.5 16.1 17.6 21 18.2 21.2 21.2 4.2 21.2 4.4 18.2 9.4 17.6 9 14.5 9.6 13.6 3.5 13.5Z" />
      <path d="M7.4 9.2h9.6l1.7.9-1.7.9H7.4z" />
      <path d="M6.8 8.2v3.8M4.6 10.1h2.2" />
    </Svg>
  );
}

/** Hearth flame — calda */
export function IconCalda(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.8c2.6 3.4 4.4 6.1 4.4 9.1a4.4 4.4 0 0 1-8.8 0c0-3 1.8-5.7 4.4-9.1z" />
      <path d="M12 9.2c1.05 1.4 1.55 2.5 1.55 3.7a1.55 1.55 0 1 1-3.1 0c0-1.2.5-2.3 1.55-3.7z" />
      <path d="M6.5 19.2h11M8 21.2h8" />
    </Svg>
  );
}

/** London anvil — yunque */
export function IconAnvil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 11.8 9.4 11.2 9.4 9.6 18.2 9.6 21.2 11.4 21.2 13.4 17.6 14.4 16.4 17.8 21.4 18.4 21.6 21.2 3.4 21.2 3.6 18.4 8.8 17.8 8.2 14.4 9.2 13.2 2.8 13.1Z" />
    </Svg>
  );
}

/** Quench trough — temple */
export function IconTemple(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7.2h14" />
      <path d="M6.2 7.2v3.2c0 4.2 2.5 7.4 5.8 7.4s5.8-3.2 5.8-7.4V7.2" />
      <path d="M8.4 12.2h7.2" />
    </Svg>
  );
}

/** Maker's punch — contraste */
export function IconPunch(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.2 3.8h3.6v8.2h-3.6z" />
      <path d="M6.2 12h11.6v4.2H6.2z" />
      <path d="M8.2 18.6h7.6" />
    </Svg>
  );
}

/** Surveyor reticle — goals */
export function IconSight(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.25" />
      <path d="M12 3.5v2.75M12 17.75v2.75M3.5 12h2.75M17.75 12h2.75" />
    </Svg>
  );
}

/** Ingot — findings */
export function IconIngot(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 8h9l2.5 8.5H5L7.5 8z" />
      <path d="M8.5 12h7" />
    </Svg>
  );
}

/** Wax seal — evidence */
export function IconSeal(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="11" r="6" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M9.25 16.25 8 20.5 12 19.25 16 20.5l-1.25-4.25" />
    </Svg>
  );
}

/** Filing drawers — memory */
export function IconVault(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="4.5" width="14" height="15" rx="1.5" />
      <path d="M5 9.5h14M5 14.5h14" />
      <path d="M11 7h2M11 12h2M11 17h2" />
    </Svg>
  );
}

/** Spine ledger — activity */
export function IconLedger(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 5v14" />
      <path d="M7 7.5h11M7 12h8.5M7 16.5h10" />
      <circle cx="7" cy="7.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="7" cy="16.5" r="1.05" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Private wire — conversation */
export function IconWire(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.5" cy="12" r="2.25" />
      <circle cx="17.5" cy="12" r="2.25" />
      <path d="M8.75 12h6.5" />
    </Svg>
  );
}

/** Hex nut — settings */
export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 19 8v8l-7 4-7-4V8l7-4z" />
      <circle cx="12" cy="12" r="2.4" />
    </Svg>
  );
}

/** Three-node kernel — agents */
export function IconAgents(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.5" cy="12" r="2.2" />
      <circle cx="17.5" cy="6.5" r="2.2" />
      <circle cx="17.5" cy="17.5" r="2.2" />
      <path d="M8.5 11.2 15.4 7.4M8.5 12.8 15.4 16.6M17.5 8.7v6.6" />
    </Svg>
  );
}

/** Folded brief — dossier */
export function IconDossier(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4.5h8l4 4V19.5H7z" />
      <path d="M15 4.5V8.5h4" />
      <circle cx="12" cy="14" r="2.15" />
    </Svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 16V8.75M9 11.25 12 8.25 15 11.25" />
    </Svg>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 6.5H6.5A2 2 0 0 0 4.5 8.5v9A2 2 0 0 0 6.5 19.5h9a2 2 0 0 0 2-2V14" />
      <path d="M13.5 4.5h6v6M19.5 4.5 11 13" />
    </Svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.5 10c0-2.25 1.5-4.25 3.5-4.25S15.5 7.75 15.5 10c0 3.25-3.5 7.5-3.5 7.5S8.5 13.25 8.5 10z" />
      <circle cx="12" cy="10" r="1.25" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 12.25 9.75 16.5 18.5 7.75" />
    </Svg>
  );
}

export function IconWatch(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.75 12s3-6 8.25-6 8.25 6 8.25 6-3 6-8.25 6-8.25-6-8.25-6z" />
      <circle cx="12" cy="12" r="2.25" />
    </Svg>
  );
}

/** Filament — inspecting / planning */
export function IconLamp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.4 10.2a3.7 3.7 0 1 1 7.2 0c0 1.35-.7 2.2-1.5 3.05-.5.52-.8 1.1-.8 1.75H10.7c0-.65-.3-1.23-.8-1.75-.8-.85-1.5-1.7-1.5-3.05z" />
      <path d="M10.5 16.2h3M10.8 18.4h2.4" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16 20 20" />
    </Svg>
  );
}

export function IconExport(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v9.25M8.75 8.25 12 5 15.25 8.25" />
      <path d="M5.5 14.75v3A1.5 1.5 0 0 0 7 19.25h10a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </Svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12a7 7 0 1 1-2-5" />
      <path d="M19 5.25v4.25h-4.25" />
    </Svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6 15 12 9 18" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5 4 19h16L12 5z" />
      <path d="M12 10.5v4" />
      <circle cx="12" cy="16.75" r="0.7" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6.5" y="11" width="11" height="8" rx="1.5" />
      <path d="M8.75 11V8.5a3.25 3.25 0 0 1 6.5 0V11" />
    </Svg>
  );
}

export function IconHash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 5.5 8 18.5M16 5.5 14.5 18.5M5.5 9.5h13.5M5 14.5h13.5" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5v11M6.5 12h11" />
    </Svg>
  );
}

export function IconCross(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 7l10 10M17 7 7 17" />
    </Svg>
  );
}

export function IconDot(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

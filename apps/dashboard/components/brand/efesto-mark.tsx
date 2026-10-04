import { useId } from 'react';

/**
 * EFESTO logo C, "Llama de nodos": a forge flame drawn as a node graph with a gold core and a
 * hearth line. Same geometry as public/brand/efesto-mark.svg (the SVG source of truth).
 * Decorative by default (aria-hidden); pass a title to expose it as an image.
 */
const P: ReadonlyArray<readonly [number, number]> = [[33.5, 3.5], [38.5, 15.5], [46.5, 28], [46, 41.5], [39, 51.5], [32, 55], [25, 51.5], [18, 41.5], [18.5, 29], [27.5, 23], [33.5, 25], [37.5, 36.5], [27, 38], [32, 46.5], [21.5, 17.5], [30.5, 13.5]];
const OUTLINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 9, 15, 0];
const INNER_FULL = [[15, 10], [1, 10], [9, 10], [10, 11], [10, 12], [8, 12], [9, 12], [2, 11], [3, 11], [11, 13], [12, 13], [7, 12], [4, 13], [6, 13], [5, 13], [11, 12], [8, 9]] as const;
const INNER_SIMPLE = [[15, 10], [10, 11], [10, 12], [11, 13], [12, 13], [5, 13]] as const;
const SHOW_SIMPLE = [0, 2, 5, 8, 14, 10, 11, 12, 13];
const FLAME = OUTLINE.map((index, k) => `${k ? 'L' : 'M'}${P[index][0]} ${P[index][1]}`).join('') + 'Z';
const GOLD = '#F5C451';
const EMBER = '#EE8748';
const MOLTEN = '#FF7A2A';

export function EfestoMark({ size = 32, simple = false, title, className }: { size?: number; simple?: boolean; title?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const inner = simple ? INNER_SIMPLE : INNER_FULL;
  const show = simple ? SHOW_SIMPLE : P.map((_, index) => index);
  return <svg className={className} viewBox="0 0 64 64" width={size} height={size} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false">
    <defs>
      <linearGradient id={`${id}f`} x1="0" y1="55" x2="0" y2="5" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={MOLTEN} stopOpacity=".34" /><stop offset=".6" stopColor={GOLD} stopOpacity=".12" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></linearGradient>
      <linearGradient id={`${id}e`} x1="0" y1="55" x2="0" y2="5" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={GOLD} /><stop offset="1" stopColor={EMBER} /></linearGradient>
      <radialGradient id={`${id}c`}><stop offset="0" stopColor="#FFF3DA" /><stop offset=".55" stopColor={GOLD} /><stop offset="1" stopColor={MOLTEN} /></radialGradient>
      <radialGradient id={`${id}g`} cx="32" cy="44" r="22" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={MOLTEN} stopOpacity=".6" /><stop offset="1" stopColor={MOLTEN} stopOpacity="0" /></radialGradient>
    </defs>
    <circle cx="32" cy="44" r="22" fill={`url(#${id}g)`} />
    <path d={FLAME} fill={`url(#${id}f)`} />
    <g fill="none" stroke={`url(#${id}e)`} strokeLinecap="round" strokeLinejoin="round">
      <path d={FLAME} strokeWidth={simple ? 2.4 : 1.6} />
      <g strokeWidth={simple ? 1.9 : 1} opacity=".85">{inner.map(([a, b]) => <path key={`${a}-${b}`} d={`M${P[a][0]} ${P[a][1]}L${P[b][0]} ${P[b][1]}`} />)}</g>
    </g>
    {show.map((index) => {
      const [cx, cy] = P[index];
      const core = index === 13;
      const goldNode = index === 0 || (index >= 10 && index <= 12);
      const r = (core ? 3.2 : index === 0 ? 2.5 : index >= 10 && index <= 12 ? 1.9 : 1.5) + (simple ? .7 : 0);
      return <circle key={index} cx={cx} cy={cy} r={r} fill={core ? `url(#${id}c)` : goldNode ? GOLD : EMBER} />;
    })}
    <path d="M21 59.5H43" stroke={EMBER} strokeWidth={simple ? 2.4 : 1.5} strokeLinecap="round" opacity=".7" />
  </svg>;
}

/** Mark + wordmark lockup used by the sidebar and the phone header. */
export function EfestoLockup({ size = 36, compact = false }: { size?: number; compact?: boolean }) {
  return <span className={'efesto-lockup' + (compact ? ' is-compact' : '')}>
    <EfestoMark size={size} />
    <span className="efesto-lockup-words"><strong>EFESTO</strong>{compact ? null : <small>The Intelligence Forge</small>}</span>
  </span>;
}

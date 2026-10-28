// 統一ゲームアイコン（自作SVG）。emoji の代わりに UI 全体で使う。
// 24x24 / 線＋うすい塗りの 2 トーン。色は currentColor に追従する。
import type { SVGProps } from 'react';

const P = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  map: <><path d="M3 6.5 9 4l6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" /><path d="M9 4v14M15 6.5v13.5" /></>,
  cards: <>
    <rect x="3.5" y="5.5" width="11" height="14.5" rx="2" transform="rotate(-9 9 12.75)" />
    <rect x="9.5" y="4" width="11" height="14.5" rx="2" transform="rotate(9 15 11.25)" />
    <path d="m15 8.3.8 1.7 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z" />
  </>,
  deck: <><path d="M12 3 3 8l9 5 9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 16.5 9 5 9-5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3.5M8.5 20h7M9.5 17.5h5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.8M12 17h.01" /></>,
  work: <><rect x="3" y="7.5" width="18" height="12" rx="2.2" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3 12.5h18M11 12.5v2h2v-2" /></>,
  rest: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /><path d="M15.5 4.5h3l-3 3.5h3" /></>,
  train: <><path d="M6 8v8M3.5 10v4M18 8v8M20.5 10v4M6 12h12" /></>,
  ticket: <><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5V10a2 2 0 0 0 0 4v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5V14a2 2 0 0 0 0-4z" /><path d="M14.5 7.5v2M14.5 11v2M14.5 14.5v2" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="m9 7.8 3 4.4 3-4.4M12 12.2V17M9.6 13.2h4.8M9.6 15h4.8" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l9-11.5h-6z" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  star: <path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z" />,
  pin: <><path d="M12 21s6.5-5.7 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15.3 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></>,
  plane: <><path d="m21 3-18 7.5 6 2.5 2.5 6z" /><path d="M9 13 21 3" /></>,
  rail: <><rect x="5" y="3.5" width="14" height="14" rx="3.2" /><path d="M5 11h14M9 21l2-3.5M15 21l-2-3.5M8.5 14.2h.01M15.5 14.2h.01" /></>,
  bus: <><rect x="4" y="4" width="16" height="13" rx="2.5" /><path d="M4 11h16M7 20v-3M17 20v-3M8 14.2h.01M16 14.2h.01" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  sparkle: <path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />,
  stamp: <><circle cx="12" cy="9" r="5" /><path d="M4 20h16M7 20v-2.5a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 17 17.5V20" /></>,
  note: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  swords: <><path d="m5 4 9 9M4 5l1-1M19 4l-9 9M20 5l-1-1M8 14l-3 3M16 14l3 3M4.5 18.5l2 2M19.5 18.5l-2 2" /></>,
  link: <><path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" /><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" /></>,
  cafe: <><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H15.5M8 3.5v2.5M12 3.5v2.5" /></>,
  shrine: <><path d="M3 7.5c3 1.5 15 1.5 18 0M5 11h14M7 7.5V20M17 7.5V20M5 20h14" /></>,
  record: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" /><path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5" /></>,
  park: <><path d="M12 3 6.5 12h3L5.5 18h13l-4-6h3z" /><path d="M12 18v3" /></>,
  market: <><path d="M4 9.5 5.5 4h13L20 9.5a3 3 0 0 1-5.3 1.9 3 3 0 0 1-5.4 0A3 3 0 0 1 4 9.5z" /><path d="M5.5 12.5V20h13v-7.5" /></>,
  aquarium: <><path d="M3 12c3-5 8-6 11-4l-2 4 2 4c-3 2-8 1-11-4z" /><path d="m14 8 7-2v12l-7-2M7 11.2h.01" /></>,
  castle: <><path d="M4 20V10l2-1.5V6m3 0v3.5m0 0h6m0 0V6m3 0v2.5L20 10v10zM10 20v-4a2 2 0 0 1 4 0v4" /></>,
  museum: <><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 20h17" /></>,
  station: <><path d="M3 18c3 0 4-3 9-3s6 3 9 3M12 4v11M7 9h10" /></>,
  livehouse: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size, className, style, ...rest }: { name: IconName; size?: number | string; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} style={size ? { width: size, height: size, ...style } : style} fill="currentColor" fillOpacity=".13"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={`ico${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false" {...rest}
    >
      {P[name]}
    </svg>
  );
}

/** 移動手段の文字 → アイコン */
export const modeIcon = (mode: string): IconName => (mode.includes('飛行機') ? 'plane' : mode.includes('バス') ? 'bus' : 'rail');

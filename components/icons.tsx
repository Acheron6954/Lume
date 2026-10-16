const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  users: "M16 20v-1.2a4.3 4.3 0 0 0-4.3-4.3H7.3A4.3 4.3 0 0 0 3 18.8V20M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.2a4.3 4.3 0 0 0-3-4.1M15.5 4.7a3.5 3.5 0 0 1 0 6.6",
  mail: "M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6",
  out: "M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h9",
  warn: "M12 4.2 21 19.5H3zM12 10v4.2M12 16.6v.4",
  check: "m5 12.5 4.5 4.5L19 7.5",
  close: "m6 6 12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  undo: "M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12",
  ig: "M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 7.2v.1",
  tt: "M14 4v10.2a3.2 3.2 0 1 1-3.2-3.2M14 4c.3 2.3 1.9 3.9 4.2 4.1",
  radar: "M19.07 4.93A10 10 0 0 0 6.99 3.34M4 6h.01M2.29 9.62A10 10 0 1 0 21.31 8.35M16.24 7.76A6 6 0 1 0 8.23 16.67M12 18h.01M17.99 11.66A6 6 0 0 1 15.77 16.67M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13.41 10.59l5.66-5.66",
  userx: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM17 8l5 5M22 8l-5 5",
  mailcheck: "M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7M16 19l2 2 4-4",
  plus: "M12 5v14M5 12h14",
  repeat: "m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  pen: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const PATHS = {
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  folderOpen: "M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1M3 7v10a2 2 0 0 0 2 2h12l4-8H7l-4 8",
  more: "M4.5 12h1M11.5 12h1M18.5 12h1",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  plus: "M12 5v14M5 12h14",
  filePlus: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6",
  folderPlus: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10v6M9 13h6",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4",
  close: "M6 6l12 12M18 6L6 18",
  collapse: "M7 4l5 5 5-5M7 20l5-5 5 5",
  sidebar: "M4 4h16v16H4zM9 4v16",
  editor: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5",
  split: "M4 4h16v16H4zM12 4v16",
  preview: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  theme: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  files: "M9 3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V10zM9 3v7h7M13 3h4l4 4v10",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  branch: "M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 7v10M18 9c0 5-12 3-12 8",
  minus: "M5 12h14",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  warning: "M12 3l10 18H2zM12 10v4M12 17.5v.5",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  logo: "M4 17V7h2.5l3 4 3-4H15v10h-2.5v-6l-3 4-3-4v6zM17 7h2.5v6H21l-3 4-3-4h2z",
  // Formatting toolbar
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h8M6 19h8M14 5l-4 14",
  strikethrough: "M4 12h16M16.5 7.5C16 5.6 14.2 5 12 5c-2.8 0-4.5 1.3-4.5 3.2 0 1.4.9 2.3 2.5 2.8M8 16.5c.5 1.8 2.2 2.5 4.3 2.5 2.8 0 4.7-1.3 4.7-3.3 0-.6-.1-1.1-.4-1.7",
  code: "M9 8l-4 4 4 4M15 8l4 4-4 4",
  listBullet: "M10 6h10M10 12h10M10 18h10M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  listOrdered: "M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14h3l-3 4h3",
  listTask: "M11 6h9M11 12h9M11 18h9M3.5 6l1.5 1.5L8 4.5M3.5 11h4v4h-4z",
  quote: "M6 10h4v5a3 3 0 0 1-3 3M6 10V7M14 10h4v5a3 3 0 0 1-3 3M14 10V7",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9h.01",
  table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  codeBlock: "M4 4h16v16H4zM10 10l-2 2 2 2M14 10l2 2-2 2",
  rule: "M4 12h16M4 7h4M4 17h4M16 7h4M16 17h4",
  footnote: "M5 7h9M5 12h9M5 17h6M18 4v5M16.5 5l1.5-1",
  toc: "M4 6h2M9 6h11M6 12h2M11 12h9M6 18h2M11 18h9",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

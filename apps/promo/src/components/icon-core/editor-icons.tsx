import type { ReactNode } from 'react';

/**
 * Line glyphs used by the editor showcase and the get-it strip. Inline SVG on purpose:
 * the promo app ships without an icon dependency, so each glyph is a path here. The
 * existing `icons.tsx` stays for the sections that predate the showcase.
 */
type IconProps = { className?: string };

function Line({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="m6 9 6 6 6-6" />
    </Line>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="m9 6 6 6-6 6" />
    </Line>
  );
}

/** Selection frame: four corner brackets. */
export function FrameIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M15 4h4a1 1 0 0 1 1 1v4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
      <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
    </Line>
  );
}

export function SquareIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </Line>
  );
}

/** Circle and square superimposed: the two keyline standards. */
export function ScanIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <circle cx="12" cy="12" r="7" />
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </Line>
  );
}

export function PackageIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </Line>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Line>
  );
}

export function UnlockIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </Line>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Line>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M4 4 20 20" />
      <path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4" />
      <path d="M6.2 6.3A17.3 17.3 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Line>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
    </Line>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M4 7h16" />
      <path d="M10 4h4l1 3H9l1-3Z" />
      <path d="M6 7l.8 12a2 2 0 0 0 2 1.9h6.4a2 2 0 0 0 2-1.9L18 7" />
      <path d="M10 11v6M14 11v6" />
    </Line>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  );
}

export function MinusIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M5 12h14" />
    </Line>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Line>
  );
}

export function PanelLeftIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Line>
  );
}

export function PanelRightIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </Line>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h9a6 6 0 0 1 0 12h-3" />
    </Line>
  );
}

export function RedoIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9h-9a6 6 0 0 0 0 12h3" />
    </Line>
  );
}

/** Three sliders on a horizontal rail. */
export function SlidersIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M4 7h5M15 7h5M4 17h9M19 17h1" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
    </Line>
  );
}

export function CursorIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M5 4l6.5 16 2.4-6.6L20.5 11 5 4Z" />
    </Line>
  );
}

export function HandIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V7.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-3.6-1.5L4 16.4a1.6 1.6 0 0 1 2.3-2.2L8 15.5" />
    </Line>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" />
    </Line>
  );
}

export function DashedSquareIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" strokeDasharray="2.4 2.4" />
    </Line>
  );
}

/** Check mark: the "on" state of a checkbox menu item. */
export function CheckIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Line>
  );
}

export function MaximizeIcon({ className }: IconProps) {
  return (
    <Line className={className}>
      <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5" />
    </Line>
  );
}

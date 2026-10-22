/**
 * Joins class names, dropping empty entries. Class lists here never conflict, so a
 * plain join is enough and the app needs no clsx/tailwind-merge dependency.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

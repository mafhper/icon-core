import type { DesktopOS } from './site-config';

export type OS = DesktopOS | 'ios' | 'android' | 'unknown';

/** Detects the visitor's operating system from browser hints. Pure, so it can be tested. */
export function detectOS(userAgent: string, platform = '', maxTouchPoints = 0): OS {
  const s = `${userAgent} ${platform}`.toLowerCase();
  if (s.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  // iPadOS reports itself as a Mac but has a touch screen.
  if (/mac/.test(s) && maxTouchPoints > 1) return 'ios';
  if (/windows|win32|win64/.test(s)) return 'windows';
  if (/mac/.test(s)) return 'macos';
  if (/linux|x11|cros/.test(s)) return 'linux';
  return 'unknown';
}

/** Which desktop installer to suggest. Phones and unknown systems get none (web app instead). */
export function suggestedDesktopTarget(os: OS): DesktopOS | null {
  return os === 'windows' || os === 'macos' || os === 'linux' ? os : null;
}

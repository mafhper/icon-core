import { describe, expect, it } from 'vitest';

import { detectOS, suggestedDesktopTarget } from './platform';

const UA = {
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  linux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

describe('download OS detection', () => {
  it('offers the Windows installer on Windows', () => {
    expect(suggestedDesktopTarget(detectOS(UA.windows))).toBe('windows');
  });

  it('offers the macOS installer on a Mac', () => {
    expect(suggestedDesktopTarget(detectOS(UA.mac, 'MacIntel', 0))).toBe('macos');
  });

  it('offers the Linux installer on Linux', () => {
    expect(suggestedDesktopTarget(detectOS(UA.linux))).toBe('linux');
  });

  it('does not offer a desktop installer on Android (Linux in UA)', () => {
    expect(detectOS(UA.android)).toBe('android');
    expect(suggestedDesktopTarget('android')).toBeNull();
  });

  it('does not offer a desktop installer on iPhone or iPad', () => {
    expect(suggestedDesktopTarget(detectOS(UA.iphone))).toBeNull();
    expect(detectOS(UA.mac, 'MacIntel', 5)).toBe('ios');
  });
});

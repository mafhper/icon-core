import { useState } from 'react';

import { detectOS, type OS } from '../lib/platform';

/** Visitor OS. The promo app is client-only, so detection runs before the first paint. */
export function useDetectedOS(): OS {
  const [os] = useState<OS>(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return detectOS(nav.userAgent, nav.userAgentData?.platform ?? nav.platform ?? '', nav.maxTouchPoints ?? 0);
  });

  return os;
}

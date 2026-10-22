import { useState } from 'react';

import { detectOS, type OS } from '../lib/platform';

/** Visitor OS. The promo app is client-only, so detection runs before the first paint. */
export function useDetectedOS(): OS {
  const [os] = useState<OS>(() => {
    // The sections also render server-side (static build): there is no user agent there,
    // and "unknown" is the honest answer — it shows the neutral call to action.
    if (typeof navigator === 'undefined') return 'unknown';

    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return detectOS(nav.userAgent, nav.userAgentData?.platform ?? nav.platform ?? '', nav.maxTouchPoints ?? 0);
  });

  return os;
}

import { cloneElement, isValidElement, type ReactNode } from 'react';

/**
 * Icon stroke follows the weight of the text beside it (better-ui): an icon next
 * to regular text carries 1.5px, next to semibold it carries 2px. One stroke
 * weight per icon set and one icon library per surface — the component owns the
 * rule, so an icon never decides its own weight.
 */
export type IconTextWeight = 'regular' | 'semibold';

export const iconStrokeFor = (weight: IconTextWeight): number => (weight === 'semibold' ? 2 : 1.5);

/** Clone an icon element with the stroke matching `weight` (no-op for non-elements). */
export const withIconStroke = (icon: ReactNode, weight: IconTextWeight = 'regular'): ReactNode =>
  isValidElement<{ strokeWidth?: number }>(icon) ? cloneElement(icon, { strokeWidth: iconStrokeFor(weight) }) : icon;

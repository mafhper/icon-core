import { clsx, type ClassValue } from 'clsx';
import { twMerge } from './tw-merge';

/**
 * Merge Tailwind class names, resolving conflicts deterministically
 * (last conflicting utility wins via the UI-specific tailwind-merge config).
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
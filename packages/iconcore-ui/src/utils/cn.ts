import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names, resolving conflicts deterministically
 * (last conflicting utility wins via tailwind-merge).
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
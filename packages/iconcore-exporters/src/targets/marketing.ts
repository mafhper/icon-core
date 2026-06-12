import type { TargetDefinition } from '../types';

export const marketing: TargetDefinition = {
  id: 'marketing',
  name: 'Marketing',
  tasks: [
    { path: 'marketing/icon-1024.png', width: 1024, height: 1024, transparent: false },
    { path: 'marketing/icon-512.png', width: 512, height: 512, transparent: false },
    { path: 'marketing/icon-256.png', width: 256, height: 256, transparent: false },
    { path: 'marketing/transparent.png', width: 512, height: 512, transparent: true }
  ]
};
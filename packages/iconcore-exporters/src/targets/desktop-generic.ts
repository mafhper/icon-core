import type { TargetDefinition } from '../types';

export const desktopGeneric: TargetDefinition = {
  id: 'desktop-generic',
  name: 'Desktop (Generic)',
  tasks: [
    { path: 'linux/16x16.png', width: 16, height: 16, transparent: false },
    { path: 'linux/32x32.png', width: 32, height: 32, transparent: false },
    { path: 'linux/48x48.png', width: 48, height: 48, transparent: false },
    { path: 'linux/64x64.png', width: 64, height: 64, transparent: false },
    { path: 'linux/128x128.png', width: 128, height: 128, transparent: false },
    { path: 'linux/256x256.png', width: 256, height: 256, transparent: false },
    { path: 'linux/512x512.png', width: 512, height: 512, transparent: false }
  ]
};
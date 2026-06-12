import type { TargetDefinition } from '../types';

export const electron: TargetDefinition = {
  id: 'electron',
  name: 'Electron',
  tasks: [
    { path: 'build/icon.png', width: 512, height: 512, transparent: false },
    { path: 'build/icons/256x256.png', width: 256, height: 256, transparent: false },
    { path: 'build/icons/512x512.png', width: 512, height: 512, transparent: false }
  ]
};
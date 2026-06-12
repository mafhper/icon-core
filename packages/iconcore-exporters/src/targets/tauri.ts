import type { TargetDefinition } from '../types';

export const tauri: TargetDefinition = {
  id: 'tauri',
  name: 'Tauri App',
  tasks: [
    { path: '32x32.png', width: 32, height: 32, transparent: false },
    { path: '128x128.png', width: 128, height: 128, transparent: false },
    { path: '128x128@2x.png', width: 256, height: 256, transparent: false },
    { path: 'icon.png', width: 512, height: 512, transparent: false }
  ]
};
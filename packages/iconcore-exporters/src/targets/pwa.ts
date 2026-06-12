import type { TargetDefinition } from '../types';

export const pwa: TargetDefinition = {
  id: 'pwa',
  name: 'PWA Icons',
  tasks: [
    { path: 'icons/icon-192x192.png', width: 192, height: 192, transparent: false },
    { path: 'icons/icon-512x512.png', width: 512, height: 512, transparent: false },
    { path: 'icons/icon-maskable-192x192.png', width: 192, height: 192, transparent: false },
    { path: 'icons/icon-maskable-512x512.png', width: 512, height: 512, transparent: false }
  ],
  manifest: (project) => ({
    name: project.metadata.name,
    short_name: project.metadata.shortName,
    description: project.metadata.description ?? '',
    start_url: '/',
    display: 'standalone',
    icons: [
      { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  })
};
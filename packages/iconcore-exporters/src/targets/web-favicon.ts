import type { TargetDefinition } from '../types';

export const webFavicon: TargetDefinition = {
  id: 'web-favicon',
  name: 'Web Favicon',
  tasks: [
    { path: 'favicon-16x16.png', width: 16, height: 16, transparent: false },
    { path: 'favicon-32x32.png', width: 32, height: 32, transparent: false },
    { path: 'favicon-48x48.png', width: 48, height: 48, transparent: false },
    { path: 'apple-touch-icon.png', width: 180, height: 180, transparent: false },
    { path: 'apple-touch-icon-152x152.png', width: 152, height: 152, transparent: false },
    { path: 'apple-touch-icon-120x120.png', width: 120, height: 120, transparent: false }
  ],
  manifest: (project) => ({
    name: project.metadata.name,
    short_name: project.metadata.shortName,
    icons: [
      { src: 'favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { src: 'favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: 'favicon-48x48.png', sizes: '48x48', type: 'image/png' }
    ]
  })
};
import type { IconCoreProject } from '@iconcore/shared';
import { writeFileSync } from 'fs';

const PRESETS: Record<string, Partial<IconCoreProject>> = {
  tauri: {
    canvas: { size: 512, background: { kind: 'solid', color: '#1a1a2e' } },
    targets: [{ target: 'tauri', enabled: true }]
  },
  pwa: {
    canvas: { size: 512, background: { kind: 'solid', color: '#1a73e8' } },
    targets: [{ target: 'pwa', enabled: true }]
  },
  web: {
    canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
    targets: [{ target: 'web-favicon', enabled: true }]
  },
  electron: {
    canvas: { size: 512, background: { kind: 'solid', color: '#2d2d2d' } },
    targets: [{ target: 'electron', enabled: true }]
  }
};

export const createCommand = async (args: string[]): Promise<void> => {
  const preset = args.find(a => a.startsWith('--preset='))?.split('=')[1] ?? 'web';
  const name = args.find(a => a.startsWith('--name='))?.split('=')[1] ?? 'My Icon';
  const color = args.find(a => a.startsWith('--color='))?.split('=')[1];
  const out = args.find(a => a.startsWith('--out='))?.split('=')[1] ?? `./${name.toLowerCase().replace(/\s+/g, '-')}.iconcore.json`;

  const presetConfig = PRESETS[preset];
  if (!presetConfig) {
    throw new Error(`Unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(', ')}`);
  }

  const project: IconCoreProject = {
    schemaVersion: 2,
    metadata: { name, shortName: name },
    canvas: {
      size: presetConfig.canvas?.size ?? 512,
      background: color
        ? { kind: 'solid', color }
        : presetConfig.canvas?.background ?? { kind: 'solid', color: '#ffffff' }
    },
    layers: [],
    variants: { default: {} },
    targets: presetConfig.targets ?? [{ target: 'web-favicon', enabled: true }],
    exportProfile: {
      outputBaseName: name.toLowerCase().replace(/\s+/g, '-'),
      quality: 0.95,
      generateReport: false
    }
  };

  writeFileSync(out, JSON.stringify(project, null, 2));
  console.log(`✅ Created project: ${out}`);
  console.log(`   Preset: ${preset}`);
  console.log(`   Name: ${name}`);
  console.log(`   Canvas: ${project.canvas.size}x${project.canvas.size}`);
};
import { describe, expect, it } from 'vitest';
import { buildTargetPlan, migrateV1ToV2, TARGET_REGISTRY } from '../../src/schema-v2';
import type { IconCoreProject } from '@iconcore/shared';

const minimalProject: IconCoreProject = {
  schemaVersion: 2,
  metadata: {
    name: 'Test App',
    shortName: 'TestApp',
    description: 'A test app'
  },
  canvas: {
    size: 1024,
    background: { kind: 'solid', color: '#ffffff' }
  },
  layers: [
    {
      id: 'layer-1',
      name: 'Icon',
      kind: 'image',
      visible: true,
      zIndex: 0,
      source: { type: 'reference', mimeType: 'image/png', path: 'icon.png' },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      opacity: 1
    }
  ],
  variants: { default: {} },
  targets: [
    { target: 'web-favicon', enabled: true },
    { target: 'pwa', enabled: true }
  ],
  exportProfile: {
    outputBaseName: 'test-app',
    quality: 0.95,
    generateReport: false
  }
};

describe('TARGET_REGISTRY', () => {
  it('has all 6 target definitions', () => {
    const targets = Object.keys(TARGET_REGISTRY);
    expect(targets).toHaveLength(6);
    expect(targets).toContain('web-favicon');
    expect(targets).toContain('pwa');
    expect(targets).toContain('tauri');
    expect(targets).toContain('electron');
    expect(targets).toContain('desktop-generic');
    expect(targets).toContain('marketing');
  });

  it('each target has required fields', () => {
    for (const target of Object.values(TARGET_REGISTRY)) {
      expect(target.id).toBeDefined();
      expect(target.label).toBeTruthy();
      expect(target.defaultSizes.length).toBeGreaterThan(0);
      expect(target.defaultFormats.length).toBeGreaterThan(0);
    }
  });
});

describe('buildTargetPlan', () => {
  it('generates tasks for web-favicon target', () => {
    const plan = buildTargetPlan(minimalProject, 'web-favicon', 'default');

    expect(plan.target).toBe('web-favicon');
    expect(plan.variant).toBe('default');
    expect(plan.tasks.length).toBeGreaterThan(0);

    const paths = plan.tasks.map(t => t.outputPath);
    expect(paths.some(p => p.includes('favicon'))).toBe(true);
  });

  it('generates favicon.ico for web-favicon', () => {
    const plan = buildTargetPlan(minimalProject, 'web-favicon', 'default');

    const icoTasks = plan.tasks.filter(t => t.format === 'ico');
    expect(icoTasks.length).toBeGreaterThan(0);
    expect(icoTasks[0].outputPath).toBe('favicon.ico');
  });

  it('generates maskable variants for PWA target', () => {
    const plan = buildTargetPlan(minimalProject, 'pwa', 'default');

    const maskable = plan.tasks.filter(t => t.maskable);
    expect(maskable.length).toBeGreaterThan(0);
    expect(maskable.every(t => t.outputPath.includes('maskable'))).toBe(true);
  });

  it('generates correct sizes for PWA', () => {
    const plan = buildTargetPlan(minimalProject, 'pwa', 'default');

    const sizes = [...new Set(plan.tasks.filter(t => t.format === 'png').map(t => t.size))];
    expect(sizes).toContain(192);
    expect(sizes).toContain(512);
  });

  it('generates manifest for targets that require it', () => {
    const plan = buildTargetPlan(minimalProject, 'pwa', 'default');
    expect(plan.manifestFiles.length).toBeGreaterThan(0);
    expect(plan.manifestFiles.some(f => f.path === 'manifest.webmanifest')).toBe(true);
  });

  it('generates manifest and browserconfig for web-favicon', () => {
    const plan = buildTargetPlan(minimalProject, 'web-favicon', 'default');
    expect(plan.manifestFiles.some(f => f.path === 'site.webmanifest')).toBe(true);
    expect(plan.manifestFiles.some(f => f.path === 'browserconfig.xml')).toBe(true);
  });

  it('does not generate manifest for tauri', () => {
    const plan = buildTargetPlan(minimalProject, 'tauri', 'default');
    expect(plan.manifestFiles.length).toBe(0);
  });

  it('allows project-level overrides for sizes', () => {
    const customProject: IconCoreProject = {
      ...minimalProject,
      targets: [
        { target: 'pwa', enabled: true, sizes: [192] }
      ]
    };

    const plan = buildTargetPlan(customProject, 'pwa', 'default');
    const sizes = [...new Set(plan.tasks.filter(t => t.format === 'png' && !t.maskable).map(t => t.size))];
    expect(sizes).toEqual([192]);
  });

  it('generates correct Apple touch icon names for web-favicon', () => {
    const plan = buildTargetPlan(minimalProject, 'web-favicon', 'default');

    const appleTasks = plan.tasks.filter(t => t.outputPath.includes('apple-touch-icon'));
    expect(appleTasks.length).toBeGreaterThan(0);
  });

  it('generates tauri icon structure', () => {
    const plan = buildTargetPlan(minimalProject, 'tauri', 'default');

    const paths = plan.tasks.map(t => t.outputPath);
    expect(paths.some(p => p.includes('icon.png'))).toBe(true);
  });
});

describe('migrateV1ToV2', () => {
  it('creates a valid v2 project from v1 config', () => {
    const project = migrateV1ToV2(
      {
        name: 'My App',
        shortName: 'MyApp',
        description: 'My application',
        startUrl: '/',
        defaultTheme: 'light'
      },
      { width: 512, height: 512 }
    );

    expect(project.schemaVersion).toBe(2);
    expect(project.metadata.name).toBe('My App');
    expect(project.metadata.shortName).toBe('MyApp');
    expect(project.canvas.size).toBe(1024);
    expect(project.layers).toHaveLength(1);
    expect(project.layers[0].name).toBe('Master');
    expect(project.targets).toHaveLength(2);
    expect(project.targets[0].target).toBe('web-favicon');
    expect(project.targets[1].target).toBe('pwa');
  });

  it('sets canvas size to max of dimensions or 1024', () => {
    const project = migrateV1ToV2(
      {
        name: 'Big App',
        shortName: 'BigApp',
        description: '',
        startUrl: '/',
        defaultTheme: 'dark'
      },
      { width: 2048, height: 2048 }
    );

    expect(project.canvas.size).toBe(2048);
  });

  it('includes default variant overrides for light and dark', () => {
    const project = migrateV1ToV2(
      {
        name: 'Test',
        shortName: 'Test',
        description: '',
        startUrl: '/',
        defaultTheme: 'light'
      },
      { width: 512, height: 512 }
    );

    expect(project.variants.light).toBeDefined();
    expect(project.variants.dark).toBeDefined();
    expect((project.variants.light as Record<string, unknown>).canvas).toBeDefined();
  });

  it('round-trip: v1 config -> v2 project -> target plan', () => {
    const project = migrateV1ToV2(
      {
        name: 'RoundTrip',
        shortName: 'RT',
        description: 'Round trip test',
        startUrl: '/app',
        defaultTheme: 'light'
      },
      { width: 1024, height: 1024 }
    );

    const plan = buildTargetPlan(project, 'pwa', 'default');
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.manifestFiles.length).toBeGreaterThan(0);
  });
});
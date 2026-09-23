import { describe, expect, it } from 'vitest';
import { migrateToCurrent, migrateV1ToV2 } from '../../src/schema-v2';

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

  it('round-trips v1 → v2 → v3 preserving targets', () => {
    const project = migrateToCurrent(
      migrateV1ToV2(
        {
          name: 'RoundTrip',
          shortName: 'RT',
          description: 'Round trip test',
          startUrl: '/app',
          defaultTheme: 'light'
        },
        { width: 1024, height: 1024 }
      )
    );

    expect(project.schemaVersion).toBe(3);
    expect(project.targets).toHaveLength(2);
    expect(project.targets.map((target) => target.target)).toEqual(['web-favicon', 'pwa']);
    expect(project.exportProfile).toBeDefined();
  });
});
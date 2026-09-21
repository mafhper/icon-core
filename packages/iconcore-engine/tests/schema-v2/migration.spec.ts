import { describe, expect, it } from 'vitest';
import type { IconLayer } from '@iconcore/shared';
import { migrateV2ToV3, type IconCoreProjectV2 } from '../../src/schema-v2';

const legacyRect = (overrides: Partial<IconLayer> = {}): IconLayer => ({
  id: 'bg',
  name: 'Background',
  kind: 'shape',
  visible: true,
  zIndex: 0,
  source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 512, height: 512 } },
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  opacity: 1,
  fill: { kind: 'solid', color: '#ffffff' },
  ...overrides
});

const v2 = (
  layers: IconLayer[],
  background: IconCoreProjectV2['canvas']['background'] = { kind: 'solid', color: '#ffffff' }
): IconCoreProjectV2 => ({
  schemaVersion: 2,
  metadata: { name: 'Legacy', shortName: 'Legacy' },
  canvas: { size: 512, background },
  layers,
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'legacy', quality: 0.95, generateReport: false }
});

describe('migrateV2ToV3', () => {
  it('promotes the legacy background layer fill when it differs (fixture B)', () => {
    const migrated = migrateV2ToV3(v2([legacyRect({ fill: { kind: 'solid', color: '#0000ff' } })]));
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.canvas.background).toEqual({ kind: 'solid', color: '#0000ff' });
    expect(migrated.layers[0].role).toBe('background');
    // The handle must not keep a second source of truth.
    expect(migrated.layers[0].fill).toBeUndefined();
  });

  it('keeps the canvas background when it already matches (fixture A)', () => {
    const migrated = migrateV2ToV3(v2([legacyRect()]));
    expect(migrated.canvas.background).toEqual({ kind: 'solid', color: '#ffffff' });
    expect(migrated.layers[0].role).toBe('background');
  });

  it('never converts shaped "Background" layers (preset circles/squircles)', () => {
    const shaped = legacyRect({
      source: { type: 'reference', path: '', shape: { kind: 'circle', width: 512, height: 512 } }
    });
    const migrated = migrateV2ToV3(v2([shaped]));
    expect(migrated.layers[0].role).toBeUndefined();
  });

  it('ignores rectangles that do not cover the whole canvas', () => {
    const small = legacyRect({
      source: { type: 'reference', path: '', shape: { kind: 'rectangle', width: 200, height: 200 } }
    });
    const migrated = migrateV2ToV3(v2([small]));
    expect(migrated.layers[0].role).toBeUndefined();
  });

  it('marks at most one handle', () => {
    const migrated = migrateV2ToV3(v2([legacyRect({ id: 'a' }), legacyRect({ id: 'b' })]));
    const handles = migrated.layers.filter((layer) => layer.role === 'background');
    expect(handles).toHaveLength(1);
  });

  it('is idempotent', () => {
    const once = migrateV2ToV3(v2([legacyRect({ fill: { kind: 'solid', color: '#123456' } })]));
    expect(migrateV2ToV3(once)).toBe(once);
  });

  it('leaves an already-canonical v3 project untouched', () => {
    const canonical = migrateV2ToV3(v2([legacyRect()]));
    expect(migrateV2ToV3(canonical)).toBe(canonical);
  });
});

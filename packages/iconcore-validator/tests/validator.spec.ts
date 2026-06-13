import { describe, expect, it } from 'vitest';
import type { IconCoreProject, Fill } from '@iconcore/shared';
import { auditProject } from '../src/index';

const createProject = (overrides?: Partial<IconCoreProject>): IconCoreProject => ({
  schemaVersion: 2,
  metadata: { name: 'Test', shortName: 'Test' },
  canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
  layers: [],
  variants: { default: {} },
  targets: [{ target: 'web-favicon', enabled: true }],
  exportProfile: { outputBaseName: 'test', quality: 0.95, generateReport: false },
  ...overrides
});

describe('auditProject', () => {
  it('returns valid for a minimal valid project', () => {
    const result = auditProject(createProject());
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('reports error for missing name', () => {
    const result = auditProject(createProject({ metadata: { name: '', shortName: '' } }));
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'MISSING_NAME')).toBe(true);
  });

  it('reports info for no layers', () => {
    const result = auditProject(createProject());
    expect(result.issues.some(i => i.code === 'NO_LAYERS')).toBe(true);
  });

  it('reports warning for low contrast', () => {
    const project = createProject({
      canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
      layers: [{
        id: 'layer1',
        name: 'Low Contrast',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: { type: 'reference', path: '' },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#f0f0f0' }
      }]
    });
    const result = auditProject(project);
    expect(result.issues.some(i => i.code === 'LOW_CONTRAST')).toBe(true);
  });

  it('does not report contrast issue for high contrast', () => {
    const project = createProject({
      canvas: { size: 512, background: { kind: 'solid', color: '#ffffff' } },
      layers: [{
        id: 'layer1',
        name: 'High Contrast',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: { type: 'reference', path: '' },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        fill: { kind: 'solid', color: '#000000' }
      }]
    });
    const result = auditProject(project);
    expect(result.issues.some(i => i.code === 'LOW_CONTRAST')).toBe(false);
  });

  it('reports warning for layer outside safe area', () => {
    const project = createProject({
      canvas: {
        size: 512,
        background: { kind: 'solid', color: '#ffffff' },
        safeArea: { inset: 0.1, shape: 'square' }
      },
      layers: [{
        id: 'layer1',
        name: 'Outside Safe',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: { type: 'reference', path: '', shape: { kind: 'circle', width: 400, height: 400 } },
        transform: { x: 100, y: 0, scale: 1, rotation: 0 },
        opacity: 1
      }]
    });
    const result = auditProject(project);
    expect(result.issues.some(i => i.code === 'OUTSIDE_SAFE_AREA')).toBe(true);
  });

  it('reports info for thin strokes', () => {
    const project = createProject({
      layers: [{
        id: 'layer1',
        name: 'Thin Stroke',
        kind: 'image',
        visible: true,
        zIndex: 0,
        source: { type: 'reference', path: '' },
        transform: { x: 0, y: 0, scale: 0.5, rotation: 0 },
        opacity: 1,
        stroke: { color: '#000000', width: 1, alignment: 'center' }
      }]
    });
    const result = auditProject(project);
    expect(result.issues.some(i => i.code === 'THIN_STROKE')).toBe(true);
  });

  it('reports info to avoid text layers (Apple HIG)', () => {
    const project = createProject({
      layers: [{
        id: 'layer1',
        name: 'Wordmark',
        kind: 'text',
        visible: true,
        zIndex: 0,
        source: { type: 'reference', path: '' },
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        opacity: 1,
        text: { content: 'Hi', fontFamily: 'Inter', fontSize: 64, fontWeight: 700 }
      }]
    });
    const result = auditProject(project);
    expect(result.issues.some(i => i.code === 'AVOID_TEXT')).toBe(true);
  });

  it('calculates score based on issues', () => {
    const project = createProject({ metadata: { name: '', shortName: '' } });
    const result = auditProject(project);
    expect(result.score).toBeLessThan(100);
  });
});
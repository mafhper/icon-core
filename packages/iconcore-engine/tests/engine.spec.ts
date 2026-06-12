import { describe, expect, it } from 'vitest';
import { buildGenerationPlan, buildOutputMap, generateManifest, resolveSources } from '../src';

const master = { id: 'master' };
const light = { id: 'light' };
const dark = { id: 'dark' };
const favicon = { id: 'favicon' };

describe('resolveSources', () => {
  it('resolves master-only uploads to default mode', () => {
    const resolved = resolveSources({ master });
    expect(resolved.mode).toBe('default');
    expect(resolved.logos.default).toEqual(master);
    expect(resolved.favicons.default).toEqual(master);
  });

  it('resolves master + favicon to default mode with dedicated favicon', () => {
    const resolved = resolveSources({ master, favicon });
    expect(resolved.mode).toBe('default');
    expect(resolved.favicons.default).toEqual(favicon);
  });

  it('resolves master + light + dark to themed mode', () => {
    const resolved = resolveSources({ master, light, dark });
    expect(resolved.mode).toBe('themed');
    expect(resolved.logos.light).toEqual(light);
    expect(resolved.logos.dark).toEqual(dark);
  });
});

describe('buildGenerationPlan', () => {
  it('creates icons/default tasks when mode is default', () => {
    const resolved = resolveSources({ master, favicon });
    const tasks = buildGenerationPlan(resolved);
    expect(tasks.some((task) => task.name.startsWith('icons/default/'))).toBe(true);
    expect(tasks.some((task) => task.name.startsWith('icons/light/'))).toBe(false);
  });

  it('creates icons/light and icons/dark tasks when mode is themed', () => {
    const resolved = resolveSources({ master, light, dark });
    const tasks = buildGenerationPlan(resolved);
    expect(tasks.some((task) => task.name.startsWith('icons/light/'))).toBe(true);
    expect(tasks.some((task) => task.name.startsWith('icons/dark/'))).toBe(true);
    expect(tasks.some((task) => task.name.startsWith('icons/default/'))).toBe(false);
  });
});

describe('generateManifest', () => {
  const project = {
    name: 'IconCore',
    shortName: 'IconCore',
    description: 'Vector asset engine',
    startUrl: '/',
    defaultTheme: 'light' as const
  };

  it('targets default icons when output mode is default', () => {
    const manifest = generateManifest({
      project,
      mode: 'default',
      defaultTheme: 'light',
      themeColor: '#000000',
      backgroundColor: '#000000'
    });

    expect(manifest.icons[0].src).toContain('icons/default/');
  });

  it('targets themed icons based on defaultTheme when output mode is themed', () => {
    const manifest = generateManifest({
      project,
      mode: 'themed',
      defaultTheme: 'dark',
      themeColor: '#000000',
      backgroundColor: '#000000'
    });

    expect(manifest.icons[0].src).toContain('icons/dark/');
  });
});

describe('regression snapshot', () => {
  it('v1 buildGenerationPlan default mode output is stable', () => {
    const resolved = resolveSources({ master, favicon });
    const tasks = buildGenerationPlan(resolved, {
      includeSocial: true,
      includeFaviconSvg: true,
      opaqueBackground: false
    });

    const snapshot = tasks.map(({ kind, type, variant, name, width, height, format, transparent, maskable }) => ({
      kind,
      type,
      variant,
      name,
      width,
      height,
      format,
      transparent,
      maskable
    }));

    expect(snapshot).toMatchSnapshot();
  });

  it('v1 buildGenerationPlan themed mode output is stable', () => {
    const resolved = resolveSources({ master, light, dark, favicon });
    const tasks = buildGenerationPlan(resolved, {
      includeSocial: false,
      includeFaviconSvg: false,
      opaqueBackground: true
    });

    const snapshot = tasks.map(({ kind, type, variant, name, width, height, format, transparent, maskable }) => ({
      kind,
      type,
      variant,
      name,
      width,
      height,
      format,
      transparent,
      maskable
    }));

    expect(snapshot).toMatchSnapshot();
  });

  it('v1 buildOutputMap produces correct entries', () => {
    const resolved = resolveSources({ master });
    const tasks = buildGenerationPlan(resolved, {
      includeSocial: true,
      includeFaviconSvg: true,
      opaqueBackground: false
    });

    const entries = buildOutputMap(tasks);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.path && entry.directory && entry.variant && entry.type)).toBe(true);
    expect(entries).toMatchSnapshot();
  });
});

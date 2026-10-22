// @vitest-environment jsdom
//
// Regression for the hero shader disappearing in development: the canvas element survives a
// StrictMode (or HMR) remount, so its WebGL context does too. The effect's cleanup therefore
// frees the GPU objects but must never call WEBGL_lose_context.loseContext() -- a lost context
// is sticky per canvas, and the next mount's getContext() hands it straight back.
//
// The seam is the effect boundary: what cleanup does to the context, and whether a remount on
// the same canvas still reaches drawArrays. The driver below is a fake, but the two behaviours
// it models are the WebGL spec's: one context object per canvas type, and a lost context
// failing every compile/link check.
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TILE_PRESETS } from '../../lib/appearance';
import { ShaderCanvas } from './ShaderCanvas';
import { StudioProvider } from './studio-context';

const PRESET = TILE_PRESETS.default;

const GL = {
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  TRIANGLES: 0x0004,
} as const;

/** Records what the component did to the context; no rendering. */
class FakeContext {
  readonly VERTEX_SHADER = GL.VERTEX_SHADER;
  readonly FRAGMENT_SHADER = GL.FRAGMENT_SHADER;
  readonly COMPILE_STATUS = GL.COMPILE_STATUS;
  readonly LINK_STATUS = GL.LINK_STATUS;
  readonly ARRAY_BUFFER = GL.ARRAY_BUFFER;
  readonly STATIC_DRAW = GL.STATIC_DRAW;
  readonly FLOAT = GL.FLOAT;
  readonly TRIANGLES = GL.TRIANGLES;

  lost = false;
  loseCalls = 0;
  draws = 0;
  deleted = 0;
  readonly events: string[] = [];
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  isContextLost() {
    return this.lost;
  }

  getExtension(name: string) {
    if (name !== 'WEBGL_lose_context') return null;
    return {
      loseContext: () => {
        this.loseCalls += 1;
        this.lost = true;
      },
      restoreContext: () => {
        this.lost = false;
      },
    };
  }

  /** Driver reset: the context is gone, and the browser announces it on the canvas. */
  lose() {
    this.lost = true;
    this.events.push('contextlost');
    this.canvas.dispatchEvent(new Event('webglcontextlost'));
  }

  /** The browser restored the context, which invalidated every object created before it. */
  restore() {
    this.lost = false;
    this.events.push('contextrestored');
    this.canvas.dispatchEvent(new Event('webglcontextrestored'));
  }

  createShader() {
    return { kind: 'shader' };
  }

  shaderSource() {}

  compileShader() {
    this.events.push(this.lost ? 'compileShader (lost)' : 'compileShader');
  }

  getShaderParameter(_shader: unknown, pname: number) {
    if (pname !== GL.COMPILE_STATUS) return null;
    return this.lost ? null : true; // spec: null on a lost context
  }

  getShaderInfoLog() {
    return '';
  }

  deleteShader() {
    this.deleted += 1;
  }

  createProgram() {
    return { kind: 'program' };
  }

  attachShader() {}
  detachShader() {}
  linkProgram() {}

  getProgramParameter(_program: unknown, pname: number) {
    if (pname !== GL.LINK_STATUS) return null;
    return this.lost ? null : true;
  }

  getProgramInfoLog() {
    return '';
  }

  deleteProgram() {
    this.deleted += 1;
  }

  useProgram() {}

  createBuffer() {
    return { kind: 'buffer' };
  }

  bindBuffer() {}
  bufferData() {}

  deleteBuffer() {
    this.deleted += 1;
  }

  getAttribLocation() {
    return 0;
  }

  enableVertexAttribArray() {}
  vertexAttribPointer() {}
  getUniformLocation() {
    return {};
  }

  uniform1f() {}
  uniform2f() {}
  uniform3fv() {}
  viewport() {}

  drawArrays() {
    this.draws += 1;
    this.events.push('drawArrays');
  }
}

/** getContext is sticky per canvas and per type, exactly like the browser. */
function installFakeGL() {
  const real = HTMLCanvasElement.prototype.getContext;
  const perCanvas = new WeakMap<HTMLCanvasElement, FakeContext>();
  const contexts: FakeContext[] = [];

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
    if (type !== 'webgl' && type !== 'experimental-webgl') return null;
    let context = perCanvas.get(this);
    if (!context) {
      context = new FakeContext(this);
      perCanvas.set(this, context);
      contexts.push(context);
    }
    return context as unknown as WebGLRenderingContext;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    contexts,
    restore() {
      HTMLCanvasElement.prototype.getContext = real;
    },
  };
}

// The frame queue the component sees. It honours cancelAnimationFrame, so the loop discarded by
// the first StrictMode effect is really gone instead of being flushed as if nothing cancelled it.
const frames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

function stubEnvironment() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  class IOStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal('IntersectionObserver', IOStub);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
}

type Mounted = { root: Root; container: HTMLDivElement };

let fake: ReturnType<typeof installFakeGL> | null = null;
let mounted: Mounted | null = null;

async function mount(strict: boolean): Promise<HTMLDivElement> {
  fake = installFakeGL();
  stubEnvironment();
  frames.clear();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const tree = createElement(
    StudioProvider,
    null,
    createElement(ShaderCanvas, { preset: PRESET, renderScale: 0.45 })
  );
  await act(async () => {
    root.render(strict ? createElement(StrictMode, null, tree) : tree);
  });
  mounted = { root, container };
  return container;
}

async function unmount() {
  if (!mounted) return;
  const { root } = mounted;
  mounted = null;
  await act(async () => {
    root.unmount();
  });
}

/** Runs the single live frame callback, the way the browser's rAF would. */
function flushFrame(now = 16) {
  const next = frames.entries().next();
  if (next.done) throw new Error('no scheduled frame');
  const [id, callback] = next.value;
  frames.delete(id);
  act(() => {
    callback(now);
  });
}

const context = () => {
  const first = fake?.contexts[0];
  if (!first) throw new Error('the component never asked for a context');
  return first;
};

const fallback = (container: HTMLElement) =>
  container.querySelector('div[aria-hidden][style]') as HTMLDivElement | null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await unmount();
  document.body.replaceChildren();
  fake?.restore();
  fake = null;
  frames.clear();
  vi.unstubAllGlobals();
});

describe('ShaderCanvas and the WebGL context it shares with a remount', () => {
  it('draws after a StrictMode remount, and keeps the canvas instead of the CSS fallback', async () => {
    const container = await mount(true);

    // The development build runs the effect twice on the same canvas element. The element
    // survives, so the context must too: a static gradient here means the hero lost its field.
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(fallback(container)).toBeNull();

    flushFrame();
    expect(context().draws).toBeGreaterThan(0);
  });

  it('frees the GPU objects on cleanup without ever losing the shared context', async () => {
    await mount(false);
    flushFrame();
    const ctx = context();
    expect(ctx.draws).toBeGreaterThan(0);

    await unmount();

    // The element outlives the effect, so cleanup must release what it built and leave the
    // context usable. Forcing a loss here is what turned every remount into a fallback.
    expect(ctx.deleted).toBeGreaterThan(0);
    expect(ctx.loseCalls).toBe(0);
    expect(frames.size).toBe(0);
  });

  it('recovers from a context the browser lost, once it is restored', async () => {
    const container = await mount(false);
    flushFrame();
    const ctx = context();
    const drawn = ctx.draws;
    expect(drawn).toBeGreaterThan(0);

    ctx.lose();
    flushFrame(); // a lost context draws nothing
    expect(ctx.draws).toBe(drawn);

    ctx.restore();
    flushFrame();
    expect(ctx.draws).toBeGreaterThan(drawn);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});

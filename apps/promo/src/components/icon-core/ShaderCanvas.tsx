import { useEffect, useRef, useState } from 'react';

import type { ShaderPreset } from '../../lib/appearance';
import { cn } from '../../lib/cn';
import { FRAGMENT_SRC, VERTEX_SRC, shaderFallbackBackground } from '../../lib/shader';
import { useStudio } from './studio-context';

type Props = {
  preset: ShaderPreset;
  className?: string;
  /** Fraction of CSS pixels rendered (the field is soft, so low values are fine). */
  renderScale?: number;
};

const VEC_KEYS = ['base', 'c1', 'c2', 'c3'] as const;
const NUM_KEYS = ['iri', 'light', 'grain', 'scale', 'sat', 'vig'] as const;

const fixed = (n: number) => n.toFixed(3);

/**
 * The values a drawn frame depends on, at the precision the field is read at. Reduced
 * motion repaints only when this changes, so every uniform the loop writes has to be in
 * here: a channel left out freezes a transition on a frame that was never drawn. The
 * lists below are the same ones the lerp walks, so a new channel enters both or neither.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Pure helper for the frame loop; the spec imports it directly.
export function frameSignature(
  width: number,
  height: number,
  mouse: { x: number; y: number },
  preset: ShaderPreset
): string {
  return [
    `${width}x${height}`,
    fixed(mouse.x),
    fixed(mouse.y),
    ...VEC_KEYS.flatMap((key) => preset[key].map(fixed)),
    ...NUM_KEYS.map((key) => fixed(preset[key])),
  ].join('|');
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

export function ShaderCanvas({ preset, className, renderScale = 0.5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pointer, reducedMotion } = useStudio();
  const targetRef = useRef(preset);
  targetRef.current = preset;
  const motionRef = useRef(reducedMotion);
  motionRef.current = reducedMotion;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      setFailed(true);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    const U = {
      res: u('u_res'),
      time: u('u_time'),
      mouse: u('u_mouse'),
      base: u('u_base'),
      c1: u('u_c1'),
      c2: u('u_c2'),
      c3: u('u_c3'),
      iri: u('u_iri'),
      light: u('u_light'),
      grain: u('u_grain'),
      scale: u('u_scale'),
      sat: u('u_sat'),
      vig: u('u_vig'),
    };

    const cur: ShaderPreset = JSON.parse(JSON.stringify(targetRef.current));
    const mouse = { x: 0.5, y: 0.55 };
    let visible = true;
    let raf = 0;
    let time = 8;
    let last = performance.now();
    let lastSig = '';

    // The field only renders while the canvas is on screen.
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;

      const target = targetRef.current;
      for (const key of VEC_KEYS) {
        const channel = cur[key];
        const goal = target[key];
        channel[0] += (goal[0] - channel[0]) * 0.06;
        channel[1] += (goal[1] - channel[1]) * 0.06;
        channel[2] += (goal[2] - channel[2]) * 0.06;
      }
      for (const key of NUM_KEYS) cur[key] += (target[key] - cur[key]) * 0.06;

      const rect = canvas.getBoundingClientRect();
      const p = pointer.current;
      const mx = rect.width ? (p.x - rect.left) / rect.width : 0.5;
      const my = rect.height ? 1 - (p.y - rect.top) / rect.height : 0.5;
      mouse.x += (mx - mouse.x) * 0.07;
      mouse.y += (my - mouse.y) * 0.07;

      // Reduced motion freezes time and skips frames that would repeat the last one.
      const reduced = motionRef.current;
      if (!reduced) time += dt;

      const w = Math.max(1, Math.round(canvas.clientWidth * renderScale));
      const h = Math.max(1, Math.round(canvas.clientHeight * renderScale));
      const sig = frameSignature(w, h, mouse, cur);
      if (reduced && sig === lastSig) return;
      lastSig = sig;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.time, time);
      gl.uniform2f(U.mouse, mouse.x, mouse.y);
      gl.uniform3fv(U.base, cur.base);
      gl.uniform3fv(U.c1, cur.c1);
      gl.uniform3fv(U.c2, cur.c2);
      gl.uniform3fv(U.c3, cur.c3);
      gl.uniform1f(U.iri, cur.iri);
      gl.uniform1f(U.light, cur.light);
      gl.uniform1f(U.grain, cur.grain);
      gl.uniform1f(U.scale, cur.scale);
      gl.uniform1f(U.sat, cur.sat);
      gl.uniform1f(U.vig, cur.vig);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [pointer, renderScale]);

  if (failed) {
    return (
      <div
        aria-hidden
        className={cn('transition-[background] duration-700', className)}
        style={{ background: shaderFallbackBackground(preset) }}
      />
    );
  }

  return <canvas ref={canvasRef} aria-hidden className={cn('block', className)} />;
}

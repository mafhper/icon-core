import { useId } from 'react';

import {
  CORE_PATH,
  ICON_PALETTES,
  LOGO_TRANSFORM,
  PETALS,
  roundedRectPath,
  type Appearance,
  type Radii,
} from '../../lib/appearance';
import { cn } from '../../lib/cn';
import { useStudio } from './studio-context';

const COLOR_TRANSITION = { transition: 'stop-color .6s ease, stop-opacity .6s ease, fill .6s ease' };

function useUid() {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}

/** Petal gradients + paths, in original logo coordinates (wrap with LOGO_TRANSFORM). */
function PetalGroup({ appearance, uid }: { appearance: Appearance; uid: string }) {
  const palette = ICON_PALETTES[appearance].petal;
  return (
    <>
      <defs>
        {PETALS.map((petal, index) => (
          <linearGradient
            key={index}
            id={`pg${uid}${index}`}
            gradientUnits="userSpaceOnUse"
            x1={petal.grad[0]}
            y1={petal.grad[1]}
            x2={petal.grad[2]}
            y2={petal.grad[3]}
          >
            <stop
              style={{
                ...COLOR_TRANSITION,
                stopColor: palette.from,
                stopOpacity: palette.fromOpacity,
              }}
            />
            <stop
              offset="1"
              style={{ ...COLOR_TRANSITION, stopColor: palette.to, stopOpacity: palette.toOpacity }}
            />
          </linearGradient>
        ))}
      </defs>
      {PETALS.map((petal, index) => (
        <path key={index} d={petal.d} fill={`url(#pg${uid}${index})`} />
      ))}
    </>
  );
}

/**
 * The "I" core. When animated, its color flows through a three-tone gradient
 * and a soft glow breathes behind it.
 */
function CoreGroup({
  appearance,
  uid,
  animated,
}: {
  appearance: Appearance;
  uid: string;
  animated: boolean;
}) {
  const [c0, c1, c2] = ICON_PALETTES[appearance].core;
  return (
    <>
      <defs>
        <linearGradient id={`cg${uid}`} x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
          <stop offset="0" style={{ ...COLOR_TRANSITION, stopColor: c0 }} />
          <stop offset="0.5" style={{ ...COLOR_TRANSITION, stopColor: animated ? c1 : c0 }} />
          <stop offset="1" style={{ ...COLOR_TRANSITION, stopColor: animated ? c2 : c0 }} />
          {animated && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="-1 -1; 1 1; -1 -1"
              dur="7s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
        {animated && (
          <filter id={`cb${uid}`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        )}
      </defs>
      {animated && (
        <path
          d={CORE_PATH}
          fill={`url(#cg${uid})`}
          filter={`url(#cb${uid})`}
          className="ic-core-glow"
        />
      )}
      <path d={CORE_PATH} fill={`url(#cg${uid})`} className={animated ? 'ic-core-pulse' : undefined} />
    </>
  );
}

export function PetalsSvg({ appearance, className }: { appearance: Appearance; className?: string }) {
  const uid = useUid();
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <g transform={LOGO_TRANSFORM}>
        <PetalGroup appearance={appearance} uid={uid} />
      </g>
    </svg>
  );
}

export function CoreSvg({
  appearance,
  className,
  animated = true,
}: {
  appearance: Appearance;
  className?: string;
  animated?: boolean;
}) {
  const uid = useUid();
  const { reducedMotion } = useStudio();
  return (
    <svg viewBox="0 0 512 512" className={cn('overflow-visible', className)} aria-hidden>
      <g transform={LOGO_TRANSFORM}>
        <CoreGroup appearance={appearance} uid={uid} animated={animated && !reducedMotion} />
      </g>
    </svg>
  );
}

export type GlyphLayers = { background: boolean; petals: boolean; core: boolean };

type GlyphProps = {
  appearance: Appearance;
  radii: Radii;
  size?: number | string;
  className?: string;
  layers?: GlyphLayers;
  /** Import margin: shrinks the asset layers toward the center (0–30 %). */
  margin?: number;
  label?: string;
  /** Pulse the core color (large previews only). */
  animated?: boolean;
};

/** Flattened icon (all layers in one SVG), used for previews and platform contexts. */
export function IconGlyph({
  appearance,
  radii,
  size,
  className,
  layers = { background: true, petals: true, core: true },
  margin = 0,
  label,
  animated = false,
}: GlyphProps) {
  const uid = useUid();
  const { reducedMotion } = useStudio();
  const palette = ICON_PALETTES[appearance];
  const scale = 1 - margin / 100;
  const tr = `translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})`;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={`clip${uid}`}>
          <path d={roundedRectPath(512, radii)} />
        </clipPath>
        {palette.tile.kind === 'radial' ? (
          <radialGradient id={`bg${uid}`} cx="50%" cy="42%" r="72%">
            {palette.tile.stops.map(([offset, color]) => (
              <stop key={offset} offset={offset} style={{ ...COLOR_TRANSITION, stopColor: color }} />
            ))}
          </radialGradient>
        ) : (
          <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
            {palette.tile.stops.map(([offset, color]) => (
              <stop key={offset} offset={offset} style={{ ...COLOR_TRANSITION, stopColor: color }} />
            ))}
          </linearGradient>
        )}
        <linearGradient id={`hl${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#clip${uid})`}>
        {layers.background && <rect width="512" height="512" fill={`url(#bg${uid})`} />}
        <g transform={tr} style={{ transition: 'transform .3s ease' }}>
          <g transform={LOGO_TRANSFORM}>
            {layers.petals && <PetalGroup appearance={appearance} uid={`${uid}p`} />}
            {layers.core && (
              <CoreGroup appearance={appearance} uid={`${uid}c`} animated={animated && !reducedMotion} />
            )}
          </g>
        </g>
        {layers.background && (
          <rect width="512" height="512" fill={`url(#hl${uid})`} opacity={palette.highlight} />
        )}
      </g>
    </svg>
  );
}

/** Small brand mark for the header and footer. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <path d={roundedRectPath(512, 24)} className="fill-foreground" />
      <g transform={LOGO_TRANSFORM}>
        {PETALS.map((petal, index) => (
          <path key={index} d={petal.d} className="fill-background" fillOpacity={0.45} />
        ))}
        <path d={CORE_PATH} className="fill-cyan" />
      </g>
    </svg>
  );
}

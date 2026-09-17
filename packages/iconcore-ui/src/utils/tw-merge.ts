import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge config for `@iconcore/ui`.
 *
 * Registers the custom `rounded-ic-*` radius vocabulary produced by the
 * `--radius-ic-*` component tokens so conflicting utilities resolve
 * deterministically (last wins). Arbitrary heights such as
 * `h-[var(--ic-control-sm)]` are already handled by the default `h` group.
 */
export const twMerge = extendTailwindMerge<'rounded-ic'>({
  extend: {
    classGroups: {
      'rounded-ic': ['rounded-ic-sm', 'rounded-ic-md', 'rounded-ic-lg']
    }
  }
});
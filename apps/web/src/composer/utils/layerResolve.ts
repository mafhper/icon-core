import type { IconLayer, IconVariant } from '@iconcore/shared';

/**
 * Merge a layer's variant override on top of its base definition.
 *
 * Shared by the canvas (PreviewCanvas) and the inspector (LayerInspector) so the
 * variant-resolution rules live in one place. Nested objects (source/transform/text)
 * are shallow-merged; effects are replaced wholesale when overridden.
 */
export const resolveLayerVariant = (layer: IconLayer, variant: IconVariant): IconLayer => {
  const override = layer.variantOverrides?.[variant];
  if (!override) return layer;
  return {
    ...layer,
    ...override,
    source: override.source ? { ...layer.source, ...override.source } : layer.source,
    transform: override.transform ? { ...layer.transform, ...override.transform } : layer.transform,
    text: override.text ? { ...layer.text, ...override.text } as IconLayer['text'] : layer.text,
    effects: override.effects ?? layer.effects
  };
};

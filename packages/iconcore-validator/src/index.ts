import type { IconCoreProject, IconLayer, Fill } from '@iconcore/shared';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  layerId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number;
}

const getLuminance = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const getContrastRatio = (color1: string, color2: string): number => {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const checkContrast = (project: IconCoreProject): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const bg = project.canvas.background;

  if (bg.kind !== 'solid' || !bg.color) return issues;

  const bgColor = bg.color;

  for (const layer of project.layers) {
    if (!layer.visible || !layer.fill || layer.fill.kind !== 'solid' || !layer.fill.color) continue;

    const layerColor = layer.fill.color;
    const ratio = getContrastRatio(bgColor, layerColor);
    if (ratio < 3) {
      issues.push({
        severity: 'warning',
        code: 'LOW_CONTRAST',
        message: `Layer "${layer.name}" has low contrast ratio (${ratio.toFixed(2)}:1). Consider increasing contrast for better visibility at small sizes.`,
        layerId: layer.id
      });
    }
  }

  return issues;
};

const checkSafeArea = (project: IconCoreProject): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const { safeArea, size } = project.canvas;

  if (!safeArea) return issues;

  const insetPx = safeArea.inset * size;
  const safeSize = size - insetPx * 2;

  for (const layer of project.layers) {
    if (!layer.visible || !layer.source.shape) continue;

    const shape = layer.source.shape;
    const layerWidth = shape.width * layer.transform.scale;
    const layerHeight = shape.height * layer.transform.scale;

    const layerLeft = (size / 2 + layer.transform.x) - layerWidth / 2;
    const layerRight = layerLeft + layerWidth;
    const layerTop = (size / 2 + layer.transform.y) - layerHeight / 2;
    const layerBottom = layerTop + layerHeight;

    if (layerLeft < insetPx || layerRight > size - insetPx || layerTop < insetPx || layerBottom > size - insetPx) {
      issues.push({
        severity: 'warning',
        code: 'OUTSIDE_SAFE_AREA',
        message: `Layer "${layer.name}" extends outside the safe area and may be clipped on some platforms.`,
        layerId: layer.id
      });
    }
  }

  return issues;
};

const checkStrokeWidth = (project: IconCoreProject): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  for (const layer of project.layers) {
    if (!layer.visible || !layer.stroke) continue;

    const effectiveWidth = layer.stroke.width * layer.transform.scale;
    if (effectiveWidth < 1) {
      issues.push({
        severity: 'info',
        code: 'THIN_STROKE',
        message: `Layer "${layer.name}" has a very thin stroke (${effectiveWidth.toFixed(2)}px effective). It may not be visible at small sizes.`,
        layerId: layer.id
      });
    }
  }

  return issues;
};

const checkMetadata = (project: IconCoreProject): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!project.metadata.name || project.metadata.name.trim().length === 0) {
    issues.push({
      severity: 'error',
      code: 'MISSING_NAME',
      message: 'Project name is required.'
    });
  }

  if (!project.metadata.shortName || project.metadata.shortName.trim().length === 0) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_SHORT_NAME',
      message: 'Short name is recommended for PWA manifests.'
    });
  }

  return issues;
};

const checkLayers = (project: IconCoreProject): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (project.layers.length === 0) {
    issues.push({
      severity: 'info',
      code: 'NO_LAYERS',
      message: 'Project has no layers. Add at least one layer to create an icon.'
    });
  }

  const visibleLayers = project.layers.filter(l => l.visible);
  if (visibleLayers.length === 0 && project.layers.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'NO_VISIBLE_LAYERS',
      message: 'All layers are hidden. The exported icon will only show the background.'
    });
  }

  return issues;
};

export const auditProject = (project: IconCoreProject): ValidationResult => {
  const issues: ValidationIssue[] = [
    ...checkMetadata(project),
    ...checkLayers(project),
    ...checkContrast(project),
    ...checkSafeArea(project),
    ...checkStrokeWidth(project)
  ];

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  const score = Math.max(0, 100 - errors * 20 - warnings * 5);

  return {
    valid: errors === 0,
    issues,
    score
  };
};
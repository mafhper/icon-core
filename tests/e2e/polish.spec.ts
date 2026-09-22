import { test, expect, type Page } from '@playwright/test';

/**
 * Polish contract, derived from the `better-ui` rules (see
 * `~/.config/opencode/skills/better-ui`): radii of nested elements must be
 * nested radii are not inverted (inner <= outer) and transitions must name the properties
 * they change. Both are read from computed styles, so the rules stay enforceable
 * instead of being taste.
 */

/** Pills and knobs are exempt: the concentric rule is about nested surfaces. */
const PILL_RADIUS = 999;

const openInspector = async (page: Page, withShape: boolean) => {
  await page.goto('/icon-core/app/?theme=dark');
  await page.getByRole('button', { name: /^Create$/i }).first().click();
  await expect(page.locator('.ic-inspector')).toBeVisible();
  if (!withShape) return;
  await page.getByRole('button', { name: /add shape/i }).first().click();
  await page.getByRole('menuitem').first().click();
  await page.waitForTimeout(400);
};

const collect = (page: Page, scope: string, fn: (root: Element, pill: number) => string[], pill = PILL_RADIUS) =>
  page.locator(scope).evaluate(fn, pill);

/**
 * Controls must also fit vertically: the app's base rule padded inputs and
 * selects by 9.28px top and bottom, so a 28px field needed 38.56px and the
 * select clipped the top and bottom of its own text.
 */
for (const width of [240, 288] as const) {
  test(`control text fits vertically at ${width}px`, async ({ page }) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem('iconcore:panel-right', String(value)),
      width
    );
    await openInspector(page, true);

    const clipped = await collect(page, '.ic-inspector', (root) => {
      const out: string[] = [];
      for (const element of [...root.querySelectorAll('input, select')]) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const type = (element as HTMLInputElement).type;
        // Sliders, checkboxes and colour wells have no text to clip.
        if (element.tagName === 'INPUT' && ['range', 'checkbox', 'radio', 'color', 'file'].includes(type)) continue;
        const hasText = element.tagName === 'SELECT' || (element as HTMLInputElement).value !== '';
        if (!hasText) continue;
        const styles = getComputedStyle(element);
        const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
        const line = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.2;
        const needed =
          line + paddingY +
          (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
        if (needed > rect.height + 0.5) {
          out.push(`${element.getAttribute('aria-label') ?? element.tagName} h=${Math.round(rect.height)} needed=${Math.round(needed)}`);
        }
      }
      return out;
    });

    expect(clipped, clipped.join('\n')).toEqual([]);
  });
}

/**
 * No control may clip its own value. Measured with `canvas.measureText` against
 * the control's content box: three-digit values used to be cut to a single digit
 * because nested inputs inherited the browser's 16px font inside a 12px field.
 */
for (const width of [240, 288] as const) {
  test(`control values fit at ${width}px`, async ({ page }) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem('iconcore:panel-right', String(value)),
      width
    );
    await openInspector(page, true);

    const clipped = await collect(page, '.ic-inspector', (root) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const out: string[] = [];
      for (const element of [...root.querySelectorAll('input, select, button')]) {
        const styles = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || !context) continue;
        const value = element.tagName === 'SELECT'
          ? (element.selectedOptions[0]?.textContent ?? '')
          : element.tagName === 'INPUT'
            ? (element.value || '0')
            : (element.textContent ?? '').trim();
        context.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
        const text = context.measureText(value).width;
        const content =
          rect.width -
          (parseFloat(styles.paddingLeft) || 0) -
          (parseFloat(styles.paddingRight) || 0) -
          (parseFloat(styles.borderLeftWidth) || 0) -
          (parseFloat(styles.borderRightWidth) || 0);
        if (text > content) {
          out.push(`${element.getAttribute('aria-label') ?? element.tagName} "${value}" text=${Math.round(text)} content=${Math.round(content)}`);
        }
      }
      return out;
    });

    expect(clipped, clipped.join('\n')).toEqual([]);
  });
}

test('inspector nested radii are not inverted (inner <= outer)', async ({ page }) => {
  await openInspector(page, true);

  const violations = await collect(page, '.ic-inspector', (root, pill) => {
    const out: string[] = [];
    for (const parent of [...root.querySelectorAll('*')]) {
      const parentStyles = getComputedStyle(parent);
      const outer = parseFloat(parentStyles.borderTopLeftRadius) || 0;
      if (outer === 0 || outer >= pill) continue;
      const padding = parseFloat(parentStyles.paddingTop) || 0;
      for (const child of [...parent.children]) {
        const inner = parseFloat(getComputedStyle(child).borderTopLeftRadius) || 0;
        if (inner === 0 || inner >= pill) continue;
        if (inner > outer) {
          out.push(`${String(child.className).slice(0, 48)} inner=${inner} outer=${outer} padding=${padding}`);
        }
      }
    }
    return out;
  });

  expect(violations, violations.join('\n')).toEqual([]);
});

test('inspector transitions name their properties and use the project curve', async ({ page }) => {
  await openInspector(page, true);

  const findings = await collect(page, '.ic-inspector', (root) => {
    const out: string[] = [];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const styles = getComputedStyle(element);
      const durations = styles.transitionDuration.split(',').map((value) => parseFloat(value) || 0);
      const animates = durations.some((value) => value > 0);
      if (!animates) continue;
      const label = String(element.className).slice(0, 40) || element.tagName.toLowerCase();
      if (styles.transitionProperty === 'all') out.push(`transition: all -> ${label}`);
      if (styles.transitionTimingFunction.includes('0.4, 0, 0.2, 1')) {
        out.push(`default ease instead of cubic-bezier(0.2, 0, 0, 1) -> ${label}`);
      }
    }
    return out;
  });

  expect(findings, findings.join('\n')).toEqual([]);
});

test('ui lab nested radii are not inverted', async ({ page }) => {
  await page.goto('/icon-core/app/?theme=dark#/ui');
  await expect(page.getByRole('heading', { name: 'Component gallery' })).toBeVisible();

  const violations = await collect(page, 'main', (root, pill) => {
    const out: string[] = [];
    for (const parent of [...root.querySelectorAll('*')]) {
      const parentStyles = getComputedStyle(parent);
      const outer = parseFloat(parentStyles.borderTopLeftRadius) || 0;
      if (outer === 0 || outer >= pill) continue;
      const padding = parseFloat(parentStyles.paddingTop) || 0;
      for (const child of [...parent.children]) {
        const inner = parseFloat(getComputedStyle(child).borderTopLeftRadius) || 0;
        if (inner === 0 || inner >= pill) continue;
        if (inner > outer) {
          out.push(`${String(child.className).slice(0, 48)} inner=${inner} outer=${outer} padding=${padding}`);
        }
      }
    }
    return out;
  });

  // Ratchet: the UI Lab is fixture markup whose radii follow the design tokens;
  // the recorded cases are nested controls, not nested surfaces. The spec
  // redefines the Lab's radius scale, so this number may only go down.
  const LAB_BASELINE = 0;
  expect(violations.length, violations.join('\n')).toBeLessThanOrEqual(LAB_BASELINE);
});

/**
 * Focus ownership (critique §4, decision B): every interactive control must show
 * a visible indicator when focused — either the base outline or an equivalent
 * treatment of its own. Measured by diffing computed styles before/after focus,
 * so it covers any indicator (outline, ring, border, background).
 */
test('every interactive control shows a focus indicator', async ({ page }) => {
  await openInspector(page, true);

  // Real keyboard focus: script `focus()` does not reliably match `:focus-visible`
  // in Chromium, so the audit walks the tab order and reads the active element.
  const missing = new Set<string>();

  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press('Tab');
    const current = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const styles = getComputedStyle(element);
      const outline =
        styles.outlineStyle !== 'none' && (parseFloat(styles.outlineWidth) || 0) > 0;
      return {
        key: `${element.tagName.toLowerCase()}.${String(element.className).split(' ').slice(0, 2).join('.').slice(0, 40)}`,
        label: element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 18),
        // Any of these is a visible indicator: the base outline, a ring/shadow, or
        // a border/background change owned by the component.
        hasIndicator: outline || styles.boxShadow !== 'none'
      };
    });
    if (!current) break;
    if (!current.hasIndicator) missing.add(`${current.key} [${current.label}]`);
  }

  expect([...missing], `sem indicador de foco:\n${[...missing].join('\n')}`).toEqual([]);
});

/**
 * Optical alignment (better-ui): an icon beside a label must sit on the text's
 * *optical* centre, not merely its bounding-box centre. Measured with a Range
 * over the label's text node; tolerance is 1px. First pass: every control was
 * between 0.13px and 0.81px, so this locks the behaviour instead of fixing a defect.
 */
test('icon and label share an optical centre', async ({ page }) => {
  await openInspector(page, true);

  const offsets = await page.evaluate(() => {
    const out: string[] = [];
    for (const control of document.querySelectorAll('button, [role="menuitem"]')) {
      const svg = control.querySelector('svg');
      if (!svg) continue;
      const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
      let node: Node | null = null;
      while (walker.nextNode()) {
        if ((walker.currentNode.textContent ?? '').trim().length > 1) {
          node = walker.currentNode;
          break;
        }
      }
      if (!node) continue;

      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      const icon = svg.getBoundingClientRect();
      if (text.height === 0 || icon.height === 0) continue;

      const offset = icon.top + icon.height / 2 - (text.top + text.height / 2);
      if (Math.abs(offset) > 1) {
        out.push(`${String(control.className).slice(0, 30)} "${node.textContent?.trim().slice(0, 14)}" offset=${offset.toFixed(2)}px`);
      }
    }
    return out;
  });

  expect(offsets, offsets.join('\n')).toEqual([]);
});

/**
 * F6 sweep: the surfaces beyond the inspector are measured the same way, so the
 * panel language holds everywhere (they were clean on the first pass — this keeps
 * them that way). Wrapping text and `truncate` are skipped: they are not clipping.
 */
const SURFACES: Array<{ name: string; selector: string; needsProject: boolean }> = [
  { name: 'welcome modal', selector: '.ic-welcome-modal', needsProject: false },
  { name: 'layers panel', selector: '.ic-layer-list', needsProject: true },
  { name: 'action bar', selector: '.ic-action-bar', needsProject: true },
  { name: 'topbar', selector: '.ic-topbar, header', needsProject: true }
];

for (const surface of SURFACES) {
  test(`${surface.name} does not clip control text`, async ({ page }) => {
    await page.goto('/icon-core/app/?theme=dark');
    if (surface.needsProject) {
      await page.getByRole('button', { name: /^Create$/i }).first().click();
      await page.waitForTimeout(800);
    }

    const clipped = await collect(page, surface.selector, (root) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const out: string[] = [];
      for (const element of [...root.querySelectorAll('input, select, button, span, label, p, strong')]) {
        const styles = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || !context) continue;
        if (element.children.length > 0 && element.tagName !== 'BUTTON') continue;
        const raw = element.tagName === 'SELECT'
          ? element.selectedOptions[0]?.textContent ?? ''
          : (element as HTMLInputElement).value ?? element.textContent ?? '';
        const text = raw.trim();
        if (text.length < 2) continue;
        if (element.tagName !== 'SELECT' && element.tagName !== 'INPUT') {
          if (styles.whiteSpace !== 'nowrap' || styles.textOverflow === 'ellipsis') continue;
        }
        context.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
        const needed = context.measureText(text).width;
        const content =
          rect.width -
          (parseFloat(styles.paddingLeft) || 0) -
          (parseFloat(styles.paddingRight) || 0) -
          (parseFloat(styles.borderLeftWidth) || 0) -
          (parseFloat(styles.borderRightWidth) || 0);
        if (needed > content + 1) {
          out.push(`${element.tagName.toLowerCase()}.${String(element.className).slice(0, 30)} "${text.slice(0, 16)}" ${Math.round(needed)}>${Math.round(content)}`);
        }
      }
      return out;
    });

    expect(clipped, clipped.join('\n')).toEqual([]);
  });
}

/**
 * Icon stroke follows the adjacent text weight (better-ui `icons.md`): a 24-grid
 * icon beside regular (400) text carries 1.5px, so a bare lucide default (2px)
 * must never land there. Text at 500+ keeps the set's native 2px. The kit's
 * `Button`/`MenuItem` own the rule; this locks the app's raw markup to the same
 * scale. Fill-only marks (brand logo, GitHub glyph) carry no stroke and are out
 * of scope; icon-only controls have no adjacent text.
 */
test('icon stroke matches the adjacent text weight', async ({ page }) => {
  const violations: string[] = [];

  const audit = async (scope: string, state: string) => {
    const found = await page.locator(scope).first().evaluate((root) => {
      const out: string[] = [];
      for (const control of [...root.querySelectorAll('button, a, [role="menuitem"]')]) {
        const svg = control.querySelector('svg');
        if (!svg || svg.getAttribute('stroke-width') === null) continue;

        const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
        let node: Node | null = null;
        while (walker.nextNode()) {
          if ((walker.currentNode.textContent ?? '').trim().length > 1) {
            node = walker.currentNode;
            break;
          }
        }
        if (!node) continue;

        const weight = parseFloat(getComputedStyle(node.parentElement ?? control).fontWeight) || 400;
        if (weight >= 500) continue;

        const stroke = parseFloat(svg.getAttribute('stroke-width') ?? '');
        if (Math.abs(stroke - 1.5) > 0.01) {
          out.push(
            `${control.tagName.toLowerCase()}.${String(control.className).slice(0, 30)} "${node.textContent?.trim().slice(0, 16)}" stroke=${stroke} weight=${weight}`
          );
        }
      }
      return out;
    });
    violations.push(...found.map((entry) => `[${state}] ${entry}`));
  };

  // Welcome (no project): the editor renders behind the welcome modal.
  await page.goto('/icon-core/app/?theme=dark');
  await expect(page.locator('.ic-welcome-modal')).toBeVisible();
  await audit('body', 'welcome');

  // Editor with a shape: topbar, layers panel, action bar, inspector.
  await openInspector(page, true);
  await audit('body', 'editor');

  // Variant panel (a non-default variant is generatable).
  await page.keyboard.press('2');
  await expect(page.locator('.ic-variant-panel')).toBeVisible();
  await audit('.ic-variant-panel', 'variant panel');

  // Export Utilities.
  await page.getByRole('button', { name: /export icon pack/i }).click();
  await expect(page.getByRole('heading', { name: 'Export Utilities' })).toBeVisible();
  await audit('body', 'export');

  // About modal (portalled to <body>; audited last, so it need not be dismissed).
  await page.getByRole('button', { name: /back to edit space/i }).click();
  await page.getByRole('button', { name: /about/i }).click();
  await expect(page.locator('.ic-about-modal')).toBeVisible();
  await audit('.ic-about-modal', 'about modal');

  expect(violations, violations.join('\n')).toEqual([]);
});

/**
 * A fixed overlay must be positioned against the viewport, not an ancestor
 * containing block: `backdrop-filter` on the topbar `<header>` turns
 * `position: fixed` descendants into header-relative ones, which trapped the
 * About modal inside the 50px header and pushed it off-screen. The modal is
 * portalled to `<body>` — this locks the overlay to the viewport and keeps the
 * dialog (and its close affordance) on screen.
 */
test('modal overlays cover the viewport', async ({ page }) => {
  await openInspector(page, false);
  await page.getByRole('button', { name: /about/i }).click();
  await expect(page.locator('.ic-about-modal')).toBeVisible();

  const viewport = page.viewportSize()!;
  const overlay = await page.locator('.ic-about-modal').evaluate((element) => {
    const rect = element.parentElement!.getBoundingClientRect();
    return { top: rect.top, height: rect.height };
  });
  expect(overlay.top, 'overlay starts at the viewport top').toBeLessThanOrEqual(1);
  expect(overlay.height, 'overlay fills the viewport').toBeGreaterThanOrEqual(viewport.height - 1);

  const dialog = await page.locator('.ic-about-modal').boundingBox();
  expect(dialog!.y, 'dialog top is on screen').toBeGreaterThanOrEqual(0);
  expect(dialog!.y + dialog!.height, 'dialog bottom is on screen').toBeLessThanOrEqual(viewport.height + 1);

  await page.locator('.ic-about-modal .ic-modal-close').click();
  await expect(page.locator('.ic-about-modal')).toBeHidden();
});

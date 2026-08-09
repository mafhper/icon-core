const DANGEROUS_ATTRS = [
  /^on/i,
  /^href\s*=\s*["']?javascript:/i,
  /^xlink:href\s*=\s*["']?javascript:/i
];

const SANITIZE_PATTERN = /<\s*(\/?\s*)(script|iframe|object|embed|applet|form|input|button|select|textarea|link|meta|style|title|noscript)([^>]*)>/gi;

export const sanitizeSvg = (svgString: string): string => {
  let sanitized = svgString;

  sanitized = sanitized.replace(SANITIZE_PATTERN, '');

  sanitized = sanitized.replace(/<([a-zA-Z][a-zA-Z0-9]*)\s([^>]*)>/gi, (match, tag, attrs) => {
    let cleanAttrs = attrs;
    for (const pattern of DANGEROUS_ATTRS) {
      cleanAttrs = cleanAttrs.replace(new RegExp(`\\s+[a-zA-Z][-a-zA-Z0-9]*\\s*=\\s*(?:"[^"]*"|'[^']*'|\\S+)`, 'g'), (attrMatch: string) => {
        return pattern.test(attrMatch) ? '' : attrMatch;
      });
    }
    return `<${tag} ${cleanAttrs.trim()}>`;
  });

  return sanitized;
};

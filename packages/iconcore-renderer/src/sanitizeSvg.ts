const DANGEROUS_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'link',
  'meta',
  'style',
  'title',
  'noscript'
]);

const SAFE_DATA_IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/gif;base64,',
  'data:image/webp;base64,',
  'data:image/avif;base64,'
];

const isWhitespace = (character: string): boolean =>
  character === ' ' || character === '\t' || character === '\n' || character === '\r' || character === '\f';

const isNameCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    character === '-' ||
    character === '_' ||
    character === ':' ||
    character === '.'
  );
};

const readTag = (tag: string): { closing: boolean; name: string; nameEnd: number } => {
  let index = 1;
  while (index < tag.length && isWhitespace(tag[index])) index += 1;

  const closing = tag[index] === '/';
  if (closing) index += 1;
  while (index < tag.length && isWhitespace(tag[index])) index += 1;

  const nameStart = index;
  while (index < tag.length && isNameCharacter(tag[index])) index += 1;

  return { closing, name: tag.slice(nameStart, index).toLowerCase(), nameEnd: index };
};

const isDangerousTag = (name: string): boolean => {
  const localName = name.slice(name.lastIndexOf(':') + 1);
  return DANGEROUS_TAGS.has(localName);
};

const findTagEnd = (input: string, start: number): { end: number; nested: boolean } => {
  let quote = '';
  for (let index = start + 1; index < input.length; index += 1) {
    const character = input[index];
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '<') {
      return { end: index, nested: true };
    } else if (character === '>') {
      return { end: index, nested: false };
    }
  }
  return { end: input.length, nested: false };
};

const decodeNumericReferences = (value: string): string =>
  value.replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));?/gi, (reference, hex, decimal) => {
    const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference;
  });

const isDangerousUrl = (value: string): boolean => {
  const decoded = decodeNumericReferences(value);
  let normalized = '';
  for (const character of decoded) {
    const code = character.charCodeAt(0);
    if (code > 0x20 && (code < 0x7f || code > 0x9f)) normalized += character;
  }
  normalized = normalized
    .toLowerCase()
    .replaceAll('&colon;', ':')
    .replaceAll('&tab;', '')
    .replaceAll('&newline;', '');
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) return true;
  if (normalized.startsWith('data:')) {
    return !SAFE_DATA_IMAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }
  return false;
};

const sanitizeAttributes = (tag: string, nameEnd: number): string => {
  const contentEnd = tag.length - 1;
  let index = nameEnd;
  let sanitized = tag.slice(0, nameEnd);

  while (index < contentEnd) {
    const segmentStart = index;
    while (index < contentEnd && isWhitespace(tag[index])) index += 1;

    if (index >= contentEnd || tag[index] === '/') {
      sanitized += tag.slice(segmentStart, contentEnd);
      break;
    }

    const attributeStart = index;
    while (index < contentEnd && isNameCharacter(tag[index])) index += 1;
    if (attributeStart === index) {
      sanitized += tag.slice(segmentStart, index + 1);
      index += 1;
      continue;
    }

    const attributeName = tag.slice(attributeStart, index).toLowerCase();
    while (index < contentEnd && isWhitespace(tag[index])) index += 1;

    let value = '';
    if (tag[index] === '=') {
      index += 1;
      while (index < contentEnd && isWhitespace(tag[index])) index += 1;
      const quote = tag[index] === '"' || tag[index] === "'" ? tag[index] : '';
      if (quote) index += 1;
      const valueStart = index;
      if (quote) {
        while (index < contentEnd && tag[index] !== quote) index += 1;
      } else {
        while (index < contentEnd && !isWhitespace(tag[index]) && tag[index] !== '/') index += 1;
      }
      value = tag.slice(valueStart, index);
      if (quote && tag[index] === quote) index += 1;
    }

    const executableAttribute =
      attributeName.startsWith('on') ||
      ((attributeName === 'href' || attributeName === 'xlink:href') && isDangerousUrl(value));
    if (!executableAttribute) sanitized += tag.slice(segmentStart, index);
  }

  return `${sanitized}>`;
};

export const sanitizeSvg = (svgString: string): string => {
  let cursor = 0;
  let sanitized = '';

  while (cursor < svgString.length) {
    const tagStart = svgString.indexOf('<', cursor);
    if (tagStart === -1) {
      sanitized += svgString.slice(cursor);
      break;
    }

    sanitized += svgString.slice(cursor, tagStart);
    const { end, nested } = findTagEnd(svgString, tagStart);
    if (nested) {
      cursor = tagStart + 1;
      continue;
    }

    const tag = svgString.slice(tagStart, Math.min(end + 1, svgString.length));
    const tagInfo = readTag(tag);
    if (end === svgString.length) {
      if (!isDangerousTag(tagInfo.name)) sanitized += tag;
      break;
    }

    if (!isDangerousTag(tagInfo.name)) {
      sanitized += tagInfo.closing || !tagInfo.name ? tag : sanitizeAttributes(tag, tagInfo.nameEnd);
    }
    cursor = end + 1;
  }

  return sanitized;
};

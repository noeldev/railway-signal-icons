// svg-size.mjs
// Display size (width/height attributes) of the root <svg> element. Source
// icons have none: their viewBox holds the real dimensions in millimetres.
// Export sets the size from the viewBox at a given scale, import removes it.
// Only the opening tag is touched, every other byte is kept as is, so that
// removing then setting the same size gives back the original file.

import { MAP_SCALE_PERCENT, parseSvgOpenTag, parseViewBox } from './shared.mjs';

const OPEN_TAG = /<svg\b[^>]*>/;
const SIZE_ATTR = /\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g;
const VIEWBOX_ATTR = /\sviewBox\s*=/;

const roundQuarter = (v) => Math.round(v * 4) / 4;

/** Parsed viewBox of the root <svg> element, or null. */
export const svgViewBox = (source) => parseViewBox(parseSvgOpenTag(source).viewBox);

/** Display size of a viewBox at `scale` percent, rounded to the nearest 0.25. */
export function scaledSize(viewBox, scale = MAP_SCALE_PERCENT) {
  return { width: roundQuarter(viewBox.w * scale / 100), height: roundQuarter(viewBox.h * scale / 100) };
}

/** Removes width/height from the root <svg> element. */
export function removeSize(source) {
  return source.replace(OPEN_TAG, (tag) => tag.replace(SIZE_ATTR, ''));
}

/**
 * Sets width/height on the root <svg> element, just before viewBox (the
 * order the map generator and the existing icons use). Returns null when the
 * root element has no viewBox.
 */
export function setSize(source, { width, height }) {
  const match = source.match(OPEN_TAG);
  if (!match || !VIEWBOX_ATTR.test(match[0])) return null;
  const tag = match[0].replace(SIZE_ATTR, '').replace(VIEWBOX_ATTR, (attr) => ` width="${width}" height="${height}"${attr}`);
  return source.slice(0, match.index) + tag + source.slice(match.index + match[0].length);
}

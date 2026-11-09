#!/usr/bin/env node
// import-icons.mjs
//
// Copies the icons of one country from the fork (<fork>/symbols/<country>)
// into the source tree (icons/<country>), removing their width/height:
// a source icon only keeps its viewBox, in millimetres, and export sets the
// display size again. Layout helper files (name starting with "_") keep
// their hand-set size.
//
// Used to create the source tree from the fork. Existing source icons are
// never replaced unless --overwrite is given, since the source tree is the
// reference and the fork only holds exported copies.
//
// Usage:
//   node tools/import-icons.mjs                  # fr, keeps existing icons
//   node tools/import-icons.mjs --country fr --overwrite

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { ICONS_ROOT, HELPER_FILE_PREFIX, color, isHelperFile, parseSvgOpenTag, toPosix, walkFiles } from './lib/shared.mjs';
import { ormPaths } from './lib/config.mjs';
import { removeSize, scaledSize, svgViewBox } from './lib/svg-size.mjs';

const HELP = `
Usage: node tools/import-icons.mjs [options]

Copies <fork>/symbols/<country> into icons/<country>, without width/height.

Options:
  --country <code>   Country folder to import (default: fr)
  --overwrite        Replace source icons that already exist and differ
  -h, --help         Show this help

Files whose name starts with "${HELPER_FILE_PREFIX}" are copied with their size.
`;

function parseArgs(argv) {
  const opts = { country: 'fr', overwrite: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--country') opts.country = argv[++i];
    else if (a === '--overwrite') opts.overwrite = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!opts.country) throw new Error('--country needs a value');
  return opts;
}

// Source content of one fork icon, with a warning when its size was not the
// one export will set again (that size would be lost).
function toSource(raw, rel) {
  const viewBox = svgViewBox(raw);
  if (!viewBox) return { error: 'no viewBox' };
  const attrs = parseSvgOpenTag(raw);
  const expected = scaledSize(viewBox);
  const custom = attrs.width !== undefined
    && (Number(attrs.width) !== expected.width || Number(attrs.height) !== expected.height);
  if (custom) console.warn(color.yellow(`WARN: ${rel}: size ${attrs.width} x ${attrs.height} differs from ${expected.width} x ${expected.height}, it will be reset on export`));
  return { content: removeSize(raw) };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return 0; }

  const sourceDir = join(ormPaths().symbols, opts.country);
  const targetDir = join(ICONS_ROOT, opts.country);
  if (!existsSync(sourceDir)) {
    console.error(color.red(`ERROR: directory not found: ${sourceDir}`));
    return 1;
  }

  console.log(color.cyan(`From : ${sourceDir}`));
  console.log(color.cyan(`To   : ${targetDir}`));
  console.log();

  const counts = { imported: 0, unchanged: 0, kept: 0, failed: 0 };
  for await (const file of walkFiles(sourceDir, { ext: '.svg', skipDirs: ['_backup'] })) {
    const rel = toPosix(relative(sourceDir, file));
    const raw = await readFile(file, 'utf8');
    const { content, error } = isHelperFile(file) ? { content: raw } : toSource(raw, rel);
    if (error) {
      console.warn(color.yellow(`WARN: ${rel}: ${error}, skipped`));
      counts.failed++;
      continue;
    }

    const target = join(targetDir, rel);
    if (existsSync(target)) {
      const current = await readFile(target, 'utf8');
      if (current === content) { counts.unchanged++; continue; }
      if (!opts.overwrite) {
        console.warn(color.yellow(`KEPT: ${rel} (source icon differs, use --overwrite to replace it)`));
        counts.kept++;
        continue;
      }
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
    counts.imported++;
  }

  console.log();
  console.log(color.cyan('===== Summary ====='));
  console.log(color.green(`  Imported  : ${counts.imported}`));
  console.log(`  Unchanged : ${counts.unchanged}`);
  console.log(counts.kept ? color.yellow(`  Kept      : ${counts.kept} (existing source icons)`) : '  Kept      : 0');
  console.log(counts.failed ? color.yellow(`  Skipped   : ${counts.failed} (no viewBox)`) : '  Skipped   : 0');
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error(color.red(`ERROR: ${err.message}`));
  process.exitCode = 1;
}

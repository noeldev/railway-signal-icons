#!/usr/bin/env node
// resize-icons.mjs
//
// Sets the width/height of icons already in place (by default the icons of
// the fork, <fork>/symbols/<country>) from their viewBox at a given scale,
// without copying the source icons again: export does both, resize only
// changes the display size. Layout helper files (name starting with "_")
// keep their hand-set size.
//
// Only files whose content changes are written. With no --target, only the
// country folders present in icons/ are resized: the other icons of the fork
// are never touched. The fork is under version control, so no backup is
// made.
//
// Usage:
//   node tools/resize-icons.mjs --dry-run
//   node tools/resize-icons.mjs --scale 3
//   node tools/resize-icons.mjs --target <dir> --scale 5

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { HELPER_FILE_PREFIX, MAP_SCALE_PERCENT, color, iconCountries, toPosix, walkFiles } from './lib/shared.mjs';
import { ormPaths } from './lib/config.mjs';
import { sizedIcon } from './lib/svg-size.mjs';

const SKIP_DIRS = ['_backup'];

const HELP = `
Usage: node tools/resize-icons.mjs [options]

Sets width/height from the viewBox on icons already in place.

Options:
  --target <dir>     Icon tree to resize (default: the country folders of
                     icons/ in <fork>/symbols, see tools/config.json)
  --scale <percent>  Scale applied to the viewBox (default: ${MAP_SCALE_PERCENT})
  --dry-run          List the changes without writing anything
  -h, --help         Show this help

Files whose name starts with "${HELPER_FILE_PREFIX}" keep their size.
`;

function parseArgs(argv) {
  const opts = { target: null, scale: MAP_SCALE_PERCENT, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') opts.target = argv[++i];
    else if (a === '--scale') opts.scale = Number(argv[++i]);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!Number.isFinite(opts.scale) || opts.scale <= 0) throw new Error('invalid --scale value');
  return opts;
}

// Folders to resize: --target, or the fork folder of every source country.
async function targetDirs(opts) {
  if (opts.target) return [opts.target];
  const symbols = ormPaths().symbols;
  return (await iconCountries()).map((country) => join(symbols, country));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return 0; }

  const dirs = await targetDirs(opts);
  const missing = dirs.find((dir) => !existsSync(dir));
  if (missing) {
    console.error(color.red(`ERROR: directory not found: ${missing}`));
    return 1;
  }

  for (const dir of dirs) console.log(color.cyan(`Target : ${dir}`));
  console.log(color.cyan(`Scale  : ${opts.scale}%`));
  console.log(color.cyan(`Mode   : ${opts.dryRun ? 'DRY-RUN' : 'WRITE'}`));
  console.log();

  const prefix = opts.dryRun ? '[DRY] ' : '';
  const counts = { updated: 0, unchanged: 0, failed: 0 };
  for (const dir of dirs) {
    for await (const file of walkFiles(dir, { ext: '.svg', skipDirs: SKIP_DIRS })) {
      const rel = toPosix(relative(dir, file));
      const raw = await readFile(file, 'utf8');
      const { content, error } = sizedIcon(raw, file, opts.scale);
      if (error) {
        console.warn(color.yellow(`WARN: ${rel}: ${error}, skipped`));
        counts.failed++;
        continue;
      }
      if (content === raw) { counts.unchanged++; continue; }
      console.log(`${prefix}Updated ${rel}`);
      counts.updated++;
      if (!opts.dryRun) await writeFile(file, content, 'utf8');
    }
  }

  console.log();
  console.log(color.cyan('===== Summary ====='));
  console.log(color.green(`  Updated   : ${counts.updated}`));
  console.log(`  Unchanged : ${counts.unchanged}`);
  console.log(counts.failed ? color.yellow(`  Skipped   : ${counts.failed} (no viewBox)`) : '  Skipped   : 0');
  if (opts.dryRun) console.log(color.yellow('\nDry-run only - nothing was written.'));
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error(color.red(`ERROR: ${err.message}`));
  process.exitCode = 1;
}

#!/usr/bin/env node
// export-icons.mjs
//
// Copies the source icons (icons/<country>/...) into the fork
// (<fork>/symbols/<country>/...), with width/height set from the viewBox at
// the map scale. Layout helper files (name starting with "_") are copied as
// they are, their size being set by hand.
//
// Only files whose content changes are written, so a rerun leaves the fork
// untouched. Fork icons with no source icon (renamed or removed sources) are
// listed, and deleted with --prune. Only the country folders present in
// icons/ are compared: the other icons of the fork are never touched.
//
// Usage:
//   node tools/export-icons.mjs --dry-run
//   node tools/export-icons.mjs
//   node tools/export-icons.mjs --prune
//   node tools/export-icons.mjs --target <dir> --scale 5
//
// To change the size of icons already in place without copying them again,
// see resize-icons.mjs.

import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { ICONS_ROOT, HELPER_FILE_PREFIX, MAP_SCALE_PERCENT, color, iconCountries, toPosix, walkFiles } from './lib/shared.mjs';
import { ormPaths } from './lib/config.mjs';
import { sizedIcon } from './lib/svg-size.mjs';

const SKIP_DIRS = ['_backup'];

const HELP = `
Usage: node tools/export-icons.mjs [options]

Copies icons/ into <fork>/symbols/ with width/height set from the viewBox.

Options:
  --target <dir>     Icon tree to write (default: <fork>/symbols from tools/config.json)
  --scale <percent>  Scale applied to the viewBox (default: ${MAP_SCALE_PERCENT})
  --prune            Delete target icons that have no source icon
  --dry-run          List the changes without writing anything
  -h, --help         Show this help

Files whose name starts with "${HELPER_FILE_PREFIX}" are copied with their size.
`;

function parseArgs(argv) {
  const opts = { target: null, scale: MAP_SCALE_PERCENT, prune: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') opts.target = argv[++i];
    else if (a === '--scale') opts.scale = Number(argv[++i]);
    else if (a === '--prune') opts.prune = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!Number.isFinite(opts.scale) || opts.scale <= 0) throw new Error('invalid --scale value');
  return opts;
}

// Relative paths (posix) of the source icons.
async function sourceIcons() {
  const icons = [];
  for await (const file of walkFiles(ICONS_ROOT, { ext: '.svg', skipDirs: SKIP_DIRS })) {
    icons.push(toPosix(relative(ICONS_ROOT, file)));
  }
  return icons.sort();
}

// Target icons of the exported country folders that have no source icon.
async function orphanIcons(targetRoot, icons) {
  const known = new Set(icons);
  const orphans = [];
  for (const country of await iconCountries()) {
    for await (const file of walkFiles(join(targetRoot, country), { ext: '.svg', skipDirs: SKIP_DIRS })) {
      const rel = toPosix(relative(targetRoot, file));
      if (!known.has(rel)) orphans.push(rel);
    }
  }
  return orphans.sort();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return 0; }

  const targetRoot = opts.target ?? ormPaths().symbols;
  if (!existsSync(ICONS_ROOT)) {
    console.error(color.red(`ERROR: directory not found: ${ICONS_ROOT}`));
    return 1;
  }
  if (!existsSync(targetRoot)) {
    console.error(color.red(`ERROR: directory not found: ${targetRoot}`));
    return 1;
  }

  console.log(color.cyan(`From  : ${ICONS_ROOT}`));
  console.log(color.cyan(`To    : ${targetRoot}`));
  console.log(color.cyan(`Scale : ${opts.scale}%`));
  console.log(color.cyan(`Mode  : ${opts.dryRun ? 'DRY-RUN' : 'WRITE'}`));
  console.log();

  const prefix = opts.dryRun ? '[DRY] ' : '';
  const counts = { added: 0, updated: 0, unchanged: 0, failed: 0, pruned: 0 };
  const icons = await sourceIcons();
  for (const rel of icons) {
    const raw = await readFile(join(ICONS_ROOT, rel), 'utf8');
    const { content, error } = sizedIcon(raw, rel, opts.scale);
    if (error) {
      console.warn(color.yellow(`WARN: ${rel}: ${error}, skipped`));
      counts.failed++;
      continue;
    }

    const target = join(targetRoot, rel);
    const exists = existsSync(target);
    if (exists && await readFile(target, 'utf8') === content) { counts.unchanged++; continue; }
    console.log(`${prefix}${exists ? 'Updated' : 'Added  '} ${rel}`);
    counts[exists ? 'updated' : 'added']++;
    if (!opts.dryRun) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
    }
  }

  const orphans = await orphanIcons(targetRoot, icons);
  for (const rel of orphans) {
    if (opts.prune) {
      console.log(color.yellow(`${prefix}Deleted ${rel}`));
      if (!opts.dryRun) await unlink(join(targetRoot, rel));
      counts.pruned++;
    } else {
      console.log(color.yellow(`No source: ${rel}`));
    }
  }

  console.log();
  console.log(color.cyan('===== Summary ====='));
  console.log(color.green(`  Added     : ${counts.added}`));
  console.log(color.green(`  Updated   : ${counts.updated}`));
  console.log(`  Unchanged : ${counts.unchanged}`);
  console.log(counts.failed ? color.yellow(`  Skipped   : ${counts.failed} (no viewBox)`) : '  Skipped   : 0');
  if (opts.prune) console.log(color.yellow(`  Deleted   : ${counts.pruned}`));
  else if (orphans.length) console.log(color.yellow(`  No source : ${orphans.length} (use --prune to delete them)`));
  if (opts.dryRun) console.log(color.yellow('\nDry-run only - nothing was written.'));
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error(color.red(`ERROR: ${err.message}`));
  process.exitCode = 1;
}

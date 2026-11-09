// config.mjs
// Location of the OpenRailwayMap-vector fork, read from tools/config.json.
// The fork provides the signal YAML (render, check) and the non-FR icons
// (general/...) used by render; export writes the icons into its symbols/.
// A relative ormRoot is resolved from the project root.

import fs from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { PROJECT_ROOT, TOOLS_DIR } from './shared.mjs';

/** Configuration file: <project>/tools/config.json */
export const CONFIG_FILE = join(TOOLS_DIR, 'config.json');

let paths = null;

/**
 * Paths of the fork, read once from CONFIG_FILE:
 *   root    - the fork
 *   symbols - <fork>/symbols
 *   yaml    - <fork>/features/signals_railway_signals.yaml
 * Throws when the file is missing or has no "ormRoot".
 */
export function ormPaths() {
  if (paths) return paths;
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read ${CONFIG_FILE}: ${err.message}`);
  }
  if (typeof config.ormRoot !== 'string' || !config.ormRoot) {
    throw new Error(`${CONFIG_FILE}: "ormRoot" (path of the OpenRailwayMap-vector fork) is required`);
  }
  const root = isAbsolute(config.ormRoot) ? config.ormRoot : resolve(PROJECT_ROOT, config.ormRoot);
  paths = {
    root,
    symbols: join(root, 'symbols'),
    yaml: join(root, 'features', 'signals_railway_signals.yaml'),
  };
  return paths;
}

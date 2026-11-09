# Railway signal icons

Vector icons of railway signals, drawn to the scale of the real signals,
with the tools that check them, render them and export them for map use.

The icons were first drawn for the French railway signalling of
[OpenRailwayMap-vector](https://github.com/hiddewie/OpenRailwayMap-vector),
and are kept here so they can be reused by other projects.

## Icons

```
icons/
  fr/          French signals (SNCF network)
    boards/    illuminated boards
    boxes/     light boxes, as a base box plus one overlay per aspect
    plates/    plates
    signals/   light signals, as a head plus one overlay per aspect
    signs/     signs
```

Every icon is an SVG whose `viewBox` is in millimetres: 1 unit is 1 mm of
the real signal, so all icons share the same scale. A source icon has no
`width`/`height`; the display size is set when the icons are exported for a
given use (2.5 % of the `viewBox` for the map).

Many signals are made of layers drawn on top of each other: a base (box,
head, empty sign) and one overlay per aspect or value, never a single file
with both.

Files whose name starts with `_` (e.g. `_spacer.svg`) are layout helpers,
not icons.

## Tools

The `tools/` folder holds the command-line tools (Node.js): audit, SVG
optimization, rendering of OSM nodes or tag sets laid out like the map, and
export into an OpenRailwayMap-vector fork. See [tools/README.md](tools/README.md).

```
cd tools
npm install
node icons.mjs --help
```

## Workflow

1. Edit or add icons in `icons/`.
2. `node tools/icons.mjs optimize --subdir <family>` (text to paths, SVGO).
3. `node tools/icons.mjs audit` to review them.
4. `node tools/icons.mjs render ...` to check them in signal compositions.
5. `node tools/icons.mjs export` to copy them into the fork, then commit
   them there.

## License

The icons and the other content of this repository are licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](LICENSE)
(CC BY-SA 4.0). Attribution: noeldev - railway-signal-icons.

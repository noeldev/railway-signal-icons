# Tools

Command-line tools for the railway signal icons: auditing the SVGs,
static-checking the signal YAML of the OpenRailwayMap-vector fork,
preparing icons for the sprite build, exporting them into the fork with
their display size, rendering signals laid out like the map, and generating
the digit/number overlay SVGs used by the speed/length/vehicle-count plates
and the layered light signal icons.

## Configuration

`config.json` gives the location of the OpenRailwayMap-vector fork, either
absolute or relative to the project root:

```json
{
  "ormRoot": "../OpenRailwayMap-vector"
}
```

The fork provides the signal YAML (`check`, `render`), the icons that are
not in `icons/` (`general/...`, other countries) for `render`, and receives
the icons from `export` (`<fork>/symbols`). The other commands only work on
`icons/`.

## Source icons and exported icons

A source icon (`icons/<country>/...`) only has a `viewBox`, in millimetres
(1 unit = 1 mm of the real signal). It has no `width`/`height`: `export`
sets them from the `viewBox` at the map scale (`MAP_SCALE_PERCENT` in
`lib/shared.mjs`, 2.5 %) when it copies the icons into the fork, and
`render` uses the same scale. The icons are only edited here; the fork
holds exported copies.

## Requirements

- Node.js 18+
- `npm install` in this folder (installs `@xmldom/xmldom`, `svgo`, `yaml`,
  and `@resvg/resvg-js` for the PNG output of `render`)
- Inkscape on `PATH` (only needed by `optimize`, for text-to-path conversion)

## Running a tool

Everything goes through the single entry point `icons.mjs`:

```
node tools/icons.mjs <command> [args...]
node tools/icons.mjs <command> --help
node tools/icons.mjs --help
```

| Command    | Script               | Purpose                                             |
|------------|-----------------------|------------------------------------------------------|
| `audit`    | `audit-svg.mjs`       | HTML/text/JSON audit of `icons/fr`                  |
| `check`    | `check-yaml.mjs`      | Static analysis of `signals_railway_signals.yaml`     |
| `optimize` | `optimize-svg.mjs`    | Text-to-path (Inkscape) + SVGO on `icons/fr`        |
| `aspects`  | `generate-aspects.mjs`| Generate overlay SVGs (numbers, signal aspects) from templates |
| `clean-templates` | `clean-templates.mjs` | Resolve leftover transforms on the aspect templates   |
| `render`   | `render-node.mjs`     | Render OSM nodes or tag sets as SVG/PNG, laid out like the map |
| `export`   | `export-icons.mjs`    | Copy `icons/` into the fork, with width/height from viewBox |
| `resize`   | `resize-icons.mjs`    | Set width/height from viewBox on icons already in place (fork) |
| `import`   | `import-icons.mjs`    | Copy fork icons into `icons/`, without width/height  |

Each command can also be run directly (`node tools/audit-svg.mjs ...`);
`icons.mjs` just saves having to remember which file does what.

### audit

```
node tools/icons.mjs audit                        # HTML report (default)
node tools/icons.mjs audit --format text          # plain text table on stdout
node tools/icons.mjs audit --format json          # machine-readable
node tools/icons.mjs audit --root icons/fr/boxes --min 100
node tools/icons.mjs audit --out report.html
```

The HTML report is a single self-contained file. Each icon is defined once
as a `<symbol>` of an SVG sprite at the end of the page, with an id hashed
from its path, and every card draws it with `<use>`; ids inside an icon
(gradients, clip paths) are prefixed with that hash so icons never clash.
An icon containing `<style>` or `<script>` is shown as an isolated `<img>`
instead, so its rules cannot leak into the page.

Besides size and text warnings, an icon carrying `width`/`height` is
flagged: a source icon only has its `viewBox`, `export` sets the size.

### check

```
node tools/icons.mjs check                        # checks the YAML of the fork
node tools/icons.mjs check path/to/other.yaml      # checks a different file
node tools/icons.mjs check --verbose               # also lists sections 5 and 6 in full
```

Six report sections. Sections 1-4 are correctness checks: undeclared tags,
tags declared more than once, duplicated features (same country,
description *and* tag set), and tags repeated within one feature - every
line they print is worth a look. Sections 5-6 are cross-reference listings
that are informative even when nothing is wrong (a plate icon reused by
dozens of features, or a tag that documents more of the OSM schema than
this file currently exercises), so by default they only print a count;
pass `--verbose` to see the full listing.

### optimize

```
node tools/icons.mjs optimize --subdir signals     # one family, recursively
node tools/icons.mjs optimize --all                # the whole icons/fr tree
node tools/icons.mjs optimize --help
```

One of `--subdir` or `--all` is required, since files are rewritten in
place. Runs the same tidy pass as `clean-templates` (see below), then
Inkscape text-to-path conversion (retried up to 5 passes on files that
still contain text), then SVGO, and removes any `width`/`height` left on
the root `<svg>` (Inkscape or a hand edit may add them; layout helpers keep
theirs). A pristine copy of every file it touches is saved once before the
first modification: `tools/_backup/<subdir>/` for a `--subdir` run,
`tools/_backup/` for `--all`.

### render

```
node tools/icons.mjs render 123456789                      # node id, tags from the OSM API
node tools/icons.mjs render 123456789 987654321            # several nodes side by side
node tools/icons.mjs render 123456789 --png                # PNG instead of SVG
node tools/icons.mjs render --tags-file tools/render-examples/compositions.json
node tools/icons.mjs render --tags-file tools/render-examples/compositions.json --page-rows 2 --png
node tools/icons.mjs render 123456789 --tag railway:signal:main:states=FR:VL
node tools/icons.mjs render --tag railway:signal:main=FR:C --tag railway:signal:main:form=light
node tools/icons.mjs render 123456789 --category main,distant --scale 20 --background none
```

Resolves the signals like the ORM import (`signal_features.sql.mjs`: per
signal type, the first matching YAML feature wins; features ordered by
their YAML position, lowest at the bottom) and lays them out like the map:
icons composited by position as in `proxy/js/ui.js`, inline features
(`inline: true` in the YAML, e.g. the single light boxes) drawn side by side,
two per row, features and rows stacked in
one centered pile with a 2 px gap, ORM's generic cross over deactivated
features. In the console, `[category]` is the category the map filters the
feature (or its row) under.

Scenes: every node id, every tag set of a `--tags-file`, is drawn side by
side with its name below, which makes before/after or variant comparisons
easy. Scenes wrap to a new row past `--width` map pixels (default 400, i.e.
4000 px at the default scale; `--width 0` keeps one row); the scenes of a
row share the same baseline, and long names wrap over several lines. Every
row is its own `<g>`. `--page-rows` splits the rows into pages as tall as
the tallest run of that many rows: every page takes the rows that fit in
that height, so short rows share a page. The pages, all of the same size
(the widest row, the tallest page), are written as `<out>-1`, `<out>-2`...
so a long set of examples can be published page by page; with the default
width, 2 rows per page give landscape pages. `--tag key=value` adds or
overrides a tag in every scene, or builds a single scene on its own. A tags
file is either a JSON object of tags (one scene), an array of 
`{ "name": ..., "tags": {...} }`, an object of `name -> tags`, or plain 
`key=value` lines as copied from an editor's text view (one scene, `#` 
comments allowed):

```json
{
  "Carre": { "railway:signal:main": "FR:C", "railway:signal:main:form": "light", "railway:signal:main:shape": "FR:C" },
  "Carre VL": { "railway:signal:main": "FR:C", "railway:signal:main:form": "light", "railway:signal:main:shape": "FR:C", "railway:signal:main:states": "FR:VL" }
}
```

The YAML of the fork and the icons are read in place (uncommitted work
included): an icon is taken from `icons/` first, then from the fork
`symbols/` (`general/...`, other countries), each `--symbols` option
replacing that list, in the order given. A source icon is drawn at the map
scale, so the image is the same as with the exported icons;
the output embeds a copy of every icon it uses, so it can be opened or
shared on its own. Every scene and feature is its own `<g>` (the
feature description as `<title>`), every icon a nested `<svg>` whose ids
are prefixed, so icons using the same ids (gradients `a`, `b`...) do not
pick up each other's definitions.

`--scale` multiplies the map pixel size (an icon is about 20 px wide on
the map): it sets the SVG width/height, i.e. the size it opens at, and
the resolution of a PNG. The default background is a neutral grey with a
soft shadow under each signal, since many icons have white edges;
`--background none` makes it transparent, without shadow. A missing icon
is reported and drawn as `general/signal-unknown`. A PNG is rendered with
the template fonts of `tools/aspects/fonts`, so icons still holding
`<text>` (not yet optimized) render with the SNCF digits.

Ready-made tag files are in `tools/render-examples/`: `cibles.json` (every
light signal target) and `compositions.json` (signals combined on one node),
both objects of `name -> tags`, and `carre.txt` (the `key=value` form).

Like the map, a node shows one feature per signal type
(`railway:signal:<type>` keys listed under `types`), the first matching
section winning, a feature being drawn only for the first type it carries.
All features of a node form a single pile of at most 12 (lowest YAML
position first, unknown signals last); `--category` hides the features of
the other categories (`types[].category`), like the signal filter of the
map. The console lists the category of every feature, and what is not
shown and why. A section that also matches but only checks tags the drawn
section checks too (e.g. the reporting plate without arrow, behind the one
with arrow) is a fallback: it is listed only with `--verbose`. The image is
named after the tags file when it is the only source, otherwise after the
first scene (`--out` overrides both).

Signals sharing a type (e.g. a B and a C TIV-D, both `speed_limit_distant`,
or the R and Km signs) are drawn together when their subkeys are declared as
subtypes of the type (`types[].subtypes`, e.g.
`railway:signal:speed_limit_distant:fast` and `:railcar`): the import then
has one feature column per subtype. Otherwise they need one section drawing
them together, as the TVM stop marker does with the transition marker.
`compositions.json` holds such nodes (e.g. R + Km + B and C TIV-D).

### export

```
node tools/icons.mjs export --dry-run              # list the changes only
node tools/icons.mjs export
node tools/icons.mjs export --prune                # also delete fork icons without source
node tools/icons.mjs export --target <dir> --scale 5
```

Copies every icon of `icons/` into the fork (`<fork>/symbols`, or
`--target`), at the same relative path, with `width`/`height` computed
from its `viewBox` (scaled by `--scale` percent, 2.5 by default, rounded
to the nearest 0.25) and written just before the `viewBox` attribute.
Nothing else in the file changes. Only the files whose content changes are
written, so a rerun leaves the fork untouched and its commits only hold
real changes.

Fork icons of the exported country folders (e.g. `icons/fr`) that have
no source icon (renamed or removed) are listed, and deleted with
`--prune`. The other folders of the fork (`general/`, other countries) are
never touched.

Files whose name starts with `_` (e.g. `_spacer.svg`) are layout helpers,
not icons: their width/height is set by hand, so `export` copies them as
they are, and `audit` leaves them out of the report.

### resize

```
node tools/icons.mjs resize --dry-run              # list the changes only
node tools/icons.mjs resize --scale 3
node tools/icons.mjs resize --target <dir> --scale 5
```

Sets `width`/`height` from the `viewBox` on icons already in place,
without copying the source icons again: `export` does both, `resize` only
changes the display size (same computation, shared in `lib/svg-size.mjs`).
With no `--target`, it works on the fork folders of the countries present
in `icons/` (e.g. `<fork>/symbols/fr`), never on `general/` or the other
countries. Only the files whose content changes are written, and no backup
is made since the fork is under version control. Layout helpers keep their
size.

### import

```
node tools/icons.mjs import                        # fr, keeps existing icons
node tools/icons.mjs import --country fr --overwrite
```

Copies `<fork>/symbols/<country>` into `icons/<country>`, removing the
`width`/`height` of every icon except the layout helpers. Used to create
the source tree from the fork. An icon whose size was not the one `export`
sets is reported, since that size will be reset. Existing source icons that
differ are kept unless `--overwrite` is given: `icons/` is the reference.

### aspects

See the dedicated section below.

## Regenerating the aspect overlays

"Aspects" are the per-value SVGs a plate or board needs: a `TIV-D_B_{90}.svg`
overlay for a speed plate, a `V_split_{10}V_top.svg` overlay for a split
vehicle-count sign, a whole `L{170}.svg` file for a train-length plate, and
so on. There are 400+ of these on disk, all mechanically derived from a much
smaller set of hand-drawn templates - `generate-aspects.mjs` is what
(re)derives them, so a template fix doesn't mean redrawing every value by
hand.

#### Inputs

```
tools/aspects/
  spec.json           # the job list: which template produces which files
  templates/
    signs/*.svg        # hand-drawn templates, one per plate/board family
    boards/*.svg
    boxes/*.svg
    signals/*.svg      # light signal targets (C, F, H, A, K, R, dwarf...)
```

The first folder of a job's template path is its *group* (`signs`,
`boards`, `boxes`, `signals`), used to select which jobs to run.

A template is a normal SVG containing the plate's shape plus one or more
placeholder `<text>` elements (whatever value they currently show is
irrelevant - it's replaced for every generated file).

#### What a job does

`spec.json` is `{ "jobs": [...] }`. Each job names one template and the set
of values to render it with. A job runs in one of five modes:

| Mode (`job.mode`) | Produces | Used for |
|---|---|---|
| `split` (default) | one shape-only base file, plus one text-only overlay file per value (per slot, if more than one) | the usual case: speed/length plates whose shape and number are separate, composited layers (every TIV) |
| `digits` | one shape-only base, plus one overlay per value with *all* its digits set at once | a template that spells a number out as several separately-positioned `<text>` elements instead of one multi-character tspan, for a family that still needs the shape/number split (base+overlay) |
| `fused` | one self-contained file per value (shape + number together), plus an optional shape-only "empty"/placeholder base | a family whose YAML icon has only one state, so a separate base+overlay pair would be pointless (e.g. the `L...` train-length plates). Works with a single `<text>` element (whole value as one string) or several (one digit per element, left-to-right by x position, same per-element assignment as `digits` mode - e.g. the SNCF-Lightbox box digit displays) - the difference from `digits` is that the shape is never stripped out, so each value's file is complete and self-contained |
| `lights` | one all-unlit base, one layer per aspect and per optional part, plus flattened examples | light signal targets: every signal type drawn on the same target (Carre, Carre violet, Semaphore...) shares the same base and layers. See "Light signal targets" below |
| `compose` | one example file flattening existing icons of the symbols tree (`--symbols`, default `icons/fr`), each layer centered on the first | the `exampleIcon` of a feature whose icon is only a stack of layers (e.g. a lightbox and its lettering): `{ "name", "mode": "compose", "layers": [ "boxes/double", "boxes/double/D_left", ... ] }` |

Job fields:

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Used in the console summary and in the default filename templates |
| `template` | yes | Template path, relative to `--templates` |
| `base` | split/digits: yes; fused: optional | Output path (no extension) for the shape-only base/placeholder file |
| `overlayDir` | split/digits/fused: yes | Directory the per-value file(s) are written into |
| `values` | yes (unless `valuesBySlot` is used) | Values to render |
| `valuesBySlot` | split only, optional | `{ slotName: [values] }`, when slots don't share the same range (overrides `values`) |
| `slots` | split only, optional | Slot names, **top-to-bottom** (text elements are matched to slots by vertical position in the template, not document order). Defaults to `["centered"]` for a single `<text>`, or `["slot0", "slot1", ...]` |
| `fileName` | optional | Filename template; see below. Defaults to `"{name}_{v}"` (centered) or `"{name}_{v}_{slot}"` (slotted) |
| `textByLength` | split only, optional | Text attributes per value length, e.g. `{ "3": { "y": 820, "font-size": 400 } }`: a smaller font for 3-digit speeds, so one template covers the whole family |
| `displayDivisor` | split/fused, optional | When set, the text shows `floor(value / displayDivisor)` while the filename still uses the raw value (e.g. a pentagonal sign named `..._{30}.svg` that only ever displays the tens digit, "3") |
| `example` | split/digits, optional | Generates one extra composite file, `<group>/examples/<base name>.svg`: the base shape with each slot's overlay baked in, for use as a YAML `exampleIcon:`. A single value for a one-slot job, or `{ slotName: value, ... }` for a multi-slot job (see below) |

A `fused` job's `base` and a `split`/`digits` job's `example` are both
optional convenience outputs, not required by the mode itself - most jobs in
`spec.json` omit them once that family's "nothing selected" icon or
composite preview is finalized and already committed under `icons/fr`, so
re-running `aspects --out icons/fr` never regenerates or overwrites it
(same reasoning as `V_U-turn`'s hand-drawn empty icon). Set `base`/`example`
only while a new family has no such file yet.

`fileName` tokens: `{name}` (the job's `name`), `{v}` (the value, always
rendered brace-wrapped, e.g. `50` -> `{50}`, matching the on-disk naming
convention the renderer expects), `{slot}` (slot name). Most families use
the value-last default (`TIV-D_B_{100}`), but some put it first instead
(`fileName: "{v}{name}"` for the V signs: `{5}V`).

#### Light signal targets (`mode: "lights"`)

Template elements carry class tokens, nothing else:

| Class | Meaning |
|---|---|
| aspect tokens, e.g. `class="S C"` | a light, drawn unlit in the base and lit in each aspect layer using one of its tokens |
| the clearing light token (`class="O"`) | the clearing light (oeilleton), lit by every aspect except those listed in `clearingLight.offWith` |
| a token listed in `parts`, e.g. `class="cache"` | equipment only some signal types have (the white light mask, absent on a Carre violet): left out of the base, written as its own `<target>-<token>` layer |

Spec-wide settings:

| Field | Meaning |
|---|---|
| `lightColors` | lit color per token; an object gives one color per element name, e.g. `"X": { "circle": "#484c63", "path": "#fff" }` for the background and cross of the intermediate signal |
| `clearingLight` | `{ token, color, offWith }` |

Job fields (besides `name`, `template`, `base`, `overlayDir`):

| Field | Required | Meaning |
|---|---|---|
| `aspects` | yes | `{ "<aspect>": "<token>+<token>" }`, one layer `<name>-<aspect>.svg` each, e.g. `"R-A": "R+A"`, `"D": "DJ+DR"` |
| `parts` | optional | tokens written as separate layers instead of being in the base |
| `deactivated` | optional | `{ cx, cy, width, height, thickness }`: St Andrew's cross drawn by the example-only layer `deactivated`, in base coordinates; the example viewBox is grown around the base center |
| `examples` | optional | `[ [ "<layer>", ... ], ... ]`: layers flattened onto the base into `<group>/examples/<name>-<aspect>.svg` (parts are drawn but not named), used as the YAML `exampleIcon` |

The map draws its own cross (`general/signal-deactivated`) over any
feature whose `railway:signal:<type>:deactivated` is set; the "(Annule)"
YAML sections only draw the target unlit. The `deactivated` job field
adds a cross to the `deactivated` examples (used as their `exampleIcon`),
without writing a layer file.

Template coordinates are whole numbers (or .5 to center a stroke or a
light), and curves are plain arcs. No width/height is written: `export`
sets them from the viewBox.

The viewBox of a target with a clearing light is widened symmetrically
around the mast (empty space on the right, or a negative x on F/H), so
the renderer, which composites every icon center on center, centers the
plates below, and the band or boxes above, on the mast rather than on the
mast plus the clearing light.

Target names: `C`, `F`, `H` (tall), `A`, `A_BAL`, `K`, `R`, `Cn` / `Cn_V`
(dwarf Carre), `X` (intermediate), `Cv_bas` / `Cv_bas_V` (low Carre violet).

```yaml
exampleIcon: 'fr/signals/examples/C-C'
icon:
  - default: 'fr/signals/C'                    # unlit base, always first
  - default: 'fr/signals/aspects/C-cache'      # Carre and Semaphore only
  - match: 'railway:signal:main:states'
    cases:
      - { any: [ 'FR:A', 'FR:(A)' ], value: 'fr/signals/aspects/C-A' }
    default: 'fr/signals/aspects/C-C'
```

#### Composite examples

Every flattened example, whatever the mode, is written to an `examples`
folder at the root of its group (`signs/examples`, `boards/examples`,
`signals/examples`...), so examples never mix with the icons the renderer
composites.

A plate built from a separate base + overlay pair has no single file that
shows "what does this whole thing look like" - which is what a YAML
`exampleIcon:` needs. Setting `job.example` on a `split` job generates one
extra file, `<group>/examples/<base name>.svg`, with the chosen value's overlay(s)
already composited onto the base:

```json
{ "...": "...", "slots": ["top", "bottom"], "example": { "top": 60, "bottom": 80 } }
```

For a single-slot job, `example` is just the value itself (`"example": 90`).
A split job with an empty `values` list and an `example` writes a second
base of the same drawing and its example only: the mobile TIV-D
(`TIV-D_diamond_switchable`) uses it to share the overlays of the fixed
TIV-D while keeping its own base, hence distinct icon combinations.
This only covers jobs you opt into - it does not run for every job, so a
family with no `example` field keeps producing base + overlays only, same
as before.

A `fused` template whose text is a mix of fixed wording and a value (e.g.
"L 200 RBT") only has its digit run replaced - "L" and "RBT" pass through
untouched. Centering such a plate, including a leading decorative letter
like the "L" on the length plates, just needs `text-anchor="middle"` and a
single `<text>`/`<tspan>` holding the whole string: the renderer's own text
layout keeps it centered for every value, with no per-template font-metrics
configuration needed.

A non-numeric value (e.g. the Roman numerals of the SLM identification
plates) replaces the whole text instead of a digit run: such a template
holds the value alone.

#### Running it

```
node tools/icons.mjs aspects --all
node tools/icons.mjs aspects --group signals
node tools/icons.mjs aspects --group signs,boards
```

One of `--group` or `--all` is required, so a commit touching one family
only regenerates that family.

With no `--out`, nothing in the project is touched: output goes to a fresh
temp folder (printed at the top of the run) so you can review the result
before it goes anywhere near `icons/fr`. Once you're happy with it:

```
node tools/icons.mjs aspects --group signals --out icons/fr
```

This writes straight into the real icon tree, overwriting any existing file
at the same path. Useful options:

```
node tools/icons.mjs aspects --all --spec tools/aspects/spec.json      # default spec
node tools/icons.mjs aspects --all --templates tools/aspects/templates # default templates
node tools/icons.mjs aspects --all --symbols icons/fr                # default icon tree (compose jobs)
node tools/icons.mjs aspects --all --out icons/fr
node tools/icons.mjs aspects -h
```

Re-running regenerates every selected job's files from the current templates - it's
meant to be re-run as a whole after touching a template, not patched by
hand. If a template changed shape but not text layout, this is also the
simplest way to propagate that change to all its generated values at once.

#### Cleaning the templates

```
node tools/icons.mjs clean-templates
node tools/icons.mjs clean-templates --no-backup
```

Resolves leftover `transform="..."` attributes on the hand-drawn templates
(Inkscape rotate/scale/skew noise) into plain coordinates - deliberately
not via SVGO, which would also rewrite every untransformed shape into a
`<path>`. Also runs the shared cosmetic tidy pass from
`tools/lib/svg-tidy.mjs` (the same one `optimize` runs on `icons/fr`):
shorter colors, no stray `px`/decimal noise, no dead text attributes - see
that file's comments for the exact rules. That pass snaps over-precise
coordinates to a 2.5-unit design grid, but never on a file whose viewBox is
smaller than `audit`'s own `--min` warning threshold (100 by default,
`DEFAULT_MIN_VIEWBOX_DIM` in `tools/lib/shared.mjs`) - on a small icon that
step is large enough to visibly distort it, so those are left exactly as
drawn and are meant to be checked by hand, the same ones `audit` flags.

Run this once after drawing or editing a template, before `aspects`.
Backs up each file it changes to `tools/_backup/aspects-templates/` first,
same convention as `optimize`; pass `--no-backup` to skip it. Templates
are written with CRLF line endings, like every other file.

#### Adding a new family

1. Drop the hand-drawn template SVG into `tools/aspects/templates/signs/` or
   `.../boards/`.
2. Add a job to `spec.json` (copy the closest existing one and adjust
   `template`/`base`/`overlayDir`/`values`/`mode`). A `_source` comment next
   to the job documenting which YAML regex/tag it corresponds to is not
   required by the script but keeps the two in sync by eye - every existing
   job has one.
3. Run `node tools/icons.mjs aspects --group <group>` (no `--out`) and check the files in the
   temp folder.
4. Re-run with `--out icons/fr` once satisfied.

A few jobs in `spec.json` are flagged `PROVISIONAL` in their `_source`
comment - their base filenames have no prior example file to confirm them
against, unlike the others. Treat those filenames as not yet final.

## Project layout

```
<project root>/
  icons/                           # ICONS_ROOT - the source icon tree
    fr/                            # DEFAULT_SVG_ROOT
  tools/
    icons.mjs                      # entry point
    config.json                    # location of the OpenRailwayMap-vector fork
    audit-svg.mjs
    check-yaml.mjs
    optimize-svg.mjs
    export-icons.mjs
    resize-icons.mjs
    import-icons.mjs
    generate-aspects.mjs
    clean-templates.mjs
    render-node.mjs
    render-examples/               # tag files for render
    lib/
      shared.mjs                   # PROJECT_ROOT / ICONS_ROOT / DEFAULT_* / MAP_SCALE_PERCENT / shared helpers
      config.mjs                   # fork paths read from config.json
      svg-size.mjs                 # width/height of the root <svg> (export, resize, import, optimize, render)
      svg-tidy.mjs                 # tidy pass shared by optimize and clean-templates
      audit-template.{mjs,html,css,js}
      svg-sprite.mjs               # audit: inline SVG sprite (hashed symbol ids)
      signal-matcher.mjs           # render: YAML feature matching
      icon-composer.mjs            # render: map-like icon layout
      osm-api.mjs                  # render: node tags from the OSM API
    aspects/
      spec.json
      templates/{signs,boards,boxes,signals}/*.svg
    _backup/                       # created by `optimize`, gitignored
```

All the paths above are computed from the script's own location
(`tools/lib/shared.mjs`) or from `config.json` (`tools/lib/config.mjs`), so
every command works the same regardless of the current working directory
it's run from.

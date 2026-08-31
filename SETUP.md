# Setup

This repo generates `assets/profile-dashboard.svg` — a single hand-designed
SVG dashboard used as the GitHub profile README (`github.com/PATILPARTH1500`).

## Structure

```
PATILPARTH1500/
├── README.md                 # tiny — just embeds the SVG + link row
├── assets/
│   └── profile-dashboard.svg # the generated dashboard (committed)
├── build/
│   └── build-profile.mjs     # reads profile.config.json, writes the SVG
├── profile.config.json       # all editable content: copy, projects, colors
├── package.json
└── preview/
    └── profile-dashboard.png # optional PNG render for quick inspection
```

## Editing content

Everything text-based — name, tagline, bio, project copy, metrics, stack,
philosophy, links, and even the color tokens — lives in
`profile.config.json`. You should not need to touch the SVG or the build
script for a normal content update.

To add or change a project, edit the `projects` array. Each project needs a
`visual` key naming which technical graphic to draw
(`signal`, `network`, `terminal`, `sensor`, `hand`, `route`) — reuse one of
these or add a new drawing function in `build/build-profile.mjs` under
`VISUALS`.

## Build

```bash
npm install
npm run build
```

This regenerates `assets/profile-dashboard.svg`. Commit the regenerated SVG —
GitHub renders the file directly from the repo, it does not run the build
script for you.

## Optional: PNG preview

If you have `rsvg-convert` (from `librsvg2-bin`) installed locally:

```bash
rsvg-convert -w 1200 assets/profile-dashboard.svg -o preview/profile-dashboard.png
```

Useful for a quick visual check before committing — GitHub's own renderer is
the real source of truth, so also open the SVG directly or push to a test
repo to confirm it looks right in-context.

## Why plain SVG

GitHub's README renderer sanitizes embedded SVGs: it strips `<script>`,
`foreignObject`, external stylesheets, and remote font loading. Everything
in `assets/profile-dashboard.svg` is drawn with primitive SVG elements
(`rect`, `circle`, `path`, `line`, `text`/`tspan`, gradients, patterns,
masks) and system font stacks, so it renders identically for every visitor
without depending on anything external.

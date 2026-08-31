#!/usr/bin/env node
// Generates assets/profile-dashboard.svg from profile.config.json
// Pure SVG output — no external fonts, no JS, no foreignObject. GitHub-safe.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "profile.config.json"), "utf8"));

const C = cfg.colors;
const DISPLAY = "'Arial Black', Arial, Helvetica, sans-serif";
const BODY = "Arial, Helvetica, sans-serif";
const MONO = "'Courier New', Courier, monospace";

const CANVAS_W = 1200;
const PAD = 80;
const CONTENT_W = CANVAS_W - PAD * 2; // 1040
const COL_L = PAD; // 80
const COL_R = 600;
const COL_R_W = CANVAS_W - PAD - COL_R; // 520

let defs = [];
let body = [];
let cursorY = 0;

// ---------- utilities ----------

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Rough average glyph-width factor per font (fraction of fontSize)
const AVG_CHAR = { body: 0.52, display: 0.62, mono: 0.6 };

function wrapText(text, maxWidth, fontSize, font = "body") {
  const factor = AVG_CHAR[font] || 0.52;
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * factor)));
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? line + " " + w : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Renders wrapped/multi-line text as a <text> with <tspan>s.
// Returns { svg, height } — height is total vertical space consumed.
function multilineText({
  x,
  y,
  text,
  lines,
  maxWidth,
  fontSize,
  lineHeight,
  weight = "400",
  fill = C.ink,
  anchor = "start",
  font = "body",
  letterSpacing = null,
  uppercase = false,
}) {
  const fam = font === "display" ? DISPLAY : font === "mono" ? MONO : BODY;
  const lh = lineHeight || Math.round(fontSize * 1.32);
  const finalLines = lines || wrapText(text, maxWidth, fontSize, font);
  const ls = letterSpacing !== null ? ` letter-spacing="${letterSpacing}"` : "";
  const tspans = finalLines
    .map((ln, i) => {
      const t = uppercase ? ln.toUpperCase() : ln;
      return `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(t)}</tspan>`;
    })
    .join("");
  const svg = `<text x="${x}" y="${y}" font-family="${fam}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${tspans}</text>`;
  return { svg, height: lh * finalLines.length };
}

function divider(x1, x2, y, color = C.canvas, opacity = 1, dash = null) {
  const d = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1"${d}/>`;
}

function vline(x, y1, y2, color = C.canvas, opacity = 1, width = 1) {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}"/>`;
}

function pill({ x, y, text, color = C.ink, dotColor = C.olive }) {
  const w = text.length * 6.6 + 44;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="30" rx="15" fill="none" stroke="${C.canvas}" stroke-width="1"/>
    <circle cx="${x + 18}" cy="${y + 15}" r="4" fill="${dotColor}"/>
    <text x="${x + 32}" y="${y + 20}" font-family="${BODY}" font-size="11" font-weight="700" letter-spacing="1.2" fill="${color}">${esc(
    text.toUpperCase()
  )}</text>
  </g>`;
}

function chip({ x, y, text, accent = C.ink, w = null }) {
  const width = w || text.length * 6.4 + 24;
  return {
    svg: `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="26" fill="none" stroke="${C.canvas}" stroke-width="1"/>
    <text x="${x + 12}" y="${y + 17}" font-family="${BODY}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${C.secondary}">${esc(
      text
    )}</text>
  </g>`,
    width,
  };
}

function metric({ x, y, value, label, accent = C.clay, align = "start", maxWidth = 140 }) {
  const anchor = align;
  const labelLines = wrapText(label.toUpperCase(), maxWidth, 9.5, "body");
  const lt = labelLines
    .map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : 13}">${esc(ln)}</tspan>`)
    .join("");
  return `
  <g>
    <text x="${x}" y="${y}" font-family="${DISPLAY}" font-size="24" font-weight="700" fill="${accent}" text-anchor="${anchor}">${esc(
    value
  )}</text>
    <text x="${x}" y="${y + 18}" font-family="${BODY}" font-size="9.5" font-weight="600" letter-spacing="0.5" fill="${C.muted}" text-anchor="${anchor}">${lt}</text>
  </g>`;
}

function node(cx, cy, r, fill, opacity = 1) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${opacity}"/>`;
}

function sectionHeading({ x, y, label, headingLines, accent = C.clay, fontSize = 42 }) {
  let svg = "";
  svg += `<text x="${x}" y="${y}" font-family="${BODY}" font-size="12" font-weight="700" letter-spacing="2.4" fill="${accent}">${esc(
    label
  )}</text>`;
  const headY = y + 46;
  const lh = Math.round(fontSize * 1.12);
  const tspans = headingLines
    .map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(ln)}</tspan>`)
    .join("");
  svg += `<text x="${x}" y="${headY}" font-family="${DISPLAY}" font-size="${fontSize}" font-weight="700" fill="${C.ink}" letter-spacing="-0.5">${tspans}</text>`;
  return { svg, bottom: headY + lh * (headingLines.length - 1) };
}

// ---------- graph paper background ----------

function graphPaperBackground(h) {
  defs.push(`
    <pattern id="minorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${C.ink}" stroke-width="0.5" stroke-opacity="0.05"/>
    </pattern>
    <pattern id="majorGrid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#minorGrid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="${C.ink}" stroke-width="0.75" stroke-opacity="0.09"/>
    </pattern>
    <radialGradient id="gridFade" cx="50%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="${C.background}" stop-opacity="1"/>
    </radialGradient>
    <mask id="gridMask">
      <rect x="0" y="0" width="${CANVAS_W}" height="${h}" fill="white"/>
      <rect x="0" y="0" width="${CANVAS_W}" height="${h}" fill="url(#gridFade)"/>
    </mask>
  `);
  return `
  <rect x="0" y="0" width="${CANVAS_W}" height="${h}" fill="${C.background}"/>
  <g mask="url(#gridMask)">
    <rect x="0" y="0" width="${CANVAS_W}" height="${h}" fill="url(#majorGrid)"/>
  </g>`;
}

// ---------- hero technical graphic ----------

function heroGraphic(cx, cy) {
  // Compact schematic sized to sit BELOW the hero headline's baseline —
  // kept well clear of the text block above and the divider below.
  const s = C.sage, o = C.ochre, cl = C.clay, ink = C.ink;
  const R1 = 100, R2 = 74, R3 = 47, CH = 118, DOT = 118;
  let g = `<g>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R1}" fill="none" stroke="${s}" stroke-opacity="0.5" stroke-width="1"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R2}" fill="none" stroke="${o}" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="2 6"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R3}" fill="none" stroke="${ink}" stroke-opacity="0.2" stroke-width="1"/>`;
  g += `<line x1="${cx - CH}" y1="${cy}" x2="${cx + CH}" y2="${cy}" stroke="${ink}" stroke-opacity="0.12" stroke-width="1"/>`;
  g += `<line x1="${cx}" y1="${cy - CH}" x2="${cx}" y2="${cy + CH}" stroke="${ink}" stroke-opacity="0.12" stroke-width="1"/>`;
  const pts = [
    [cx + R1, cy - 4, 4, cl],
    [cx - 66, cy + 40, 3.5, s],
    [cx + 40, cy + 72, 3, o],
    [cx - 86, cy - 52, 3, o],
    [cx + 14, cy - 74, 3.5, s],
  ];
  for (const [px, py, r, c] of pts) {
    g += node(px, py, r, c);
    g += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${c}" stroke-opacity="0.3" stroke-width="1"/>`;
  }
  g += `<circle cx="${cx}" cy="${cy}" r="18" fill="${C.background}" stroke="${ink}" stroke-width="1.5"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="3" fill="${cl}"/>`;
  // waveform beneath, kept inside the block
  const wfY = cy + 112;
  let wf = `M ${cx - CH} ${wfY}`;
  const wpts = [0, 4, -3, 10, -12, 3, 6, -5, 2, 0, -2, 3, -8, 11, -4, 0];
  wpts.forEach((v, i) => {
    const px = cx - CH + (i * (CH * 2)) / (wpts.length - 1);
    wf += ` L ${px.toFixed(1)} ${(wfY + v).toFixed(1)}`;
  });
  g += `<path d="${wf}" fill="none" stroke="${o}" stroke-width="1.5" stroke-opacity="0.65"/>`;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const px = cx + Math.cos(ang) * DOT;
    const py = cy + Math.sin(ang) * DOT * 0.55;
    g += node(px, py, 1.4, ink, 0.18);
  }
  g += `</g>`;
  return g;
}

// ---------- project visuals ----------

function visualSignal(x, y, w, h, accent) {
  const cx = x + w / 2;
  let g = `<g>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.canvas}" stroke-width="1"/>`;
  // orbital motif top-left
  g += `<circle cx="${x + 46}" cy="${y + 46}" r="26" fill="none" stroke="${accent}" stroke-opacity="0.4" stroke-width="1"/>`;
  g += `<circle cx="${x + 46}" cy="${y + 46}" r="4" fill="${accent}"/>`;
  g += `<circle cx="${x + 46 + 26}" cy="${y + 46 - 8}" r="2.5" fill="${C.ink}"/>`;
  // baseline
  const baseY = y + h - 40;
  g += divider(x + 20, x + w - 20, baseY, C.canvas, 1);
  // x-ray waveform with flare spike
  let wf = `M ${x + 20} ${baseY - 6}`;
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const px = x + 20 + (i * (w - 40)) / n;
    let v = Math.sin(i / 3) * 3;
    if (i === 24) v = -70; // flare spike
    if (i === 25) v = -54;
    if (i === 26) v = -30;
    wf += ` L ${px.toFixed(1)} ${(baseY - 6 + v).toFixed(1)}`;
  }
  g += `<path d="${wf}" fill="none" stroke="${accent}" stroke-width="1.75"/>`;
  g += node(x + 20 + (24 * (w - 40)) / n, baseY - 76, 3, C.ink);
  g += `<line x1="${x + 20 + (24 * (w - 40)) / n}" y1="${y + 30}" x2="${x + 20 + (24 * (w - 40)) / n}" y2="${baseY - 76}" stroke="${C.ink}" stroke-opacity="0.25" stroke-dasharray="2 4"/>`;
  // small timeline ticks
  for (let i = 0; i <= 6; i++) {
    const px = x + 20 + (i * (w - 40)) / 6;
    g += vline(px, baseY, baseY + 6, C.muted, 0.6);
  }
  g += `</g>`;
  return g;
}

function visualNetwork(x, y, w, h, accent) {
  let g = `<g>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.canvas}" stroke-width="1"/>`;
  const cx = x + w / 2,
    cy = y + h / 2;
  const nodes = [
    { x: cx, y: y + 46, label: "PATIENT" },
    { x: x + 56, y: cy + 20, label: "DOCTOR" },
    { x: x + w - 56, y: cy + 20, label: "HOSPITAL" },
    { x: cx, y: y + h - 40, label: "INSURER" },
  ];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      g += `<line x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}" stroke="${accent}" stroke-opacity="0.35" stroke-width="1"/>`;
    }
  }
  nodes.forEach((nd) => {
    g += `<circle cx="${nd.x}" cy="${nd.y}" r="9" fill="${C.background}" stroke="${accent}" stroke-width="1.5"/>`;
    g += `<circle cx="${nd.x}" cy="${nd.y}" r="3" fill="${accent}"/>`;
    g += `<text x="${nd.x}" y="${nd.y + 22}" font-family="${BODY}" font-size="9" font-weight="700" letter-spacing="0.8" fill="${C.muted}" text-anchor="middle">${nd.label}</text>`;
  });
  g += `</g>`;
  return g;
}

function visualTerminal(x, y, w, h, accent) {
  let g = `<g>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.ink}"/>`;
  g += `<circle cx="${x + 16}" cy="${y + 16}" r="3" fill="${C.canvas}" fill-opacity="0.5"/>`;
  g += `<circle cx="${x + 28}" cy="${y + 16}" r="3" fill="${C.canvas}" fill-opacity="0.5"/>`;
  g += `<circle cx="${x + 40}" cy="${y + 16}" r="3" fill="${C.canvas}" fill-opacity="0.5"/>`;
  g += `<text x="${x + 20}" y="${y + 52}" font-family="${MONO}" font-size="15" fill="${accent}">&gt;_ vyom --listen</text>`;
  // voice waveform bars
  const barY = y + 78;
  const bw = 4,
    gap = 5;
  const heights = [6, 14, 22, 10, 28, 16, 8, 20, 12, 24, 9, 18, 6, 14, 22, 10, 26, 15, 8, 12];
  heights.forEach((hgt, i) => {
    const bx = x + 20 + i * (bw + gap);
    g += `<rect x="${bx}" y="${barY - hgt}" width="${bw}" height="${hgt * 2}" fill="${C.cream}" fill-opacity="0.85"/>`;
  });
  // automation route lines
  const rY = y + h - 46;
  g += `<line x1="${x + 20}" y1="${rY}" x2="${x + w - 20}" y2="${rY}" stroke="${accent}" stroke-opacity="0.4" stroke-width="1"/>`;
  [0, 0.33, 0.66, 1].forEach((t) => {
    const px = x + 20 + t * (w - 40);
    g += node(px, rY, 2.5, C.cream);
  });
  g += `<text x="${x + 20}" y="${y + h - 16}" font-family="${MONO}" font-size="10" fill="${C.muted}">CPU 12%  MEM 340MB  TASKS 3</text>`;
  g += `</g>`;
  return g;
}

function visualSensor(x, y, w, h, accent) {
  let g = `<g>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.canvas}" stroke-width="1"/>`;
  // board schematic
  const bx = x + 24,
    by = y + 24,
    bw = 70,
    bh = 50;
  g += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="${accent}" stroke-width="1.25"/>`;
  for (let i = 0; i < 5; i++) {
    g += vline(bx + 10 + i * 14, by - 8, by, C.muted, 0.6);
    g += vline(bx + 10 + i * 14, by + bh, by + bh + 8, C.muted, 0.6);
  }
  g += `<circle cx="${bx + bw / 2}" cy="${by + bh / 2}" r="10" fill="none" stroke="${C.ink}" stroke-opacity="0.4" stroke-width="1"/>`;
  // signal stream / air quality waveform
  const baseY = y + h - 42;
  let wf = `M ${bx + bw + 24} ${baseY}`;
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const px = bx + bw + 24 + (i * (x + w - 20 - (bx + bw + 24))) / n;
    const v = Math.sin(i / 2.2) * 10 + (i > 18 ? -22 : 0);
    wf += ` L ${px.toFixed(1)} ${(baseY + v).toFixed(1)}`;
  }
  g += `<path d="${wf}" fill="none" stroke="${accent}" stroke-width="1.75"/>`;
  // threshold line
  g += divider(bx + bw + 24, x + w - 20, baseY - 22, C.clay, 0.6, "3 3");
  g += `<text x="${bx + bw + 24}" y="${baseY - 28}" font-family="${BODY}" font-size="9" font-weight="700" letter-spacing="0.6" fill="${C.clay}">THRESHOLD</text>`;
  g += `</g>`;
  return g;
}

function visualHand(x, y, w, h, accent) {
  let g = `<g>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.canvas}" stroke-width="1"/>`;
  const cx = x + w / 2,
    cy = y + h / 2 + 6;
  // simplified 21-landmark hand skeleton
  const wrist = [cx, cy + 60];
  const fingers = [
    // each finger: base offset angle, length segments
    { ang: -70, len: [26, 22, 18] },
    { ang: -35, len: [30, 24, 20] },
    { ang: 0, len: [32, 26, 20] },
    { ang: 32, len: [28, 22, 18] },
    { ang: 60, len: [22, 18, 14] },
  ];
  let pts = [wrist];
  g += node(wrist[0], wrist[1], 3, C.ink);
  fingers.forEach((f) => {
    let px = wrist[0] + Math.cos(((f.ang - 90) * Math.PI) / 180) * 20;
    let py = wrist[1] + Math.sin(((f.ang - 90) * Math.PI) / 180) * 20;
    g += `<line x1="${wrist[0]}" y1="${wrist[1]}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${accent}" stroke-width="1.25" stroke-opacity="0.7"/>`;
    let cxp = px,
      cyp = py;
    f.len.forEach((l) => {
      const nx = cxp + Math.cos(((f.ang - 90) * Math.PI) / 180) * l;
      const ny = cyp + Math.sin(((f.ang - 90) * Math.PI) / 180) * l;
      g += `<line x1="${cxp.toFixed(1)}" y1="${cyp.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${accent}" stroke-width="1.25" stroke-opacity="0.7"/>`;
      g += node(cxp, cyp, 2.2, C.ink);
      cxp = nx;
      cyp = ny;
    });
    g += node(cxp, cyp, 2.5, accent);
  });
  // reticle + distance measurement
  g += `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${C.muted}" stroke-width="1"/>`;
  g += `<line x1="${x + 20}" y1="${y + h - 20}" x2="${x + w - 20}" y2="${y + h - 20}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="2 3"/>`;
  g += `<text x="${x + w - 20}" y="${y + h - 26}" font-family="${MONO}" font-size="9" fill="${C.muted}" text-anchor="end">d = 128px</text>`;
  g += `</g>`;
  return g;
}

function visualRoute(x, y, w, h, accent) {
  let g = `<g>`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${C.canvas}" stroke-width="1"/>`;
  const p1 = [x + 34, y + h - 30];
  const p2 = [x + w / 2 - 10, y + 40];
  const p3 = [x + w - 34, y + h - 44];
  g += `<path d="M ${p1[0]} ${p1[1]} Q ${p2[0]} ${p2[1] - 20} ${p2[0] + 20} ${p2[1]} T ${p3[0]} ${p3[1]}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="1 7" stroke-linecap="round"/>`;
  [p1, [p2[0] + 20, p2[1]], p3].forEach(([px, py], i) => {
    g += `<circle cx="${px}" cy="${py}" r="6" fill="${C.background}" stroke="${accent}" stroke-width="1.5"/>`;
    g += node(px, py, 2, accent);
  });
  // minimal container/truck schematic
  const tx = x + w - 100,
    ty = y + h - 96;
  g += `<rect x="${tx}" y="${ty}" width="52" height="30" fill="none" stroke="${C.ink}" stroke-opacity="0.5" stroke-width="1.25"/>`;
  g += `<rect x="${tx + 52}" y="${ty + 10}" width="20" height="20" fill="none" stroke="${C.ink}" stroke-opacity="0.5" stroke-width="1.25"/>`;
  g += `<circle cx="${tx + 14}" cy="${ty + 32}" r="4" fill="none" stroke="${C.ink}" stroke-opacity="0.5" stroke-width="1.25"/>`;
  g += `<circle cx="${tx + 60}" cy="${ty + 32}" r="4" fill="none" stroke="${C.ink}" stroke-opacity="0.5" stroke-width="1.25"/>`;
  g += `</g>`;
  return g;
}

const VISUALS = {
  signal: visualSignal,
  network: visualNetwork,
  terminal: visualTerminal,
  sensor: visualSensor,
  hand: visualHand,
  route: visualRoute,
};

// ================= BUILD DOCUMENT =================

body.push(`<!-- generated by build/build-profile.mjs — do not edit directly -->`);

// ---------- HERO ----------
{
  let y = 96;
  body.push(pill({ x: PAD, y: y - 26, text: cfg.status, dotColor: C.olive }));
  y += 40;

  const headY = y + 78;
  const mt = multilineText({
    x: PAD,
    y: headY,
    lines: [cfg.tagline.line1],
    fontSize: 80,
    lineHeight: 84,
    weight: "700",
    fill: C.ink,
    font: "display",
    letterSpacing: "-1.5",
  });
  body.push(mt.svg);

  const mt2 = multilineText({
    x: PAD,
    y: headY + 84,
    lines: [cfg.tagline.line2],
    fontSize: 80,
    lineHeight: 84,
    weight: "700",
    fill: C.clay,
    font: "display",
    letterSpacing: "-1.5",
  });
  body.push(mt2.svg);

  const nameY = headY + 84 + 76;
  body.push(
    `<text x="${PAD}" y="${nameY}" font-family="${BODY}" font-size="16" font-weight="700" letter-spacing="3" fill="${C.ink}">${esc(
      cfg.name.toUpperCase()
    )}</text>`
  );
  body.push(
    `<text x="${PAD}" y="${nameY + 26}" font-family="${BODY}" font-size="15" font-weight="500" fill="${C.secondary}">${esc(
      cfg.role
    )}</text>`
  );

  const bioLines = wrapText(cfg.bio, 470, 15, "body");
  const bioMt = multilineText({
    x: PAD,
    y: nameY + 62,
    lines: bioLines,
    fontSize: 15,
    lineHeight: 23,
    weight: "400",
    fill: C.muted,
  });
  body.push(bioMt.svg);

  // Graphic sits below the two-line headline's baseline, right-aligned,
  // clear of both the text above and the divider below.
  const graphicCY = headY + 84 + 148;
  body.push(heroGraphic(960, graphicCY));

  cursorY = Math.max(nameY + 62 + bioMt.height + 60, graphicCY + 112 + 50);
  body.push(divider(PAD, CANVAS_W - PAD, cursorY, C.canvas, 1));
  cursorY += 64;
}

// ---------- ABOUT ----------
// Single vertical column — label, heading, body, capability marks — so
// the wide display-font heading never collides with a second column.
{
  const sh = sectionHeading({
    x: PAD,
    y: cursorY,
    label: cfg.about.label,
    headingLines: cfg.about.heading,
    accent: C.clay,
    fontSize: 40,
  });
  body.push(sh.svg);

  const bodyY = sh.bottom + 40;
  const bodyLines = wrapText(cfg.about.body, 700, 16, "body");
  const bMt = multilineText({
    x: PAD,
    y: bodyY,
    lines: bodyLines,
    fontSize: 16,
    lineHeight: 25,
    fill: C.secondary,
  });
  body.push(bMt.svg);

  const capsY = bodyY + bMt.height + 40;
  let cx = PAD;
  cfg.about.capabilities.forEach((capLabel) => {
    body.push(`<line x1="${cx}" y1="${capsY - 4}" x2="${cx + 14}" y2="${capsY - 4}" stroke="${C.ochre}" stroke-width="2"/>`);
    body.push(
      `<text x="${cx + 22}" y="${capsY}" font-family="${BODY}" font-size="12" font-weight="700" letter-spacing="1" fill="${C.ink}">${esc(
        capLabel
      )}</text>`
    );
    cx += 22 + capLabel.length * 7.3 + 30;
  });

  cursorY = capsY + 44;
  body.push(divider(PAD, CANVAS_W - PAD, cursorY, C.canvas, 1));
  cursorY += 64;
}

// ---------- SELECTED WORK ----------
{
  const sh = sectionHeading({
    x: PAD,
    y: cursorY,
    label: cfg.work.label,
    headingLines: cfg.work.heading,
    accent: C.clay,
    fontSize: 44,
  });
  body.push(sh.svg);
  cursorY = sh.bottom + 70;

  cfg.projects.forEach((p, idx) => {
    const textLeft = idx % 2 === 0;
    const textX = textLeft ? COL_L : COL_R;
    const visX = textLeft ? COL_R : COL_L;
    const colW = textLeft ? 480 : 480;
    const visW = 480;
    const accent = C[p.accent] || C.clay;

    const rowTop = cursorY;

    // number + title
    body.push(
      `<text x="${textX}" y="${rowTop}" font-family="${BODY}" font-size="13" font-weight="700" letter-spacing="1.5" fill="${C.muted}">${p.num}</text>`
    );
    body.push(
      `<text x="${textX}" y="${rowTop + 40}" font-family="${DISPLAY}" font-size="30" font-weight="700" fill="${C.ink}" letter-spacing="-0.5">${esc(
        p.title
      )}</text>`
    );
    body.push(
      `<text x="${textX}" y="${rowTop + 62}" font-family="${BODY}" font-size="11.5" font-weight="700" letter-spacing="1.2" fill="${accent}">${esc(
        p.category
      )}</text>`
    );

    const descLines = wrapText(p.description, colW, 15, "body");
    const descMt = multilineText({
      x: textX,
      y: rowTop + 92,
      lines: descLines,
      fontSize: 15,
      lineHeight: 23,
      fill: C.secondary,
    });
    body.push(descMt.svg);

    let cy2 = rowTop + 92 + descMt.height + 26;

    // stack chips
    let chipX = textX;
    let chipY = cy2;
    let rowMaxH = 0;
    p.stack.forEach((s) => {
      const c = chip({ x: chipX, y: chipY, text: s });
      if (chipX + c.width > textX + colW) {
        chipX = textX;
        chipY += 34;
      }
      const c2 = chip({ x: chipX, y: chipY, text: s });
      body.push(c2.svg);
      chipX += c2.width + 8;
      rowMaxH = chipY + 26 - cy2;
    });
    cy2 += rowMaxH + 30;

    // metrics or capabilities or status
    if (p.metrics) {
      const mCount = p.metrics.length;
      const mGap = colW / mCount;
      p.metrics.forEach((m, i) => {
        body.push(
          metric({ x: textX + i * mGap, y: cy2, value: m.value, label: m.label, accent, maxWidth: mGap - 14 })
        );
      });
      cy2 += 54;
    } else if (p.capabilities) {
      let capX = textX;
      p.capabilities.forEach((cap) => {
        body.push(
          `<text x="${capX}" y="${cy2}" font-family="${BODY}" font-size="11" font-weight="600" fill="${C.muted}">${esc(
            cap
          )}</text>`
        );
        capX += cap.length * 6.6 + 22;
      });
      cy2 += 30;
    } else if (p.status) {
      body.push(
        `<text x="${textX}" y="${cy2}" font-family="${BODY}" font-size="10.5" font-weight="700" letter-spacing="0.8" fill="${C.muted}">${esc(
          p.status
        )}</text>`
      );
      cy2 += 26;
    }

    body.push(
      `<text x="${textX}" y="${cy2 + 8}" font-family="${MONO}" font-size="11" fill="${C.muted}">${esc(
        p.repo.replace("https://", "")
      )}</text>`
    );

    const rowBottom = Math.max(cy2 + 26, rowTop + 210);
    const visH = rowBottom - rowTop - 4;
    const visFn = VISUALS[p.visual];
    if (visFn) {
      body.push(visFn(visX, rowTop - 26, visW, Math.max(visH, 190), accent));
    }

    cursorY = rowBottom + 50;
    if (idx < cfg.projects.length - 1) {
      body.push(divider(PAD, CANVAS_W - PAD, cursorY - 26, C.canvas, 1));
    }
  });

  cursorY += 20;
  body.push(divider(PAD, CANVAS_W - PAD, cursorY, C.canvas, 1));
  cursorY += 64;
}

// ---------- TOOLKIT ----------
{
  const sh = sectionHeading({
    x: PAD,
    y: cursorY,
    label: cfg.stack.label,
    headingLines: [cfg.stack.heading],
    accent: C.ochre,
    fontSize: 38,
  });
  body.push(sh.svg);

  const groupsY = sh.bottom + 50;
  const groupW = CONTENT_W / cfg.stack.groups.length;
  cfg.stack.groups.forEach((g, i) => {
    const gx = PAD + i * groupW;
    body.push(
      `<text x="${gx}" y="${groupsY}" font-family="${BODY}" font-size="11" font-weight="700" letter-spacing="1.4" fill="${C.olive}">${esc(
        g.title
      )}</text>`
    );
    body.push(divider(gx, gx + groupW - 24, groupsY + 12, C.canvas, 1));
    let iy = groupsY + 36;
    g.items.forEach((item) => {
      body.push(
        `<text x="${gx}" y="${iy}" font-family="${BODY}" font-size="13.5" font-weight="400" fill="${C.secondary}">${esc(
          item
        )}</text>`
      );
      iy += 25;
    });
  });

  cursorY = groupsY + 36 + 5 * 25 + 46;
  body.push(divider(PAD, CANVAS_W - PAD, cursorY, C.canvas, 1));
  cursorY += 64;
}

// ---------- BUILD PHILOSOPHY ----------
{
  const stLines = cfg.philosophy.statement;
  const mt = multilineText({
    x: PAD,
    y: cursorY + 44,
    lines: stLines,
    fontSize: 46,
    lineHeight: 50,
    weight: "700",
    fill: C.ink,
    font: "display",
    letterSpacing: "-1",
  });
  body.push(mt.svg);

  const principlesY = cursorY + 44 + mt.height - 50 + 70;
  const pw = CONTENT_W / 3;
  cfg.philosophy.principles.forEach((pr, i) => {
    const px = PAD + i * pw;
    body.push(
      `<text x="${px}" y="${principlesY}" font-family="${BODY}" font-size="12" font-weight="700" fill="${C.clay}">${pr.num}</text>`
    );
    body.push(
      `<text x="${px}" y="${principlesY + 26}" font-family="${BODY}" font-size="14.5" font-weight="700" letter-spacing="0.5" fill="${C.ink}">${esc(
        pr.title
      )}</text>`
    );
    const tl = wrapText(pr.text, pw - 30, 13, "body");
    const tMt = multilineText({
      x: px,
      y: principlesY + 48,
      lines: tl,
      fontSize: 13,
      lineHeight: 20,
      fill: C.muted,
    });
    body.push(tMt.svg);
  });

  cursorY = principlesY + 48 + 60;
  body.push(divider(PAD, CANVAS_W - PAD, cursorY, C.canvas, 1));
  cursorY += 64;
}

// ---------- CURRENT DIRECTION ----------
{
  body.push(
    `<text x="${PAD}" y="${cursorY}" font-family="${BODY}" font-size="12" font-weight="700" letter-spacing="2.4" fill="${C.sage}">${esc(
      cfg.direction.label
    )}</text>`
  );
  let dy = cursorY + 54;
  const words = cfg.direction.words;
  const wColors = [C.ink, C.clay, C.olive, C.ochre, C.sage];
  let wx = PAD;
  const maxW = CONTENT_W;
  let line = [];
  const lines = [];
  words.forEach((w, i) => {
    line.push({ w, color: wColors[i % wColors.length] });
  });
  // lay out as wrapping inline "poster" words, ~34px font
  const fs = 34;
  let cxw = PAD;
  let curLineWords = [];
  const maxLineWidth = CONTENT_W;
  const rendered = [];
  words.forEach((w, i) => {
    const wWidth = w.length * fs * 0.5 + 30;
    if (cxw + wWidth > PAD + maxLineWidth) {
      rendered.push(curLineWords);
      curLineWords = [];
      cxw = PAD;
    }
    curLineWords.push({ w, color: wColors[i % wColors.length] });
    cxw += wWidth;
  });
  if (curLineWords.length) rendered.push(curLineWords);

  let ly = dy;
  rendered.forEach((ln) => {
    let lx = PAD;
    ln.forEach((item) => {
      body.push(
        `<text x="${lx}" y="${ly}" font-family="${DISPLAY}" font-size="${fs}" font-weight="700" fill="${item.color}" letter-spacing="-0.5">${esc(
          item.w
        )}</text>`
      );
      lx += item.w.length * fs * 0.5 + 30;
    });
    ly += fs + 18;
  });

  cursorY = ly + 30;
  body.push(divider(PAD, CANVAS_W - PAD, cursorY, C.canvas, 1));
  cursorY += 56;
}

// ---------- FOOTER ----------
{
  body.push(
    `<text x="${PAD}" y="${cursorY}" font-family="${BODY}" font-size="14" font-weight="700" letter-spacing="2" fill="${C.ink}">${esc(
      cfg.name.toUpperCase()
    )}</text>`
  );
  body.push(
    `<text x="${PAD}" y="${cursorY + 22}" font-family="${MONO}" font-size="12" fill="${C.muted}">${esc(
      cfg.handle
    )}</text>`
  );

  const linkLabels = ["Portfolio", "GitHub", "LinkedIn"];
  let lx = CANVAS_W - PAD;
  const linkY = cursorY;
  const widths = linkLabels.map((l) => l.length * 7.6);
  let totalW = widths.reduce((a, b) => a + b, 0) + (linkLabels.length - 1) * 24;
  let startX = CANVAS_W - PAD - totalW;
  let px = startX;
  linkLabels.forEach((l, i) => {
    body.push(
      `<text x="${px}" y="${linkY}" font-family="${BODY}" font-size="13" font-weight="600" fill="${C.secondary}">${esc(
        l
      )}</text>`
    );
    px += widths[i] + 24;
  });

  cursorY += 50;
  const closingLines = wrapText(cfg.footer.closing, CONTENT_W, 13, "body");
  const cMt = multilineText({
    x: PAD,
    y: cursorY,
    lines: closingLines,
    fontSize: 13,
    lineHeight: 20,
    fill: C.muted,
  });
  body.push(cMt.svg);

  cursorY += cMt.height + 50;
}

const TOTAL_H = Math.ceil(cursorY / 10) * 10 + 20;

const svg = `<svg width="${CANVAS_W}" height="${TOTAL_H}" viewBox="0 0 ${CANVAS_W} ${TOTAL_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(
  cfg.name
)} — engineering profile dashboard">
  <defs>
    ${defs.join("\n")}
  </defs>
  ${graphPaperBackground(TOTAL_H)}
  ${body.join("\n")}
</svg>`;

const outPath = path.join(ROOT, "assets", "profile-dashboard.svg");
fs.writeFileSync(outPath, svg, "utf8");
console.log(`Wrote ${outPath} (${CANVAS_W}x${TOTAL_H})`);

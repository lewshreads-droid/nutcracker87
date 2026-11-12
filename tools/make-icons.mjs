// Renders the app icons using the game's own fighter-drawing code.
// Usage (from the nutcracker87 folder):  node tools/make-icons.mjs
// Writes icon-192.png, icon-512.png and icon-maskable-512.png next to index.html.
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.slice(html.indexOf("'use strict';"), html.lastIndexOf('</script>'));

// Pull out only the data and drawing sections; the rest needs a real browser.
const between = (a, b) => {
  const i = script.indexOf(a), j = script.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`marker not found: ${i < 0 ? a : b}`);
  return script.slice(i, j);
};
const code = between("'use strict';", '/* =====================================================================\n   INPUT')
  + between('// --- fighter drawing:', '// Head-and-shoulders portrait');

// A tiny software canvas: axis-aligned fillRect under translate/scale/rotate(90°), with alpha blending.
function makeRaster(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  let m = [1, 0, 0, 1, 0, 0], stack = [], fill = [0, 0, 0, 1];
  const parse = c => {
    if (c.startsWith('#')) {
      const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    const v = c.match(/[\d.]+/g).map(Number);
    return [v[0], v[1], v[2], v[3] ?? 1];
  };
  const apply = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const ctx = {
    save() { stack.push(m.slice()); },
    restore() { m = stack.pop(); },
    translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
    scale(sx, sy) { m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; },
    rotate(a) {
      const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
      m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, -m[0] * s + m[2] * c, -m[1] * s + m[3] * c, m[4], m[5]];
    },
    set fillStyle(c) { fill = parse(c); },
    fillRect(x, y, w, h) {
      const [x1, y1] = apply(x, y), [x2, y2] = apply(x + w, y + h);
      const xa = Math.round(Math.min(x1, x2)), xb = Math.round(Math.max(x1, x2));
      const ya = Math.round(Math.min(y1, y2)), yb = Math.round(Math.max(y1, y2));
      const [r, g, b, a] = fill;
      for (let yy = Math.max(0, ya); yy < Math.min(size, yb); yy++)
        for (let xx = Math.max(0, xa); xx < Math.min(size, xb); xx++) {
          const i = (yy * size + xx) * 4;
          px[i] = px[i] * (1 - a) + r * a; px[i + 1] = px[i + 1] * (1 - a) + g * a; px[i + 2] = px[i + 2] * (1 - a) + b * a; px[i + 3] = 255;
        }
    },
  };
  return { ctx, px, size };
}

// Minimal PNG encoder (RGBA, no filtering), nearest-neighbour upscaled.
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(r, scale) {
  const S = r.size * scale, raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const src = (Math.floor(y / scale) * r.size + Math.floor(x / scale)) * 4, dst = y * (S * 4 + 1) + 1 + x * 4;
    raw[dst] = r.px[src]; raw[dst + 1] = r.px[src + 1]; raw[dst + 2] = r.px[src + 2]; raw[dst + 3] = 255;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Run the game's drawing code in a sandbox with just enough browser stubbed in.
const sandbox = { window: {}, location: { search: '' }, navigator: {}, Math, console };
sandbox.window.matchMedia = () => ({ matches: false });
sandbox.matchMedia = sandbox.window.matchMedia;
vm.createContext(sandbox);
vm.runInContext(code + '\n;globalThis.G = { drawFighter, POSES, CHARACTERS, rect };', sandbox);
const { drawFighter, POSES, CHARACTERS, rect } = sandbox.G;

// One icon: hit-spark rays behind a cross-eyed, clutching Dai, with stars round his head.
function icon(figureScale) {
  const r = makeRaster(64), ctx = r.ctx, cx = 32, cy = 32;
  rect(ctx, '#1a0f2e', 0, 0, 64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const a = Math.atan2(y - cy, x - cx), ray = Math.floor((a + Math.PI) / (Math.PI * 2) * 16) % 2;
    if (ray) rect(ctx, '#2e1858', x, y, 1, 1);
  }
  const s = figureScale, ch = CHARACTERS[0], P = POSES.hurt0;
  const hx = cx, hy = 35;   // where the head centre lands
  drawFighter(ctx, ch, ch.pals[0], 'hurt0', hx - P.hd[0] * s, hy - P.hd[1] * s, 1, s, 0.4);
  const star = (x, y) => { rect(ctx, '#ffe066', x - 1, y, 3, 1); rect(ctx, '#ffe066', x, y - 1, 1, 3); };
  for (const [dx, dy] of [[-12, -21], [0, -25], [12, -21]]) star(hx + dx, hy + dy);   // birdies, well, stars
  return r;
}

// Same art for both: the figure sits inside the middle 80%, so the maskable crop to a circle keeps it whole.
const art = icon(2);
fs.writeFileSync(path.join(root, 'icon-512.png'), png(art, 8));
fs.writeFileSync(path.join(root, 'icon-192.png'), png(art, 3));
fs.writeFileSync(path.join(root, 'icon-maskable-512.png'), png(art, 8));
console.log('wrote icon-192.png, icon-512.png, icon-maskable-512.png');

// Builds a single-layer, 8-bit RGB+alpha Photoshop (PSD) file from PNG bytes.
// Pure JavaScript so it runs in the edge runtime — no canvas or native binaries.
import { decode } from "fast-png";

class ByteWriter {
  private buf = new Uint8Array(4096);
  private len = 0;

  private ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  get length() {
    return this.len;
  }

  u8(v: number) {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
  }

  u16(v: number) {
    this.ensure(2);
    this.buf[this.len++] = (v >>> 8) & 0xff;
    this.buf[this.len++] = v & 0xff;
  }

  i16(v: number) {
    this.u16(v & 0xffff);
  }

  u32(v: number) {
    this.ensure(4);
    for (let shift = 24; shift >= 0; shift -= 8) this.buf[this.len++] = (v >>> shift) & 0xff;
  }

  i32(v: number) {
    this.u32(v >>> 0);
  }

  ascii(s: string) {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    this.bytes(bytes);
  }

  bytes(b: Uint8Array) {
    this.ensure(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  /** Pascal string, padded so the writer position lands on a multiple of `align`. */
  pascal(s: string, align: number) {
    this.u8(s.length);
    this.ascii(s);
    this.padTo(align);
  }

  padTo(align: number) {
    while (this.len % align !== 0) this.u8(0);
  }

  result() {
    return this.buf.slice(0, this.len);
  }
}

/** Converts a PNG to an editable Photoshop file: one layer with the full image. */
export function pngToPsd(png: Uint8Array): Uint8Array {
  const img = decode(png);
  const { width, height, channels } = img;
  const px = img.data;
  const wide = px instanceof Uint16Array;
  const sample = (i: number) => (wide ? (px[i] ?? 0) >>> 8 : px[i] ?? 0);
  const n = width * height;
  const r = new Uint8Array(n);
  const g = new Uint8Array(n);
  const b = new Uint8Array(n);
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const gray = channels < 3;
    r[i] = sample(o);
    g[i] = gray ? sample(o) : sample(o + 1);
    b[i] = gray ? sample(o) : sample(o + 2);
    a[i] = channels === 4 ? sample(o + 3) : channels === 2 ? sample(o + 1) : 255;
  }

  // Layer record: one full-size layer holding the flyer.
  const layer = new ByteWriter();
  layer.i32(0);
  layer.i32(0);
  layer.i32(height);
  layer.i32(width);
  layer.u16(4);
  for (const id of [0, 1, 2, -1]) {
    layer.i16(id);
    layer.u32(2 + n); // 2-byte compression marker + raw plane bytes
  }
  layer.ascii("8BIM");
  layer.ascii("norm");
  layer.u8(255); // opacity
  layer.u8(0); // clipping
  layer.u8(0); // flags
  layer.u8(0); // filler
  const extra = new ByteWriter();
  extra.u32(0); // no layer mask
  extra.u32(0); // default blending ranges
  extra.pascal("Flyer", 4); // layer name
  layer.u32(extra.length);
  layer.bytes(extra.result());
  for (const plane of [r, g, b, a]) {
    layer.u16(0); // compression 0 = raw
    layer.bytes(plane);
  }

  const layerInfo = new ByteWriter();
  layerInfo.u16(1); // one layer
  layerInfo.bytes(layer.result());
  layerInfo.padTo(2);

  const layerAndMask = new ByteWriter();
  layerAndMask.u32(layerInfo.length);
  layerAndMask.bytes(layerInfo.result());
  layerAndMask.u32(0); // global layer mask info: none
  layerAndMask.padTo(2);

  const resources = new ByteWriter();
  // ResolutionInfo (0x03ED): 72 dpi so the file opens at a sensible print size.
  resources.ascii("8BIM");
  resources.u16(0x03ed);
  resources.pascal("", 2);
  resources.u32(16);
  for (const _unit of [0, 1]) {
    resources.u32(72 << 16); // fixed-point 72.0
    resources.u16(1);
    resources.u16(1);
  }

  const w = new ByteWriter();
  w.ascii("8BPS"); // signature
  w.u16(1); // version
  w.u16(0);
  w.u16(0);
  w.u16(0); // 6 reserved bytes
  w.u16(4); // channels
  w.u32(height);
  w.u32(width);
  w.u16(8); // depth
  w.u16(3); // RGB color mode
  w.u32(0); // color mode data: none
  w.u32(resources.length);
  w.bytes(resources.result());
  w.u32(layerAndMask.length);
  w.bytes(layerAndMask.result());
  w.u16(0); // merged image: raw compression
  w.bytes(r);
  w.bytes(g);
  w.bytes(b);
  w.bytes(a);
  return w.result();
}

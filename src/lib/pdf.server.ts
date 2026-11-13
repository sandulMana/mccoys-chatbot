// Builds a single-page PDF from PNG bytes. Pure JavaScript (fast-png + web CompressionStream),
// so it stays edge-runtime safe — no canvas or native binaries.
import { decode } from "fast-png";

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function pngToPdf(png: Uint8Array): Promise<Uint8Array> {
  const img = decode(png);
  const { width, height, channels } = img;
  const px = img.data;
  const wide = px instanceof Uint16Array;
  const sample = (i: number) => (wide ? (px[i] ?? 0) >>> 8 : px[i] ?? 0);
  const n = width * height;
  const rgb = new Uint8Array(n * 3);
  const alpha = new Uint8Array(n);
  let hasAlpha = false;
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const gray = channels < 3;
    rgb[i * 3] = sample(o);
    rgb[i * 3 + 1] = gray ? sample(o) : sample(o + 1);
    rgb[i * 3 + 2] = gray ? sample(o) : sample(o + 2);
    const a = channels === 4 ? sample(o + 3) : channels === 2 ? sample(o + 1) : 255;
    alpha[i] = a;
    if (a !== 255) hasAlpha = true;
  }
  const rgbZ = await deflate(rgb);
  const alphaZ = hasAlpha ? await deflate(alpha) : null;

  const scale = 792 / Math.max(width, height);
  const pw = +(width * scale).toFixed(2);
  const ph = +(height * scale).toFixed(2);
  const content = new TextEncoder().encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === "string" ? enc.encode(b) : b;
    chunks.push(bytes);
    pos += bytes.length;
  };
  const obj = (num: number, dict: string, stream?: Uint8Array) => {
    offsets[num] = pos;
    push(`${num} 0 obj\n<< ${dict}${stream ? ` /Length ${stream.length}` : ""} >>\n`);
    if (stream) { push("stream\n"); push(stream); push("\nendstream\n"); }
    push("endobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "/Type /Catalog /Pages 2 0 R");
  obj(2, "/Type /Pages /Kids [3 0 R] /Count 1");
  obj(3, `/Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >>`);
  obj(4, "", content);
  obj(5, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${alphaZ ? " /SMask 6 0 R" : ""}`, rgbZ);
  if (alphaZ) obj(6, `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, alphaZ);

  const count = alphaZ ? 7 : 6;
  const xref = pos;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

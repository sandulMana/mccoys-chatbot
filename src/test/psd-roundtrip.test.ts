import { describe, it, expect } from 'vitest';
import { encode, decode } from 'fast-png';
import { pngToPsd, psdToPng } from '@/lib/psd.server';
describe('psdToPng', () => {
  it('recovers the pixels of a PSD as a PNG preview', () => {
    const data = new Uint8Array(4 * 3 * 2).map((_, i) => (i * 37) % 256);
    const out = decode(psdToPng(pngToPsd(encode({ width: 3, height: 2, data, channels: 4, depth: 8 }))));
    expect([out.width, out.height]).toEqual([3, 2]);
    expect(Array.from(out.data).slice(0, 3)).toEqual(Array.from(data).slice(0, 3));
  });
});

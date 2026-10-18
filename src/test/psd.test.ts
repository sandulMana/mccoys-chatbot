import { describe, expect, it } from "vitest";
import { encode as encodePng } from "fast-png";
import { pngToPsd } from "@/lib/psd.server";

describe("pngToPsd", () => {
  const width = 3;
  const height = 2;
  const pixels = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    0, 0, 0, 0, 128, 128, 128, 255, 255, 255, 255, 128,
  ]);

  function readHeader(psd: Uint8Array) {
    const dv = new DataView(psd.buffer, psd.byteOffset, psd.byteLength);
    return {
      signature: String.fromCharCode(psd[0]!, psd[1]!, psd[2]!, psd[3]!),
      channels: dv.getUint16(12),
      height: dv.getUint32(14),
      width: dv.getUint32(18),
      depth: dv.getUint16(22),
      colorMode: dv.getUint16(24),
    };
  }

  it("produces a Photoshop file with the PNG's size and RGBA channels", () => {
    const psd = pngToPsd(encodePng({ width, height, data: pixels, depth: 8 }));
    expect(readHeader(psd)).toEqual({
      signature: "8BPS",
      channels: 4,
      height,
      width,
      depth: 8,
      colorMode: 3,
    });
  });

  it("keeps the merged RGBA data as the final raw-planar section", () => {
    const psd = pngToPsd(encodePng({ width, height, data: pixels, depth: 8 }));
    // Final section: 2-byte compression marker followed by R,G,B,A planes.
    const merged = psd.length - 2 - 4 * width * height;
    expect(merged).toBeGreaterThan(0);
    expect(psd[merged]).toBe(255); // red channel of pixel 0
    expect(psd[merged + width * height]).toBe(0); // green channel of pixel 0
    expect(psd[merged + 2 * width * height]).toBe(0); // blue channel of pixel 0
    expect(psd[merged + 3 * width * height]).toBe(255); // alpha channel of pixel 0
  });
});

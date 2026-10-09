import { describe, expect, test } from "bun:test";

import { sniffImageType } from "./sniff";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe("sniffImageType", () => {
  test("recognizes PNG", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toEqual({
      contentType: "image/png",
      extension: "png",
    });
  });

  test("recognizes JPEG", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });

  test("recognizes GIF87a and GIF89a", () => {
    expect(sniffImageType(bytes(...ascii("GIF87a"), 1, 0))?.contentType).toBe("image/gif");
    expect(sniffImageType(bytes(...ascii("GIF89a"), 1, 0))?.contentType).toBe("image/gif");
  });

  test("recognizes WEBP (RIFF....WEBP)", () => {
    expect(
      sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), ...ascii("VP8 "))),
    ).toEqual({ contentType: "image/webp", extension: "webp" });
  });

  test("rejects a RIFF container that is not WEBP", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
  });

  test("rejects text, SVG, HTML, empty and truncated input", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='x'></svg>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html></html>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0x89, 0x50))).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";

import { LOGO_FORMAT_MESSAGE, LOGO_SIZE_MESSAGE, validateLogoFile } from "./logo-file";

const TWO_MB = 2 * 1024 * 1024;

describe("validateLogoFile", () => {
  test("accepts png, jpeg, gif and webp up to 2 MB inclusive", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(validateLogoFile({ type, size: TWO_MB })).toBeNull();
    }
  });

  test("rejects other types with the format message", () => {
    expect(validateLogoFile({ type: "image/svg+xml", size: 10 })).toBe(LOGO_FORMAT_MESSAGE);
    expect(validateLogoFile({ type: "", size: 10 })).toBe(LOGO_FORMAT_MESSAGE);
  });

  test("rejects files over 2 MB with the size message", () => {
    expect(validateLogoFile({ type: "image/png", size: TWO_MB + 1 })).toBe(LOGO_SIZE_MESSAGE);
  });
});

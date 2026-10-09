import { describe, expect, test } from "bun:test";

import { slugify } from "./create-institution";

describe("slugify", () => {
  test("strips accents, lowercases and hyphenates", () => {
    expect(slugify("Colegio Ñandú Sur")).toBe("colegio-nandu-sur");
  });
  test("collapses punctuation and trims hyphens", () => {
    expect(slugify("  I.E. San José!! ")).toBe("i-e-san-jose");
  });
  test("falls back for names with no letters or digits", () => {
    expect(slugify("¿¿??")).toBe("institucion");
  });
  test("caps the length without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(59)} bbb`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

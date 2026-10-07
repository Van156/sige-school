import { describe, expect, test } from "bun:test";

import {
  generateUsername,
  MAX_USERNAME_LENGTH,
  placeholderEmail,
  UsernameGenerationError,
} from "./username";

const base = {
  firstName: "Juan",
  lastName: "López",
  documentNumber: "1234560001",
};

describe("generateUsername (R1.19, OD-25)", () => {
  test("initial + last name + last 4 document digits, lowercase", () => {
    expect(generateUsername(base, new Set())).toBe("jlopez0001");
  });

  test("strips accents, ñ and ü", () => {
    expect(
      generateUsername({ ...base, firstName: "Ángela", lastName: "Muñoz Güiza" }, new Set()),
    ).toBe("amunozguiza0001");
  });

  test("uses the whole last name with spaces and punctuation removed", () => {
    expect(
      generateUsername({ ...base, firstName: "María", lastName: "De la Cruz-Ríos" }, new Set()),
    ).toBe("mdelacruzrios0001");
  });

  test("uses the first letter of the trimmed first name only", () => {
    expect(generateUsername({ ...base, firstName: "  carlos andrés " }, new Set())).toBe(
      "clopez0001",
    );
  });

  test("takes the last four alphanumeric characters of the document", () => {
    expect(generateUsername({ ...base, documentNumber: "1.234.567-8" }, new Set())).toBe(
      "jlopez5678",
    );
    expect(generateUsername({ ...base, documentNumber: "AB-123" }, new Set())).toBe("jlopezb123");
  });

  test("short documents use every character they have", () => {
    expect(generateUsername({ ...base, documentNumber: "123" }, new Set())).toBe("jlopez123");
  });

  test("appends _2, _3 ... on collision without touching the digits", () => {
    expect(generateUsername(base, new Set(["jlopez0001"]))).toBe("jlopez0001_2");
    expect(generateUsername(base, new Set(["jlopez0001", "jlopez0001_2"]))).toBe("jlopez0001_3");
  });

  test("is case-insensitive about taken usernames", () => {
    expect(generateUsername(base, new Set(["JLopez0001"]))).toBe("jlopez0001_2");
  });

  test("rejects names with no latin letters", () => {
    expect(() => generateUsername({ ...base, lastName: "---" }, new Set())).toThrow(
      UsernameGenerationError,
    );
    expect(() => generateUsername({ ...base, firstName: "--" }, new Set())).toThrow(
      "No se pudo generar el nombre de usuario.",
    );
  });
});

describe("generateUsername length bound", () => {
  const longSurname = "Ñ".repeat(100);

  test("truncates a very long surname so the username fits, keeping initial and digits", () => {
    const username = generateUsername({ ...base, lastName: longSurname }, new Set());

    expect(username.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
    expect(username.startsWith("jn")).toBe(true);
    expect(username.endsWith("0001")).toBe(true);
  });

  test("a collision suffix still fits and is deterministic", () => {
    const first = generateUsername({ ...base, lastName: longSurname }, new Set());
    const second = generateUsername({ ...base, lastName: longSurname }, new Set([first]));
    const tenth = generateUsername(
      { ...base, lastName: longSurname },
      new Set([first, ...Array.from({ length: 8 }, (_, i) => `${first}_${i + 2}`)]),
    );

    expect(second).toBe(`${first}_2`);
    expect(second.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
    expect(tenth).toBe(`${first}_10`);
    expect(tenth.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
  });

  test("short usernames are not truncated", () => {
    expect(generateUsername(base, new Set())).toBe("jlopez0001");
  });
});

describe("placeholderEmail (OD-1)", () => {
  test("builds <username>@sin-correo.<org-slug>.invalid", () => {
    expect(placeholderEmail("jlopez0001", "colegio-sol")).toBe(
      "jlopez0001@sin-correo.colegio-sol.invalid",
    );
  });
});

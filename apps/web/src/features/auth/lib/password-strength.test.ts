import { describe, expect, test } from "bun:test";

import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  test("empty input asks for a password", () => {
    expect(passwordStrength("")).toEqual({ level: 0, label: "Ingrese una contraseña" });
  });

  test("a short lowercase password is the weakest non-empty level", () => {
    expect(passwordStrength("abc")).toEqual({ level: 1, label: "Muy débil" });
  });

  test("each satisfied check raises the level", () => {
    expect(passwordStrength("abcdefgh").level).toBe(1);
    expect(passwordStrength("abcdefgH").level).toBe(2);
    expect(passwordStrength("abcdefH1").level).toBe(3);
    expect(passwordStrength("abcdeH1!").level).toBe(4);
    expect(passwordStrength("abcdefghijH1!")).toEqual({ level: 5, label: "Muy fuerte" });
  });
});

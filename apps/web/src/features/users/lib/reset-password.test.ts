import { describe, expect, test } from "bun:test";

import {
  resetPasswordFormSchema,
  resetSuccessMessage,
  toResetPasswordInput,
} from "./reset-password";

describe("resetPasswordFormSchema", () => {
  test("requires the platform minimum of 8 characters with the spec message", () => {
    const result = resetPasswordFormSchema.safeParse({ newPassword: "1234567" });
    expect(result.error?.issues[0]?.message).toBe(
      "La contraseña debe tener al menos 8 caracteres.",
    );
    expect(resetPasswordFormSchema.safeParse({ newPassword: "12345678" }).success).toBe(true);
  });
});

describe("toResetPasswordInput", () => {
  test("document mode sends no password", () => {
    expect(toResetPasswordInput("p1", { mode: "document" })).toEqual({
      personId: "p1",
      mode: "document",
    });
  });

  test("custom mode sends the new password", () => {
    expect(toResetPasswordInput("p1", { mode: "custom", newPassword: "clave-nueva" })).toEqual({
      personId: "p1",
      mode: "custom",
      newPassword: "clave-nueva",
    });
  });
});

describe("resetSuccessMessage", () => {
  test("names the mode", () => {
    expect(resetSuccessMessage({ mode: "document" })).toBe(
      "Contraseña restablecida al número de documento",
    );
    expect(resetSuccessMessage({ mode: "custom", newPassword: "x" })).toBe(
      "Contraseña actualizada",
    );
  });
});

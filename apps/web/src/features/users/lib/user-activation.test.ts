import { describe, expect, test } from "bun:test";

import { activationCopy, activationFailureMessage } from "./user-activation";

describe("activationCopy", () => {
  test("an active user is asked to be deactivated", () => {
    expect(activationCopy({ username: "ana", isActive: true })).toMatchObject({
      active: false,
      title: "¿Deshabilitar al usuario ana?",
      confirmLabel: "Sí, deshabilitar",
    });
  });

  test("an inactive user is asked to be activated", () => {
    expect(activationCopy({ username: "ana", isActive: false })).toMatchObject({
      active: true,
      title: "¿Habilitar al usuario ana?",
      confirmLabel: "Sí, habilitar",
    });
  });
});

describe("activationFailureMessage", () => {
  test("shows the server message", () => {
    expect(
      activationFailureMessage(new Error("La institución debe conservar un propietario.")),
    ).toBe("La institución debe conservar un propietario.");
  });

  test("falls back when there is no usable message", () => {
    expect(activationFailureMessage(undefined)).toBe("Intente de nuevo en unos minutos.");
    expect(activationFailureMessage({ message: "  " })).toBe("Intente de nuevo en unos minutos.");
  });
});

import { describe, expect, mock, test } from "bun:test";

import { runActivation, type ActivationEffects } from "./activation-flow";
import type { UserRow } from "../types";

const row: UserRow = {
  personId: "p1",
  userId: "u1",
  username: "agomez",
  email: null,
  firstName: "Ana",
  lastName: "Gómez",
  name: "Ana Gómez",
  role: "teacher",
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "2026-01-10T00:00:00.000Z",
  isSelf: false,
};

function effects(setActive: ActivationEffects["setActive"]) {
  return {
    setActive: mock(setActive),
    notifyError: mock((_title: string, _description: string) => undefined),
    notifySuccess: mock((_message: string) => undefined),
    refresh: mock(async () => undefined),
  } satisfies ActivationEffects;
}

describe("runActivation", () => {
  test("deactivates an active user, toasts and refreshes", async () => {
    const fx = effects(async () => ({}));
    await runActivation(row, fx);
    expect(fx.setActive).toHaveBeenCalledWith(row, false);
    expect(fx.notifySuccess).toHaveBeenCalledWith("Usuario deshabilitado");
    expect(fx.refresh).toHaveBeenCalledTimes(1);
    expect(fx.notifyError).not.toHaveBeenCalled();
  });

  test("activates an inactive user", async () => {
    const fx = effects(async () => ({}));
    await runActivation({ ...row, isActive: false }, fx);
    expect(fx.setActive).toHaveBeenCalledWith({ ...row, isActive: false }, true);
    expect(fx.notifySuccess).toHaveBeenCalledWith("Usuario habilitado");
  });

  test("a failure toasts the server message, rethrows and refreshes nothing", async () => {
    const failure = new Error("La institución debe conservar al menos un administrador activo.");
    const fx = effects(async () => {
      throw failure;
    });
    await expect(runActivation(row, fx)).rejects.toBe(failure);
    expect(fx.notifyError).toHaveBeenCalledWith(
      "No se pudo actualizar a agomez",
      "La institución debe conservar al menos un administrador activo.",
    );
    expect(fx.notifySuccess).not.toHaveBeenCalled();
    expect(fx.refresh).not.toHaveBeenCalled();
  });
});

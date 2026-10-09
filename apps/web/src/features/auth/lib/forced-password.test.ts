import { describe, expect, mock, test } from "bun:test";

import {
  CURRENT_PASSWORD_WRONG_MESSAGE,
  FORCED_CHANGE_FALLBACK_MESSAGE,
  GATE_NOT_CLEARED_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  PASSWORD_UNCHANGED_MESSAGE,
  forcedPasswordErrorMessage,
  forcedPasswordSchema,
  submitForcedPasswordChange,
} from "./forced-password";

const valid = {
  currentPassword: "52123456",
  newPassword: "nueva-clave-26",
  confirmPassword: "nueva-clave-26",
};

function canSubmitForcedPassword(values: typeof valid) {
  return forcedPasswordSchema.safeParse(values).success;
}

function messagesOf(values: typeof valid) {
  const result = forcedPasswordSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("forcedPasswordSchema", () => {
  test("accepts a filled, long, confirmed and different password", () => {
    expect(canSubmitForcedPassword(valid)).toBe(true);
  });

  test("requires all three fields", () => {
    expect(canSubmitForcedPassword({ ...valid, currentPassword: "" })).toBe(false);
    expect(
      canSubmitForcedPassword({ currentPassword: "", newPassword: "", confirmPassword: "" }),
    ).toBe(false);
  });

  test("rejects a new password shorter than 8 characters", () => {
    expect(messagesOf({ ...valid, newPassword: "corta1", confirmPassword: "corta1" })).toContain(
      PASSWORD_TOO_SHORT_MESSAGE,
    );
  });

  test("rejects a confirmation mismatch", () => {
    expect(messagesOf({ ...valid, confirmPassword: "otra-clave-26" })).toContain(
      PASSWORD_MISMATCH_MESSAGE,
    );
  });

  test("rejects a new password equal to the current one", () => {
    expect(messagesOf({ ...valid, currentPassword: valid.newPassword })).toContain(
      PASSWORD_UNCHANGED_MESSAGE,
    );
  });
});

describe("forcedPasswordErrorMessage", () => {
  test("maps a wrong current password", () => {
    expect(forcedPasswordErrorMessage({ status: 400, code: "INVALID_PASSWORD" })).toBe(
      CURRENT_PASSWORD_WRONG_MESSAGE,
    );
  });

  test("maps a too-short password", () => {
    expect(forcedPasswordErrorMessage({ status: 400, code: "PASSWORD_TOO_SHORT" })).toBe(
      PASSWORD_TOO_SHORT_MESSAGE,
    );
  });

  test("shows the server message for PASSWORD_UNCHANGED", () => {
    expect(
      forcedPasswordErrorMessage({
        status: 400,
        code: "PASSWORD_UNCHANGED",
        message: "Mensaje del servidor",
      }),
    ).toBe("Mensaje del servidor");
  });

  test("explains that the password changed but the gate was not cleared", () => {
    expect(
      forcedPasswordErrorMessage({ status: 500, code: "PASSWORD_CHANGED_GATE_NOT_CLEARED" }),
    ).toBe(GATE_NOT_CLEARED_MESSAGE);
  });

  test("falls back for anything else", () => {
    expect(forcedPasswordErrorMessage({ status: 500 })).toBe(FORCED_CHANGE_FALLBACK_MESSAGE);
    expect(forcedPasswordErrorMessage(new Error("offline"))).toBe(FORCED_CHANGE_FALLBACK_MESSAGE);
  });
});

describe("submitForcedPasswordChange", () => {
  function setup(changeResult: { error?: unknown } | undefined, refresh = async () => ({})) {
    return {
      changePassword: mock(async () => changeResult),
      refreshSession: mock(refresh),
      clearGateCache: mock(() => {}),
    };
  }

  test("resolves without touching the session or the gate cache on success", async () => {
    const ctx = setup({ error: null });
    await submitForcedPasswordChange(ctx);
    expect(ctx.refreshSession).not.toHaveBeenCalled();
    expect(ctx.clearGateCache).not.toHaveBeenCalled();
  });

  test("keeps the user on the form with the gate message, refreshing the session and gate cache", async () => {
    const ctx = setup({ error: { status: 500, code: "PASSWORD_CHANGED_GATE_NOT_CLEARED" } });
    await expect(submitForcedPasswordChange(ctx)).rejects.toThrow(GATE_NOT_CLEARED_MESSAGE);
    expect(ctx.refreshSession).toHaveBeenCalledTimes(1);
    expect(ctx.clearGateCache).toHaveBeenCalledTimes(1);
  });

  test("still invalidates the gate cache when the session refresh fails", async () => {
    const ctx = setup(
      { error: { status: 500, code: "PASSWORD_CHANGED_GATE_NOT_CLEARED" } },
      async () => {
        throw new Error("offline");
      },
    );
    await expect(submitForcedPasswordChange(ctx)).rejects.toThrow(GATE_NOT_CLEARED_MESSAGE);
    expect(ctx.clearGateCache).toHaveBeenCalledTimes(1);
  });

  test("other failures only surface their message", async () => {
    const ctx = setup({ error: { status: 400, code: "INVALID_PASSWORD" } });
    await expect(submitForcedPasswordChange(ctx)).rejects.toThrow(CURRENT_PASSWORD_WRONG_MESSAGE);
    expect(ctx.refreshSession).not.toHaveBeenCalled();
    expect(ctx.clearGateCache).not.toHaveBeenCalled();
  });
});

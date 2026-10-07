import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";

const warning = mock<(message: string) => void>();
void mock.module("sonner", () => ({ toast: { warning } }));

const {
  PASSWORD_CHANGE_NOTICE,
  PASSWORD_CHANGE_PATH,
  enforcePasswordChangeGate,
  isPasswordChangeRequiredError,
  redirectOnPasswordChangeRequired,
} = await import("./password-gate");

describe("isPasswordChangeRequiredError", () => {
  test("matches the oRPC gate error by code", () => {
    expect(isPasswordChangeRequiredError({ code: "PASSWORD_CHANGE_REQUIRED", status: 403 })).toBe(
      true,
    );
  });

  test("ignores other errors", () => {
    expect(isPasswordChangeRequiredError({ code: "FORBIDDEN" })).toBe(false);
    expect(isPasswordChangeRequiredError(new Error("x"))).toBe(false);
    expect(isPasswordChangeRequiredError(null)).toBe(false);
  });
});

describe("redirectOnPasswordChangeRequired", () => {
  const originalWindow = globalThis.window;
  const assign = mock<(message: string) => void>();

  function setPath(pathname: string) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { pathname, assign } },
    });
  }

  beforeEach(() => assign.mockClear());
  afterEach(() => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  });

  test("redirects to AUTH-03 and reports the error as handled", () => {
    setPath("/dashboard");
    expect(redirectOnPasswordChangeRequired({ code: "PASSWORD_CHANGE_REQUIRED" })).toBe(true);
    expect(assign).toHaveBeenCalledWith(PASSWORD_CHANGE_PATH);
  });

  test("does not redirect again while already on the AUTH-03 path, still suppressing the toast", () => {
    setPath(PASSWORD_CHANGE_PATH);
    expect(redirectOnPasswordChangeRequired({ code: "PASSWORD_CHANGE_REQUIRED" })).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  test("leaves other errors to the caller", () => {
    setPath("/dashboard");
    expect(redirectOnPasswordChangeRequired({ code: "FORBIDDEN" })).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("enforcePasswordChangeGate", () => {
  const me = (mustChangePassword: boolean) => ({ person: { mustChangePassword } });
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    warning.mockClear();
  });

  test("redirects to AUTH-03 and warns while the password change is pending", async () => {
    const thrown = await enforcePasswordChangeGate(queryClient, async () => me(true)).catch(
      (error: unknown) => error,
    );
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: { to: string } }).options.to).toBe(PASSWORD_CHANGE_PATH);
    expect(warning).toHaveBeenCalledWith(PASSWORD_CHANGE_NOTICE);
  });

  test("passes through when no change is pending", async () => {
    await enforcePasswordChangeGate(queryClient, async () => me(false));
    expect(warning).not.toHaveBeenCalled();
  });

  test("treats NO_PERSON as no gate and caches it without refetching", async () => {
    const fetchMe = mock(async () => {
      throw { code: "NO_PERSON" };
    });
    await enforcePasswordChangeGate(queryClient, fetchMe);
    await enforcePasswordChangeGate(queryClient, fetchMe);
    expect(fetchMe).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();
  });

  test("does not block navigation on a real lookup failure, and does not cache it", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    const fetchMe = mock(async () => {
      throw new Error("network");
    });
    await enforcePasswordChangeGate(queryClient, fetchMe);
    await enforcePasswordChangeGate(queryClient, fetchMe);
    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

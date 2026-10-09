import { describe, expect, mock, test } from "bun:test";

import { runPlatformUserCreate } from "./platform-user-flow";

const created = { username: "aperez", next: null };

type Notice = { title: string; description: string };

function effects(
  overrides: Partial<{
    create: () => Promise<typeof created>;
    refresh: () => Promise<unknown>;
    goToList: () => Promise<unknown>;
  }> = {},
) {
  return {
    create: mock(() => Promise.resolve(created)),
    notifySuccess: mock((_notice: Notice) => undefined),
    refresh: mock(() => Promise.resolve()),
    goToList: mock(() => Promise.resolve()),
    ...overrides,
  };
}

describe("runPlatformUserCreate", () => {
  test("toasts, refreshes and goes to the list after a successful create", async () => {
    const e = effects();
    await runPlatformUserCreate(e);
    expect(e.notifySuccess).toHaveBeenCalledTimes(1);
    expect(e.notifySuccess.mock.calls[0]?.[0]).toMatchObject({ title: "Usuario creado" });
    expect(e.refresh).toHaveBeenCalledTimes(1);
    expect(e.goToList).toHaveBeenCalledTimes(1);
  });

  test("rejects with the create error and does nothing else", async () => {
    const failure = new Error("Ya existe un usuario con este documento.");
    const e = effects({ create: mock(() => Promise.reject(failure)) });
    await expect(runPlatformUserCreate(e)).rejects.toBe(failure);
    expect(e.notifySuccess).not.toHaveBeenCalled();
    expect(e.refresh).not.toHaveBeenCalled();
    expect(e.goToList).not.toHaveBeenCalled();
  });

  test("a failed refresh does not reject and still reaches the list", async () => {
    const e = effects({ refresh: mock(() => Promise.reject(new Error("offline"))) });
    await runPlatformUserCreate(e);
    expect(e.goToList).toHaveBeenCalledTimes(1);
  });

  test("a failed navigation does not reject after the user was created", async () => {
    const e = effects({ goToList: mock(() => Promise.reject(new Error("nav"))) });
    await runPlatformUserCreate(e);
    expect(e.notifySuccess).toHaveBeenCalledTimes(1);
  });
});

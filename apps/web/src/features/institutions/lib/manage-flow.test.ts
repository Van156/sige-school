import { describe, expect, test } from "bun:test";

import { startManagement } from "./manage-flow";

describe("startManagement", () => {
  test("impersonates the rector the API returns for the institution", async () => {
    const calls: string[] = [];
    await startManagement(
      {
        resolveRector: async (id) => {
          calls.push(`manage:${id}`);
          return { userId: "rector-1" };
        },
        impersonate: async (userId) => {
          calls.push(`impersonate:${userId}`);
        },
      },
      "inst-1",
    );
    expect(calls).toEqual(["manage:inst-1", "impersonate:rector-1"]);
  });

  test("does not impersonate when the lookup fails", async () => {
    const calls: string[] = [];
    const failure = { code: "NOT_FOUND", message: "La institución no tiene un administrador." };
    await expect(
      startManagement(
        {
          resolveRector: async () => {
            throw failure;
          },
          impersonate: async (userId) => {
            calls.push(userId);
          },
        },
        "inst-1",
      ),
    ).rejects.toBe(failure);
    expect(calls).toEqual([]);
  });

  test("surfaces an impersonation failure", async () => {
    await expect(
      startManagement(
        {
          resolveRector: async () => ({ userId: "rector-1" }),
          impersonate: async () => {
            throw new Error("forbidden");
          },
        },
        "inst-1",
      ),
    ).rejects.toThrow("forbidden");
  });
});

import { describe, expect, test } from "bun:test";

import { createInstitutionWithLogo } from "./create-flow";

const created = { institution: { id: "i1" } };
const logo = new File(["x"], "logo.png", { type: "image/png" });

function deps(overrides: {
  create?: () => Promise<typeof created>;
  setLogo?: () => Promise<void>;
}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      create: async (input: string) => {
        calls.push(`create:${input}`);
        return (overrides.create ?? (async () => created))();
      },
      setLogo: async (id: string) => {
        calls.push(`logo:${id}`);
        return (overrides.setLogo ?? (async () => {}))();
      },
    },
  };
}

describe("createInstitutionWithLogo", () => {
  test("creates, then uploads the logo to the new institution", async () => {
    const { deps: d, calls } = deps({});
    const outcome = await createInstitutionWithLogo(d, "data", logo);
    expect(calls).toEqual(["create:data", "logo:i1"]);
    expect(outcome).toEqual({ result: created, logoUploaded: true });
  });

  test("skips the upload when no logo was picked", async () => {
    const { deps: d, calls } = deps({});
    expect((await createInstitutionWithLogo(d, "data", null)).logoUploaded).toBe(true);
    expect(calls).toEqual(["create:data"]);
  });

  test("a failed upload keeps the created institution and reports it", async () => {
    const { deps: d } = deps({ setLogo: () => Promise.reject(new Error("too big")) });
    expect(await createInstitutionWithLogo(d, "data", logo)).toEqual({
      result: created,
      logoUploaded: false,
    });
  });

  test("a failed create rejects and uploads nothing", async () => {
    const { deps: d, calls } = deps({ create: () => Promise.reject(new Error("conflict")) });
    await expect(createInstitutionWithLogo(d, "data", logo)).rejects.toThrow("conflict");
    expect(calls).toEqual(["create:data"]);
  });
});

import { describe, expect, test } from "bun:test";

import { downloadFile, type FileDownloadEnv } from "./download-file";

function fakeEnv() {
  const calls: string[] = [];
  const scheduled: (() => void)[] = [];
  const env: FileDownloadEnv = {
    createObjectURL: () => {
      calls.push("create");
      return "blob:fake";
    },
    revokeObjectURL: (url) => {
      calls.push(`revoke ${url}`);
    },
    trigger: (url, filename) => {
      calls.push(`trigger ${url} ${filename}`);
    },
    schedule: (callback) => {
      scheduled.push(callback);
    },
  };
  return { env, calls, scheduled };
}

describe("downloadFile", () => {
  test("triggers the download with the fallback name for an anonymous blob", () => {
    const { env, calls } = fakeEnv();
    downloadFile(new Blob(["x"]), "plantilla.xlsx", env);
    expect(calls).toEqual(["create", "trigger blob:fake plantilla.xlsx"]);
  });

  test("prefers the name the file carries", () => {
    const { env, calls } = fakeEnv();
    downloadFile(new File(["x"], "servidor.xlsx"), "plantilla.xlsx", env);
    expect(calls).toContain("trigger blob:fake servidor.xlsx");
  });

  test("revokes the object URL only later, after the browser started the download", () => {
    const { env, calls, scheduled } = fakeEnv();
    downloadFile(new Blob(["x"]), "a.xlsx", env);
    expect(calls).not.toContain("revoke blob:fake");
    expect(scheduled).toHaveLength(1);
    scheduled[0]!();
    expect(calls.at(-1)).toBe("revoke blob:fake");
  });
});

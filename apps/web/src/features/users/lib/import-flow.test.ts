import { describe, expect, mock, test } from "bun:test";

import {
  createFinishNotifier,
  isJobNotFound,
  resetImport,
  selectImportFile,
  userImportSearchSchema,
  type SelectFileEffects,
} from "./import-flow";
import { IMPORT_EXTENSION_MESSAGE } from "./user-import";

function effects() {
  const calls: string[] = [];
  const fx: SelectFileEffects = {
    resetStart: mock(() => void calls.push("resetStart")),
    resetPreview: mock(() => void calls.push("resetPreview")),
    setFile: mock((file: File | null) => void calls.push(`setFile ${file?.name ?? "null"}`)),
    setFileError: mock((m: string | null) => void calls.push(`setFileError ${m ?? "null"}`)),
    requestPreview: mock((file: File) => void calls.push(`preview ${file.name}`)),
  };
  return { fx, calls };
}

describe("selectImportFile", () => {
  test("resets the previous job and preview before previewing the new file", () => {
    const { fx, calls } = effects();
    selectImportFile(new File(["x"], "usuarios.xlsx"), fx);
    expect(calls).toEqual([
      "resetStart",
      "resetPreview",
      "setFileError null",
      "setFile usuarios.xlsx",
      "preview usuarios.xlsx",
    ]);
  });

  test("a rejected file clears the stale preview and file and is never previewed", () => {
    const { fx, calls } = effects();
    selectImportFile(new File(["x"], "usuarios.csv"), fx);
    expect(calls).toEqual([
      "resetStart",
      "resetPreview",
      `setFileError ${IMPORT_EXTENSION_MESSAGE}`,
      "setFile null",
    ]);
    expect(fx.requestPreview).not.toHaveBeenCalled();
  });

  test("clearing the picker resets everything and previews nothing", () => {
    const { fx, calls } = effects();
    selectImportFile(null, fx);
    expect(calls).toEqual(["resetStart", "resetPreview", "setFileError null", "setFile null"]);
  });
});

describe("resetImport", () => {
  test("returns to the empty picker", () => {
    const { fx, calls } = effects();
    resetImport(fx);
    expect(calls).toEqual(["resetStart", "resetPreview", "setFile null", "setFileError null"]);
  });
});

describe("createFinishNotifier", () => {
  test("fires once per finished job, not while running or on repeated observations", () => {
    const onFinish = mock(() => undefined);
    const notifier = createFinishNotifier(onFinish);
    notifier.observe(null, undefined);
    notifier.observe("j1", undefined);
    notifier.observe("j1", "running");
    expect(onFinish).not.toHaveBeenCalled();
    notifier.observe("j1", "done");
    notifier.observe("j1", "done");
    notifier.observe("j1", "failed");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test("another job gets its own refresh", () => {
    const onFinish = mock(() => undefined);
    const notifier = createFinishNotifier(onFinish);
    notifier.observe("j1", "done");
    notifier.observe("j2", "failed");
    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});

describe("isJobNotFound", () => {
  test("recognises the NOT_FOUND code only", () => {
    expect(isJobNotFound({ code: "NOT_FOUND" })).toBe(true);
    expect(isJobNotFound({ code: "INTERNAL_SERVER_ERROR" })).toBe(false);
    expect(isJobNotFound(new Error("x"))).toBe(false);
    expect(isJobNotFound(null)).toBe(false);
  });
});

describe("userImportSearchSchema", () => {
  test("keeps a job id, drops an empty or malformed one", () => {
    expect(userImportSearchSchema.parse({ job: "abc" })).toEqual({ job: "abc" });
    expect(userImportSearchSchema.parse({})).toEqual({});
    expect(userImportSearchSchema.parse({ job: "" })).toEqual({});
    expect(userImportSearchSchema.parse({ job: 12 })).toEqual({});
  });
});

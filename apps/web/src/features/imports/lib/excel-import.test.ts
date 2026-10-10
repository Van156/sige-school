import { describe, expect, test } from "bun:test";

import {
  IMPORT_ACCEPT,
  IMPORT_EXTENSION_MESSAGE,
  IMPORT_FILE_HINT,
  IMPORT_MAX_BYTES,
  IMPORT_POLL_INTERVAL_MS,
  IMPORT_PREVIEW_FALLBACK,
  IMPORT_SIZE_MESSAGE,
  hiddenErrorsLabel,
  importErrorCount,
  importErrorLabel,
  importFailureReason,
  importRowErrors,
  importErrorMessage,
  importPhase,
  importScreen,
  importPollInterval,
  importPreviewSummary,
  importProgressLabel,
  importProgressPercent,
  importedMessage,
  isImportTerminal,
  summarizeImportErrors,
  validateImportFile,
} from "./excel-import";

describe("validateImportFile", () => {
  test("accepts an .xlsx up to the limit, any letter case", () => {
    expect(validateImportFile({ name: "usuarios.xlsx", size: 1000 })).toBeNull();
    expect(validateImportFile({ name: "USUARIOS.XLSX", size: IMPORT_MAX_BYTES })).toBeNull();
  });

  test("rejects other extensions before looking at the size", () => {
    expect(validateImportFile({ name: "usuarios.xls", size: 10 })).toBe(IMPORT_EXTENSION_MESSAGE);
    expect(validateImportFile({ name: "usuarios.csv", size: IMPORT_MAX_BYTES + 1 })).toBe(
      IMPORT_EXTENSION_MESSAGE,
    );
  });

  test("rejects a file over 10 MB with the 413 copy", () => {
    expect(validateImportFile({ name: "a.xlsx", size: IMPORT_MAX_BYTES + 1 })).toBe(
      IMPORT_SIZE_MESSAGE,
    );
  });
});

describe("import limits", () => {
  test("the picker hint is built from the accepted extension and the size limit", () => {
    expect(IMPORT_ACCEPT).toBe(".xlsx");
    expect(IMPORT_FILE_HINT).toBe("Solo archivos .xlsx (máx 10MB)");
  });

  test("the extension pre-check follows the accept value", () => {
    expect(validateImportFile({ name: `a${IMPORT_ACCEPT}`, size: 1 })).toBeNull();
  });
});

describe("importErrorMessage", () => {
  test("shows the server message for the rules it owns", () => {
    expect(
      importErrorMessage(
        { code: "CONFLICT", message: "Ya hay una importación en curso." },
        "fallback",
      ),
    ).toBe("Ya hay una importación en curso.");
    expect(
      importErrorMessage(
        { code: "BAD_REQUEST", message: "Faltan columnas obligatorias: rol" },
        "f",
      ),
    ).toBe("Faltan columnas obligatorias: rol");
  });

  test("maps a 413 to the size copy", () => {
    expect(importErrorMessage({ code: "PAYLOAD_TOO_LARGE", status: 413 }, "f")).toBe(
      IMPORT_SIZE_MESSAGE,
    );
  });

  test("falls back for unexpected failures", () => {
    expect(importErrorMessage(new TypeError("Failed to fetch"), IMPORT_PREVIEW_FALLBACK)).toBe(
      IMPORT_PREVIEW_FALLBACK,
    );
    expect(importErrorMessage({ code: "INTERNAL_SERVER_ERROR", message: "boom" }, "f")).toBe("f");
  });
});

describe("polling", () => {
  test("polls every 2 s until the job is done or failed", () => {
    expect(importPollInterval(undefined)).toBe(IMPORT_POLL_INTERVAL_MS);
    expect(importPollInterval("running")).toBe(2000);
    expect(importPollInterval("done")).toBe(false);
    expect(importPollInterval("failed")).toBe(false);
  });

  test("terminal statuses", () => {
    expect(isImportTerminal("done")).toBe(true);
    expect(isImportTerminal("failed")).toBe(true);
    expect(isImportTerminal("running")).toBe(false);
    expect(isImportTerminal(undefined)).toBe(false);
  });
});

describe("progress", () => {
  test("percent is rounded and clamped", () => {
    expect(importProgressPercent(0, 0)).toBe(0);
    expect(importProgressPercent(25, 100)).toBe(25);
    expect(importProgressPercent(1, 3)).toBe(33);
    expect(importProgressPercent(150, 100)).toBe(100);
    expect(importProgressPercent(-5, 100)).toBe(0);
  });

  test("labels follow the spec copy", () => {
    expect(importProgressLabel(25, 100)).toBe("Importando… 25 de 100");
    expect(importPreviewSummary("usuarios.xlsx", 120, 100)).toBe(
      "usuarios.xlsx · 120 filas, 100 válidas",
    );
    const users = { one: "usuario", other: "usuarios" };
    expect(importedMessage(98, users)).toBe("98 usuarios importados exitosamente");
    expect(importedMessage(1, users)).toBe("1 usuario importado exitosamente");
    const students = { one: "estudiante", other: "estudiantes" };
    expect(importedMessage(12, students)).toBe("12 estudiantes importados exitosamente");
  });
});

describe("importErrorLabel", () => {
  test("keeps a message that already names its row", () => {
    expect(importErrorLabel({ row: 3, message: "Fila 3: Falta el documento." })).toBe(
      "Fila 3: Falta el documento.",
    );
  });

  test("prefixes a bare row message", () => {
    expect(importErrorLabel({ row: 7, message: "Falta el nombre." })).toBe(
      "Fila 7: Falta el nombre.",
    );
  });

  test("renders a job-level error (row 0) without the Fila prefix", () => {
    expect(importErrorLabel({ row: 0, message: "Importación interrumpida" })).toBe(
      "Importación interrumpida",
    );
  });
});

describe("error summary", () => {
  const errors = Array.from({ length: 14 }, (_, index) => ({ row: index + 2, message: "x" }));

  test("lists the first 10 and counts the rest", () => {
    const { listed, hidden } = summarizeImportErrors(errors, 14);
    expect(listed).toHaveLength(10);
    expect(hidden).toBe(4);
    expect(hiddenErrorsLabel(4)).toBe("... y 4 errores más");
    expect(hiddenErrorsLabel(1)).toBe("... y 1 error más");
  });

  test("counts errors the server capped away", () => {
    expect(summarizeImportErrors(errors, 300).hidden).toBe(290);
  });

  test("the count is the larger of the list and the skipped rows", () => {
    expect(importErrorCount({ errors: [], skipped: 0 })).toBe(0);
    expect(importErrorCount({ errors: errors.slice(0, 3), skipped: 250 })).toBe(250);
  });

  test("job-level (row 0) entries are not counted as skipped rows", () => {
    const jobLevel = { row: 0, message: "Importación interrumpida" };
    expect(importErrorCount({ errors: [jobLevel], skipped: 0 })).toBe(0);
    // Capped list: the row 0 entry must not push the count past the exact skipped total.
    expect(importErrorCount({ errors: [...errors, jobLevel], skipped: 14 })).toBe(14);
    expect(importErrorCount({ errors: [...errors, jobLevel], skipped: 3 })).toBe(14);
  });

  test("the failure reason is the job-level message, row errors keep their own list", () => {
    const jobLevel = { row: 0, message: "Importación interrumpida" };
    expect(importFailureReason([errors[0]!, jobLevel])).toBe("Importación interrumpida");
    expect(importFailureReason(errors)).toBeNull();
    expect(importRowErrors([jobLevel, ...errors])).toEqual(errors);
  });
});

describe("importPhase", () => {
  const base = {
    jobId: null,
    jobStatus: undefined,
    startPending: false,
    previewPending: false,
    hasPreview: false,
  } as const;

  test("walks select -> previewing -> ready -> running -> finished", () => {
    expect(importPhase(base)).toBe("select");
    expect(importPhase({ ...base, previewPending: true })).toBe("previewing");
    expect(importPhase({ ...base, hasPreview: true })).toBe("ready");
    expect(importPhase({ ...base, hasPreview: true, startPending: true })).toBe("running");
    expect(importPhase({ ...base, jobId: "j1", jobStatus: "running" })).toBe("running");
    expect(importPhase({ ...base, jobId: "j1", jobStatus: undefined })).toBe("running");
    expect(importPhase({ ...base, jobId: "j1", jobStatus: "done" })).toBe("finished");
    expect(importPhase({ ...base, jobId: "j1", jobStatus: "failed" })).toBe("finished");
  });
});

describe("importScreen", () => {
  const base = {
    phase: "select" as const,
    job: undefined,
    jobLoadFailed: false,
    file: null,
    fileError: null,
    startError: null,
    preview: undefined,
  };
  const preview = { total: 1, valid: 1, invalid: 0, rows: [], errors: [] };
  const job = {
    status: "running" as const,
    total: 10,
    processed: 4,
    imported: 4,
    skipped: 0,
    errors: [],
  };

  test("an empty picker, busy while previewing", () => {
    expect(importScreen(base)).toEqual({
      kind: "picker",
      fileError: null,
      isBusy: false,
      preview: null,
    });
    expect(importScreen({ ...base, phase: "previewing" })).toMatchObject({ isBusy: true });
  });

  test("the preview of the picked file with the start refusal", () => {
    expect(
      importScreen({
        ...base,
        phase: "ready",
        file: { name: "e.xlsx" },
        preview,
        startError: "Ya hay una importación en curso.",
      }),
    ).toEqual({
      kind: "picker",
      fileError: null,
      isBusy: false,
      preview: {
        fileName: "e.xlsx",
        data: preview,
        startError: "Ya hay una importación en curso.",
      },
    });
  });

  test("a running job shows its progress, 0 of 0 before the first poll", () => {
    expect(importScreen({ ...base, phase: "running", job })).toEqual({
      kind: "progress",
      processed: 4,
      total: 10,
    });
    expect(importScreen({ ...base, phase: "running" })).toEqual({
      kind: "progress",
      processed: 0,
      total: 0,
    });
  });

  test("a job that cannot be read is an error; a terminal one its result", () => {
    expect(importScreen({ ...base, phase: "running", jobLoadFailed: true })).toEqual({
      kind: "job-error",
    });
    const done = { ...job, status: "done" as const };
    expect(importScreen({ ...base, phase: "finished", job: done })).toEqual({
      kind: "result",
      job: done,
    });
    const failed = { ...job, status: "failed" as const };
    expect(importScreen({ ...base, phase: "finished", job: failed })).toMatchObject({
      kind: "result",
    });
  });
});

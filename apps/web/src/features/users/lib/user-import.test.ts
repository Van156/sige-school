import { describe, expect, test } from "bun:test";

import {
  IMPORT_EXTENSION_MESSAGE,
  IMPORT_MAX_BYTES,
  IMPORT_POLL_INTERVAL_MS,
  IMPORT_PREVIEW_FALLBACK,
  IMPORT_SIZE_MESSAGE,
  hiddenErrorsLabel,
  importErrorCount,
  importErrorLabel,
  importErrorMessage,
  importPhase,
  importPollInterval,
  importPreviewSummary,
  importProgressLabel,
  importProgressPercent,
  importedMessage,
  isImportTerminal,
  summarizeImportErrors,
  validateImportFile,
} from "./user-import";

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
    expect(importedMessage(98)).toBe("98 usuarios importados exitosamente");
    expect(importedMessage(1)).toBe("1 usuario importado exitosamente");
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
    expect(importErrorCount({ errors: [{ row: 0, message: "x" }], skipped: 0 })).toBe(1);
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

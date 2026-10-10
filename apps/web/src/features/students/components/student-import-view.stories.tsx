import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import StudentImportView from "./student-import-view";

const row = (
  index: number,
  nombre: string,
  apellido: string,
  documento: string,
  grado: string,
  message: string | null = null,
) => ({ row: index, nombre, apellido, documento, grado, valid: message === null, message });

const ROWS = [
  row(2, "Ana María", "Cifuentes Duque", "1101234501", "6-01"),
  row(3, "Felipe", "Arango Villa", "1101234502", "6-02"),
  row(
    4,
    "Mariana",
    "Duplicada Prueba",
    "1023456789",
    "6-01",
    "Fila 4: Ya existe un estudiante con este documento.",
  ),
  row(5, "Camilo", "Sin Documento", "", "6-01", "Fila 5: Falta el documento."),
  row(6, "Sara", "Grado Inexistente", "1101234507", "13-01", 'Fila 6: El grado "13-01" no existe.'),
];

const PREVIEW = {
  total: 5,
  valid: 2,
  invalid: 3,
  rows: ROWS,
  errors: ROWS.filter((entry) => entry.message !== null).map((entry) => ({
    row: entry.row,
    message: entry.message ?? "",
  })),
};

const meta = {
  title: "Students/StudentImportView",
  component: StudentImportView,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "padded" },
  args: {
    screen: { kind: "picker", fileError: null, isBusy: false, preview: null },
    onDownloadTemplate: () => {},
    onSelect: () => {},
    onStart: () => {},
    onReset: () => {},
    onRetryJob: () => {},
  },
} satisfies Meta<typeof StudentImportView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing picked yet. */
export const Empty: Story = {};

export const WrongFileType: Story = {
  args: {
    screen: {
      kind: "picker",
      fileError: "Solo se permiten archivos Excel (.xlsx).",
      isBusy: false,
      preview: null,
    },
  },
};

/** The server preview with valid and invalid rows. */
export const PreviewWithErrors: Story = {
  args: {
    screen: {
      kind: "picker",
      fileError: null,
      isBusy: false,
      preview: { fileName: "estudiantes.xlsx", data: PREVIEW, startError: null },
    },
  },
};

/** Another student import of the institution is still running (USR-R12, per kind). */
export const ImportAlreadyRunning: Story = {
  args: {
    screen: {
      kind: "picker",
      fileError: null,
      isBusy: false,
      preview: {
        fileName: "estudiantes.xlsx",
        data: PREVIEW,
        startError: "Ya hay una importación en curso.",
      },
    },
  },
};

export const Running: Story = {
  args: { screen: { kind: "progress", processed: 120, total: 300 } },
};

export const JobStatusUnavailable: Story = { args: { screen: { kind: "job-error" } } };

export const Done: Story = {
  args: {
    screen: {
      kind: "result",
      job: {
        status: "done",
        total: 300,
        processed: 300,
        imported: 288,
        skipped: 12,
        errors: Array.from({ length: 12 }, (_, index) => ({
          row: index + 2,
          message: `Fila ${index + 2}: Ya existe un estudiante con este documento.`,
        })),
      },
    },
  },
};

export const Failed: Story = {
  args: {
    screen: {
      kind: "result",
      job: {
        status: "failed",
        total: 300,
        processed: 140,
        imported: 138,
        skipped: 2,
        errors: [
          { row: 7, message: 'Fila 7: El grado "13-01" no existe.' },
          { row: 9, message: "Fila 9: Falta el documento." },
          { row: 0, message: "Importación interrumpida" },
        ],
      },
    },
  },
};

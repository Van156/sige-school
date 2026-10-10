import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { enrollmentSearchDefaults } from "../lib/enrollment-list";
import type { EnrollmentRow } from "../types";
import EnrollmentsTable from "./enrollments-table";

const base = {
  studentId: "st1",
  studentName: "Ana Zapata",
  document: "1023456789",
  courseId: "c1",
  courseName: "6-01",
  enrollmentDate: "2026-02-02",
  status: "activa",
  finalScore: null,
  statusNote: null,
  isStale: false,
} as const satisfies Omit<EnrollmentRow, "id" | "subjectName">;

const ROWS: EnrollmentRow[] = [
  { ...base, id: "e1", subjectName: "Matemáticas", finalScore: 4.5 },
  { ...base, id: "e2", subjectName: "Ciencias Naturales" },
  {
    ...base,
    id: "e3",
    studentId: "st2",
    studentName: "Beto Arias",
    document: "1098765432",
    subjectName: "Inglés",
    status: "retirada",
    finalScore: 3,
    statusNote: "Cambio de grado",
    isStale: true,
  },
  {
    ...base,
    id: "e4",
    studentId: "st2",
    studentName: "Beto Arias",
    document: "1098765432",
    subjectName: "Matemáticas",
    courseId: "c2",
    courseName: "7-01",
    status: "cancelada",
  },
];

const meta = {
  title: "Scheduling/EnrollmentsTable",
  component: EnrollmentsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: enrollmentSearchDefaults,
    onSearchChange: () => {},
    filterOptions: {
      courses: [
        { value: "c1", label: "6-01" },
        { value: "c2", label: "7-01" },
      ],
      subjects: [
        { value: "s1", label: "Matemáticas" },
        { value: "s2", label: "Ciencias Naturales" },
        { value: "s3", label: "Inglés" },
      ],
    },
    actions: { canEdit: true, canDelete: true },
    onDelete: () => {},
    list: {
      rows: ROWS,
      total: ROWS.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof EnrollmentsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The three status badges, a final score, the "Grado anterior" badge and the row actions. */
export const Manager: Story = {};

/** Without `enrollment:update` and `enrollment:delete`: no actions column. */
export const ReadOnly: Story = { args: { actions: { canEdit: false, canDelete: false } } };

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

export const NoMatches: Story = {
  args: { list: { ...meta.args.list, rows: [], total: 0 } },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: "No se pudieron cargar las matrículas.",
    },
  },
};

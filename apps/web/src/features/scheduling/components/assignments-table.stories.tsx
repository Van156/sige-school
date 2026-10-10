import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { assignmentSearchDefaults } from "../lib/assignment-list";
import type { AssignmentRow } from "../types";
import AssignmentsTable from "./assignments-table";

const ROWS: AssignmentRow[] = [
  {
    id: "a1",
    offeringId: "o1",
    teacherPersonId: "p1",
    teacherName: "Marcela Ortiz",
    teacherUsername: "mortiz",
    subjectName: "Matemáticas",
    courseName: "6-01",
    academicYear: "2026",
    assignmentDate: "2026-02-02",
    status: "activo",
    notes: null,
  },
  {
    id: "a2",
    offeringId: "o2",
    teacherPersonId: "p2",
    teacherName: "Luis Pérez",
    teacherUsername: "lperez",
    subjectName: "Ciencias Naturales",
    courseName: "6-01",
    academicYear: "2026",
    assignmentDate: "2026-03-10",
    status: "temporal",
    notes: "Reemplazo por incapacidad",
  },
  {
    id: "a3",
    offeringId: "o3",
    teacherPersonId: "p1",
    teacherName: "Marcela Ortiz",
    teacherUsername: "mortiz",
    subjectName: "Inglés",
    courseName: "7-01",
    academicYear: "2026",
    assignmentDate: "2026-02-02",
    status: "inactivo",
    notes: null,
  },
];

const meta = {
  title: "Scheduling/AssignmentsTable",
  component: AssignmentsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: assignmentSearchDefaults,
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
    canEdit: true,
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
} satisfies Meta<typeof AssignmentsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shows the three status badges and the row actions. */
export const Manager: Story = {};

/** Roles without `offering:update`: no row actions. */
export const ReadOnly: Story = { args: { canEdit: false } };

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
      errorMessage: "No se pudieron cargar las asignaciones.",
    },
  },
};

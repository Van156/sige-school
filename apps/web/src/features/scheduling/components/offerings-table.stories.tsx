import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { offeringSearchDefaults } from "../lib/offering-list";
import type { OfferingRow } from "../types";
import OfferingsTable from "./offerings-table";

const ROWS: OfferingRow[] = [
  {
    id: "o1",
    subjectId: "s1",
    subjectName: "Matemáticas",
    subjectCode: "MAT",
    courseId: "c1",
    courseName: "6-01",
    hoursPerWeek: 5,
    teacherPersonId: "p1",
    teacherName: "Marcela Ortiz",
    assignmentStatus: "activo",
  },
  {
    id: "o2",
    subjectId: "s2",
    subjectName: "Ciencias Naturales",
    subjectCode: "CIE",
    courseId: "c1",
    courseName: "6-01",
    hoursPerWeek: 4,
    teacherPersonId: "p2",
    teacherName: "Luis Pérez",
    assignmentStatus: "inactivo",
  },
  {
    id: "o3",
    subjectId: "s3",
    subjectName: "Inglés",
    subjectCode: null,
    courseId: "c2",
    courseName: "7-01",
    hoursPerWeek: 3,
    teacherPersonId: null,
    teacherName: null,
    assignmentStatus: null,
  },
];

const meta = {
  title: "Scheduling/OfferingsTable",
  component: OfferingsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: offeringSearchDefaults,
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
    canDelete: true,
    onEditHours: () => {},
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
} satisfies Meta<typeof OfferingsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shows the "(inactivo)" suffix and the "Sin asignar" state. */
export const Manager: Story = {};

/** Roles without `offering:update`/`offering:delete`: no row actions. */
export const ReadOnly: Story = { args: { canEdit: false, canDelete: false } };

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
      errorMessage: "No se pudieron cargar las materias por grado.",
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { courseSearchDefaults } from "../lib/course-list";
import { withRouter } from "@/shared/storybook/with-router";

import type { CourseRow } from "../types";
import CoursesTable from "./courses-table";

const COURSES: CourseRow[] = [
  {
    id: "g1",
    name: "6-1",
    campusId: "c1",
    campusName: "Sede Principal",
    levelId: "l1",
    levelName: "Sexto",
    directorPersonId: "p1",
    directorName: "Ada Lovelace",
    academicYear: "2026",
    shift: "Mañana",
    maxStudents: 40,
    studentCount: 0,
  },
  {
    id: "g2",
    name: "11°B",
    campusId: "c2",
    campusName: "Sede Norte",
    levelId: null,
    levelName: null,
    directorPersonId: null,
    directorName: null,
    academicYear: "2026",
    shift: "Tarde",
    maxStudents: 35,
    studentCount: 0,
  },
];

const meta = {
  title: "Institution/CoursesTable",
  component: CoursesTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: courseSearchDefaults,
    onSearchChange: () => {},
    filterOptions: {
      campuses: [
        { value: "c1", label: "Sede Principal" },
        { value: "c2", label: "Sede Norte" },
      ],
      levels: [{ value: "l1", label: "Sexto (Sede Principal)" }],
      years: [{ value: "2026", label: "2026" }],
    },
    canManage: true,
    onDelete: () => {},
    list: {
      rows: COURSES,
      total: COURSES.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof CoursesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Coordinators: no row actions (INS-R1). */
export const ReadOnly: Story = { args: { canManage: false } };

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: "No se pudieron cargar los grados.",
    },
  },
};

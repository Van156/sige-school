import { Button } from "@base-template/ui/components/button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import {
  STUDENTS_LOAD_ERROR,
  studentSearchDefaults,
  studentSearchSchema,
} from "../lib/student-list";
import type { StudentRow } from "../types";
import StudentsTable from "./students-table";

const student = (
  overrides: Partial<StudentRow> & Pick<StudentRow, "id" | "name" | "documentNumber">,
): StudentRow => ({
  personId: `p-${overrides.id}`,
  documentType: "TI",
  courseId: "c6",
  courseName: "6-01",
  campusId: "main",
  campusName: "Sede Principal",
  status: "activo",
  guardianName: null,
  ...overrides,
});

const STUDENTS: StudentRow[] = [
  student({
    id: "s1",
    name: "Isabella Gómez Herrera",
    documentNumber: "1023456789",
    guardianName: "Patricia Gómez",
  }),
  student({ id: "s2", name: "Julián López Rojas", documentNumber: "1023456790" }),
  student({
    id: "s3",
    name: "Mateo Ruiz Castro",
    documentNumber: "1023456791",
    courseId: null,
    courseName: null,
    campusId: "north",
    campusName: "Sede Norte",
    guardianName: "Carlos Ruiz",
  }),
  student({
    id: "s4",
    name: "Valentina Díaz Mora",
    documentType: "CC",
    documentNumber: "1001234567",
    courseId: "c10",
    courseName: "10-01",
    status: "graduado",
  }),
];

const meta = {
  title: "Students/StudentsTable",
  component: StudentsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: studentSearchDefaults,
    onSearchChange: () => {},
    filterChoices: {
      campuses: [
        { value: "north", label: "Sede Norte" },
        { value: "main", label: "Sede Principal" },
      ],
      courses: [
        { value: "c6", label: "6-01" },
        { value: "c10", label: "10-01" },
      ],
    },
    canUpdate: true,
    canDelete: true,
    onDelete: () => {},
    list: {
      rows: STUDENTS,
      total: STUDENTS.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof StudentsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A manager: "Ver perfil", "Editar" and "Eliminar" on every row. */
export const Populated: Story = {
  args: { search: studentSearchSchema.parse({ status: "todos" }) },
};

/** A teacher (no `student:update` / `student:delete`): read-only rows. */
export const ReadOnly: Story = {
  args: {
    canUpdate: false,
    canDelete: false,
    list: { ...meta.args.list, rows: STUDENTS.slice(0, 2), total: 2 },
  },
};

export const Loading: Story = {
  args: { list: { ...meta.args.list, rows: undefined, total: undefined, isPending: true } },
};

/** The default "Activos" view with no student yet; creators get "Crear Estudiante". */
export const Empty: Story = {
  args: {
    list: { ...meta.args.list, rows: [], total: 0 },
    emptyAction: <Button>Crear Estudiante</Button>,
  },
};

/** Filters that match nobody keep the toolbar so they can be cleared. */
export const FilteredEmpty: Story = {
  args: {
    search: studentSearchSchema.parse({ name: "zzz", campusId: "north", status: "retirado" }),
    list: { ...meta.args.list, rows: [], total: 0 },
  },
};

export const LoadFailed: Story = {
  args: {
    list: {
      ...meta.args.list,
      rows: undefined,
      total: undefined,
      errorMessage: STUDENTS_LOAD_ERROR,
    },
  },
};

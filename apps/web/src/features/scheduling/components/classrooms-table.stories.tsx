import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import { classroomSearchDefaults } from "../lib/classroom-list";
import type { ClassroomRow } from "../types";
import ClassroomsTable from "./classrooms-table";

const ROOMS: ClassroomRow[] = [
  {
    id: "r1",
    campusId: "c1",
    campusName: "Sede Principal",
    name: "Aula 101",
    code: "AULA-101",
    capacity: 40,
    floor: 1,
    building: "A",
    classroomType: "aula",
    resources: { proyector: true },
  },
  {
    id: "r2",
    campusId: "c2",
    campusName: "Sede Norte",
    name: "Laboratorio de Ciencias",
    code: "LAB-CIENCIAS",
    capacity: 25,
    floor: 2,
    building: null,
    classroomType: "laboratorio",
    resources: null,
  },
];

const meta = {
  title: "Scheduling/ClassroomsTable",
  component: ClassroomsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    search: classroomSearchDefaults,
    onSearchChange: () => {},
    filterOptions: {
      campuses: [
        { value: "c1", label: "Sede Principal" },
        { value: "c2", label: "Sede Norte" },
      ],
    },
    canEdit: true,
    canDelete: true,
    onDelete: () => {},
    list: {
      rows: ROOMS,
      total: ROOMS.length,
      isPending: false,
      isFetching: false,
      isPlaceholderData: false,
      errorMessage: null,
      onRetry: () => {},
    },
  },
} satisfies Meta<typeof ClassroomsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Roles without `classroom:update` and `classroom:delete`: no row actions. */
export const ReadOnly: Story = { args: { canEdit: false, canDelete: false } };

/** A custom role with `classroom:update` but not `classroom:delete`: edit only. */
export const EditOnly: Story = { args: { canDelete: false } };

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
      errorMessage: "No se pudieron cargar los salones.",
    },
  },
};

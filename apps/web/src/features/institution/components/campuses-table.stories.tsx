import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { CampusRow } from "../types";
import CampusesTable from "./campuses-table";

const CAMPUSES: CampusRow[] = [
  {
    id: "c1",
    name: "Sede Principal",
    code: "SP",
    address: "Calle 10 # 20-30",
    jornada: "completa",
    isMain: true,
    active: true,
    createdAt: "2026-01-10",
    courseCount: 4,
  },
  {
    id: "c2",
    name: "Sede Norte",
    code: "SN",
    address: null,
    jornada: "manana",
    isMain: false,
    active: true,
    createdAt: "2026-01-11",
    courseCount: 2,
  },
  {
    id: "c3",
    name: "Sede Rural",
    code: null,
    address: "Vereda El Alto",
    jornada: "tarde",
    isMain: false,
    active: false,
    createdAt: "2026-01-12",
    courseCount: 0,
  },
];

const meta = {
  title: "Institution/CampusesTable",
  component: CampusesTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    campuses: CAMPUSES,
    canManage: true,
    isPending: false,
    errorMessage: null,
    onRetry: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof CampusesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Coordinators and teachers: no row actions (INS-R1). */
export const ReadOnly: Story = { args: { canManage: false } };

export const Loading: Story = { args: { campuses: [], isPending: true } };

export const LoadFailed: Story = {
  args: { campuses: [], errorMessage: "No se pudieron cargar las sedes." },
};

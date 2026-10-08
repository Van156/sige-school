import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { PeriodRow } from "../types";
import PeriodsTable from "./periods-table";

const PERIODS: PeriodRow[] = [
  {
    id: "p1",
    academicYear: "2026",
    orderNum: 1,
    name: "Primer Periodo",
    shortName: "P1",
    startDate: "2026-01-20",
    endDate: "2026-03-31",
    isActive: false,
  },
  {
    id: "p2",
    academicYear: "2026",
    orderNum: 2,
    name: "Segundo Periodo",
    shortName: "P2",
    startDate: "2026-04-07",
    endDate: "2026-06-19",
    isActive: true,
  },
];

const meta = {
  title: "Institution/PeriodsTable",
  component: PeriodsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    periods: PERIODS,
    canManage: true,
    isPending: false,
    errorMessage: null,
    onRetry: () => {},
    onActivate: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof PeriodsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Coordinators: no row actions (INS-R1). */
export const ReadOnly: Story = { args: { canManage: false } };

export const Loading: Story = { args: { periods: [], isPending: true } };

export const LoadFailed: Story = {
  args: { periods: [], errorMessage: "No se pudieron cargar los periodos académicos." },
};

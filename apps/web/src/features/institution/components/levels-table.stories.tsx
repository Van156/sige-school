import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { LevelRow } from "../types";
import LevelsTable from "./levels-table";

const LEVELS: LevelRow[] = [
  {
    id: "l1",
    campusId: "c1",
    campusName: "Sede Principal",
    name: "Transición",
    orderNum: 0,
    courseCount: 1,
  },
  {
    id: "l2",
    campusId: "c1",
    campusName: "Sede Principal",
    name: "Primero",
    orderNum: 1,
    courseCount: 3,
  },
  {
    id: "l3",
    campusId: "c2",
    campusName: "Sede Norte",
    name: "Primero",
    orderNum: 1,
    courseCount: 0,
  },
];

const meta = {
  title: "Institution/LevelsTable",
  component: LevelsTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    levels: LEVELS,
    canManage: true,
    isPending: false,
    errorMessage: null,
    onRetry: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof LevelsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Coordinators: no row actions (INS-R1). */
export const ReadOnly: Story = { args: { canManage: false } };

export const Loading: Story = { args: { levels: [], isPending: true } };

export const LoadFailed: Story = {
  args: { levels: [], errorMessage: "No se pudieron cargar los niveles académicos." },
};

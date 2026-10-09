import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { CriterionRow } from "../types";
import CriteriaTable from "./criteria-table";

const CRITERIA: CriterionRow[] = [
  { id: "c1", name: "Seguimiento", weight: 20, description: null, orderNum: 1 },
  {
    id: "c2",
    name: "Formativo",
    weight: 20,
    description: "Tareas, talleres y participación en clase",
    orderNum: 2,
  },
  {
    id: "c3",
    name: "Cognitivo",
    weight: 30,
    description: "Evaluaciones escritas y orales que miden la apropiación de los contenidos",
    orderNum: 3,
  },
];

const meta = {
  title: "Institution/CriteriaTable",
  component: CriteriaTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    criteria: CRITERIA,
    canManage: true,
    isPending: false,
    errorMessage: null,
    onRetry: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof CriteriaTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Teachers and coordinators: no row actions (INS-R1). */
export const ReadOnly: Story = { args: { canManage: false } };

export const Loading: Story = { args: { criteria: [], isPending: true } };

export const LoadFailed: Story = {
  args: { criteria: [], errorMessage: "No se pudieron cargar los criterios de evaluación." },
};

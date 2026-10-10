import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import type { TimeBlockRow } from "../types";
import TimeBlocksTable from "./time-blocks-table";

const base = {
  campusId: "c1",
  campusName: "Sede Principal",
  shift: "Mañana",
  academicYear: "2026",
  inUse: false,
} as const;

const BLOCKS: TimeBlockRow[] = [
  {
    ...base,
    id: "b1",
    name: "Bloque 1",
    startTime: "07:00",
    endTime: "08:00",
    orderNum: 1,
    isBreak: false,
  },
  {
    ...base,
    id: "b2",
    name: "Bloque 2",
    startTime: "08:00",
    endTime: "09:00",
    orderNum: 2,
    isBreak: false,
    inUse: true,
  },
  {
    ...base,
    id: "b3",
    name: "Recreo",
    startTime: "09:00",
    endTime: "09:30",
    orderNum: 3,
    isBreak: true,
  },
  {
    ...base,
    id: "b4",
    campusId: "c2",
    campusName: "Sede Norte",
    shift: "Tarde",
    name: "Bloque 1",
    startTime: "13:00",
    endTime: "14:00",
    orderNum: 1,
    isBreak: false,
  },
];

const meta = {
  title: "Scheduling/TimeBlocksTable",
  component: TimeBlocksTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    blocks: BLOCKS,
    canEdit: true,
    canDelete: true,
    isPending: false,
    errorMessage: null,
    onRetry: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof TimeBlocksTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = {};

/** Roles without `time_block:update` and `time_block:delete`: no row actions. */
export const ReadOnly: Story = { args: { canEdit: false, canDelete: false } };

/** A custom role with `time_block:update` but not `time_block:delete`: edit only. */
export const EditOnly: Story = { args: { canDelete: false } };

export const Loading: Story = { args: { blocks: [], isPending: true } };

export const LoadFailed: Story = {
  args: { blocks: [], errorMessage: "No se pudieron cargar los bloques de tiempo." },
};

import { STUDENT_STATUSES } from "@base-template/sige-core";
import type { Meta, StoryObj } from "@storybook/react-vite";

import StatusBadge from "./status-badge";

const meta = {
  title: "Students/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  args: { status: "activo" },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Withdrawn: Story = { args: { status: "retirado" } };

export const Graduated: Story = { args: { status: "graduado" } };

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {STUDENT_STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

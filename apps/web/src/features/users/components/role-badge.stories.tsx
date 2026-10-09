import type { Meta, StoryObj } from "@storybook/react-vite";

import RoleBadge from "./role-badge";

const meta = {
  title: "Users/RoleBadge",
  component: RoleBadge,
  tags: ["autodocs"],
  args: { role: "teacher" },
} satisfies Meta<typeof RoleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Teacher: Story = {};

export const Admin: Story = { args: { role: "admin" } };

export const AllRoles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["admin", "coordinator", "teacher", "student", "parent", "viewer", "custom"] as const).map(
        (role) => (
          <RoleBadge key={role} role={role} />
        ),
      )}
    </div>
  ),
};

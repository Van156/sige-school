import type { Meta, StoryObj } from "@storybook/react-vite";

import UserCell from "./user-cell";

const meta = {
  title: "Users/UserCell",
  component: UserCell,
  tags: ["autodocs"],
  args: { username: "maria.londono", email: "maria@colegio.edu.co", role: "teacher" },
} satisfies Meta<typeof UserCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Placeholder addresses are never shown (OD-1). */
export const WithoutEmail: Story = { args: { email: null, role: "student" } };

export const Admin: Story = { args: { username: "rector", role: "admin" } };

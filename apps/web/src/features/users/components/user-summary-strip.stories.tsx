import type { Meta, StoryObj } from "@storybook/react-vite";

import UserSummaryStrip from "./user-summary-strip";

const meta = {
  title: "Users/UserSummaryStrip",
  component: UserSummaryStrip,
  tags: ["autodocs"],
  args: {
    user: {
      username: "agomez1234",
      email: "ana@colegio.edu.co",
      role: "teacher",
      createdAt: "2026-01-10T15:00:00.000Z",
    },
  },
} satisfies Meta<typeof UserSummaryStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutEmail: Story = {
  args: { user: { ...meta.args.user, email: null } },
};

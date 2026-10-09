import type { Meta, StoryObj } from "@storybook/react-vite";

import RoleDashboardPlaceholder from "./role-dashboard-placeholder";

const meta = {
  title: "Features/Dashboard/RoleDashboardPlaceholder",
  component: RoleDashboardPlaceholder,
  tags: ["autodocs"],
  args: { title: "Dashboard Profesor", description: "Bienvenido/a, Luis Pérez" },
} satisfies Meta<typeof RoleDashboardPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

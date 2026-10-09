import type { Meta, StoryObj } from "@storybook/react-vite";
import { Building2 } from "lucide-react";

import { StatGrid, StatTile } from "./stat-tile";

const meta = {
  title: "App/Layout/StatTile",
  component: StatTile,
  tags: ["autodocs"],
  args: { label: "Total Sedes", value: 3, icon: Building2 },
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: "2 activas" } };

export const WithoutIcon: Story = { args: { label: "Sede Principal", value: "San José" } };

export const Grid: Story = {
  render: () => (
    <StatGrid>
      <StatTile label="Total" value={6} />
      <StatTile label="Activos" value={5} />
      <StatTile label="Inactivos" value={1} />
      <StatTile label="Con director" value={4} />
    </StatGrid>
  ),
};

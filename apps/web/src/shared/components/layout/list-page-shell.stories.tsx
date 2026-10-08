import { buttonVariants } from "@base-template/ui/components/button";
import { Badge } from "@base-template/ui/components/badge";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Building2, CircleCheck, Plus } from "lucide-react";

import { withRouter } from "@/shared/storybook/with-router";

import ListPageShell from "./list-page-shell";
import { StatGrid, StatTile } from "./stat-tile";

const meta = {
  title: "App/Layout/ListPageShell",
  component: ListPageShell,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    title: "Gestión de Sedes",
    description: "Administra las sedes de tu institución educativa",
    listTitle: "Listado de Sedes",
    children: <p className="text-sm text-muted-foreground">Table goes here.</p>,
  },
} satisfies Meta<typeof ListPageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Full: Story = {
  args: {
    actions: (
      <span className={buttonVariants()}>
        <Plus data-icon="inline-start" />
        Nueva Sede
      </span>
    ),
    banner: <div className="rounded-lg border bg-card px-3 py-2.5 text-sm">Banner slot</div>,
    stats: (
      <StatGrid>
        <StatTile label="Total Sedes" value={3} icon={Building2} />
        <StatTile label="Sedes Activas" value={2} icon={CircleCheck} />
        <StatTile label="Sede Principal" value="San José" />
        <StatTile label="Sedes Inactivas" value={1} />
      </StatGrid>
    ),
    listAction: <Badge variant="secondary">3 sedes</Badge>,
  },
};

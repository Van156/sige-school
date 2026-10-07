import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/shared/storybook/with-router";

import ManagementDashboard from "./management-dashboard";

const meta = {
  title: "Features/Dashboard/ManagementDashboard",
  component: ManagementDashboard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [withRouter],
  args: {
    institutionName: "Colegio Sol",
    impersonating: false,
    quickActions: [],
    systemLinks: [],
  },
} satisfies Meta<typeof ManagementDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today's state: no data procedures and no target screens yet. */
export const Empty: Story = {};

export const RootView: Story = { args: { impersonating: true } };

export const WithLinks: Story = {
  args: {
    quickActions: [
      {
        label: "Gestionar Estudiantes",
        description: "Ver y administrar estudiantes",
        to: "/dashboard",
      },
    ],
    systemLinks: [
      { label: "Datos Institución", description: "Nombre, NIT, contacto", to: "/dashboard" },
    ],
  },
};

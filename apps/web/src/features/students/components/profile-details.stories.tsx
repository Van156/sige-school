import { Badge } from "@base-template/ui/components/badge";
import type { Meta, StoryObj } from "@storybook/react-vite";

import ProfileDetails from "./profile-details";

const meta = {
  title: "Students/ProfileDetails",
  component: ProfileDetails,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    items: [
      { label: "Sede", value: "Sede Principal" },
      { label: "Curso / Grado", value: <Badge variant="outline">6-01</Badge> },
      { label: "Usuario", value: "igomez6789", mono: true },
      { label: "Estrato", value: 2 },
    ],
  },
} satisfies Meta<typeof ProfileDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};

/** Empty values read "N/A". */
export const EmptyValues: Story = {
  args: {
    items: [
      { label: "Tipo de Sangre", value: null },
      { label: "EPS", value: "" },
      { label: "Usuario", value: null, mono: true },
    ],
  },
};

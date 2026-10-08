import type { Meta, StoryObj } from "@storybook/react-vite";

import InstitutionBanner from "./institution-banner";

const meta = {
  title: "Institution/InstitutionBanner",
  component: InstitutionBanner,
  tags: ["autodocs"],
  args: {
    name: "Institución Educativa San José",
    municipality: "Medellín",
    department: "Antioquia",
    badge: "Tu Institución",
  },
} satisfies Meta<typeof InstitutionBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RootView: Story = { args: { badge: "Vista Root" } };

export const WithoutLocation: Story = {
  args: { municipality: null, department: null, badge: undefined },
};

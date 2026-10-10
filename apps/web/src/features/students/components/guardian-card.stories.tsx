import type { Meta, StoryObj } from "@storybook/react-vite";

import GuardianCard from "./guardian-card";

const meta = {
  title: "Students/GuardianCard",
  component: GuardianCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    guardian: {
      name: "Patricia Gómez",
      relationship: "Madre",
      username: "pgomez",
      phone: "3001234567",
      email: "patricia.gomez@correo.com",
    },
  },
} satisfies Meta<typeof GuardianCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};

/** No phone and a placeholder email: both read "N/A". */
export const MissingContact: Story = {
  args: {
    guardian: { ...meta.args.guardian, relationship: "Abuelo/a", phone: null, email: null },
  },
};

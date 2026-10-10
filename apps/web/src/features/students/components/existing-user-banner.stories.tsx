import type { Meta, StoryObj } from "@storybook/react-vite";

import ExistingUserBanner from "./existing-user-banner";

const meta = {
  title: "Students/ExistingUserBanner",
  component: ExistingUserBanner,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    user: {
      personId: "person-1",
      name: "Mateo Ruiz Castaño",
      documentType: "TI",
      documentNumber: "1098765432",
      username: "mruiz5432",
      email: "mateo.ruiz@correo.com",
    },
  },
} satisfies Meta<typeof ExistingUserBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEmail: Story = {};

/** A placeholder address (OD-1) is not shown. */
export const WithoutEmail: Story = {
  args: { user: { ...meta.args.user, email: null } },
};

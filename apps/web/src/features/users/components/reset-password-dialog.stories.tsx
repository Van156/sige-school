import type { Meta, StoryObj } from "@storybook/react-vite";

import ResetPasswordDialog from "./reset-password-dialog";

const meta = {
  title: "Users/ResetPasswordDialog",
  component: ResetPasswordDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    open: true,
    onOpenChange: () => {},
    mode: "document",
    userLabel: "Ana Gómez",
    onSubmit: async () => {},
  },
} satisfies Meta<typeof ResetPasswordDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** USR-03: resets to the document number. */
export const DocumentMode: Story = {};

/** INS-04: the caller types the new password (at least 8 characters). */
export const CustomMode: Story = { args: { mode: "custom" } };

export const ServerError: Story = {
  args: {
    onSubmit: async () => {
      throw { code: "FORBIDDEN", message: "No tienes permiso." };
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import ConfirmDelete from "./confirm-delete";

const meta = {
  title: "Institution/ConfirmDelete",
  component: ConfirmDelete,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => {},
    onConfirm: () => {},
    title: "¿Eliminar sede Sede Norte?",
  },
} satisfies Meta<typeof ConfirmDelete>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    description: "Esta acción no se puede deshacer si tiene grados asociados.",
  },
};

/** A rejecting `onConfirm` keeps the dialog open so the user can retry. */
export const FailingConfirm: Story = {
  args: {
    onConfirm: () => Promise.reject(new Error("Network down")),
  },
};

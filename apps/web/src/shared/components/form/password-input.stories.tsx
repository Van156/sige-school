import type { Meta, StoryObj } from "@storybook/react-vite";

import PasswordInput from "./password-input";

const meta = {
  title: "App/Form/PasswordInput",
  component: PasswordInput,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { "aria-label": "Contraseña", defaultValue: "secreto123" },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = { args: { large: true } };

export const Invalid: Story = { args: { "aria-invalid": true } };

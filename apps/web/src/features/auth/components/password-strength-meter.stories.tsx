import type { Meta, StoryObj } from "@storybook/react-vite";

import PasswordStrengthMeter from "./password-strength-meter";

const meta = {
  title: "App/Auth/PasswordStrengthMeter",
  component: PasswordStrengthMeter,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { password: "" },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordStrengthMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Weak: Story = { args: { password: "abcdefgh" } };

export const Regular: Story = { args: { password: "abcdefH1" } };

export const VeryStrong: Story = { args: { password: "abcdefghijH1!" } };

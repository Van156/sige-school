import type { Meta, StoryObj } from "@storybook/react-vite";

import ForcedPasswordForm from "./forced-password-form";

const meta = {
  title: "App/Auth/ForcedPasswordForm",
  component: ForcedPasswordForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    fullName: "Marta Gómez",
    username: "mgomez3456",
    onSubmit: async () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ForcedPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

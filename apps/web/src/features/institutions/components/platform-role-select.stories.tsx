import type { Meta, StoryObj } from "@storybook/react-vite";

import PlatformRoleSelect from "./platform-role-select";

const meta = {
  title: "Institutions/PlatformRoleSelect",
  component: PlatformRoleSelect,
  tags: ["autodocs"],
  args: { value: "teacher", onValueChange: () => {} },
} satisfies Meta<typeof PlatformRoleSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Profesor is the default of INS-05. */
export const Default: Story = {};

export const Invalid: Story = { args: { invalid: true } };

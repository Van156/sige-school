import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";

import RoleSelect from "./role-select";

function ControlledRoleSelect(props: ComponentProps<typeof RoleSelect>) {
  const [value, setValue] = useState(props.value);
  return <RoleSelect {...props} value={value} onValueChange={setValue} />;
}

const meta = {
  title: "Users/RoleSelect",
  component: RoleSelect,
  tags: ["autodocs"],
  args: { value: "", onValueChange: () => {}, "aria-label": "Rol" },
  render: (args) => <ControlledRoleSelect {...args} />,
} satisfies Meta<typeof RoleSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Preselected: Story = { args: { value: "teacher" } };

export const Disabled: Story = { args: { value: "student", disabled: true } };

export const Invalid: Story = { args: { invalid: true } };

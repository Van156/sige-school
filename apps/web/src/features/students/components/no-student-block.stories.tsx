import type { Meta, StoryObj } from "@storybook/react-vite";

import NoStudentBlock from "./no-student-block";

const meta = {
  title: "Students/NoStudentBlock",
  component: NoStudentBlock,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { mode: "staff" },
} satisfies Meta<typeof NoStudentBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Staff before choosing a student. */
export const Staff: Story = {};

/** A parent without linked children. */
export const ParentWithoutChildren: Story = { args: { mode: "children" } };

/** A student login without an academic profile. */
export const StudentWithoutProfile: Story = { args: { mode: "self" } };

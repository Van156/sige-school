import type { Meta, StoryObj } from "@storybook/react-vite";

import StudentIdentityCard from "./student-identity-card";

const meta = {
  title: "Students/StudentIdentityCard",
  component: StudentIdentityCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    student: { username: "igomez6789", email: "isabella@correo.com", phone: "3001234567" },
  },
} satisfies Meta<typeof StudentIdentityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};

/** A placeholder email (OD-1) and no phone read "N/A". */
export const WithoutContact: Story = {
  args: { student: { username: "igomez6789", email: null, phone: null } },
};
